import fs from 'node:fs';
import { safeStorage } from 'electron';
import {
  convertRiotMatchTimelineToDraftReview,
  type MinimalRiotMatchData,
  type MinimalRiotTimelineData,
} from '../engine/reviewAnalyzer';
import type { RiotMatchListEntry } from '../shared/ipc';
import type { ReviewMatch } from '../shared/types';

/**
 * Integração OPCIONAL com a Riot Match-V5 (fora de partida ativa, apenas pós-jogo).
 * Para o servidor BR1, o roteamento regional oficial do Account-V1 e Match-V5 é `americas.api.riotgames.com`.
 * Requer chave de desenvolvimento ou chave de produto registrada na Riot Developer Portal.
 * O app funciona 100% sem chave usando preenchimento manual ou importação de JSON local.
 */

export function saveEncryptedRiotApiKey(filePath: string, apiKey: string): boolean {
  try {
    if (!apiKey.trim()) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return true;
    }
    if (!safeStorage.isEncryptionAvailable()) {
      return false;
    }
    const encrypted = safeStorage.encryptString(apiKey.trim());
    fs.writeFileSync(filePath, encrypted);
    return true;
  } catch {
    return false;
  }
}

export function loadEncryptedRiotApiKey(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath) || !safeStorage.isEncryptionAvailable()) {
      return null;
    }
    const buf = fs.readFileSync(filePath);
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

function mapRiotHttpError(status: number): string {
  if (status === 401 || status === 403) {
    return 'Chave da Riot API ausente, expirada ou sem permissão (401/403). O fluxo manual e a importação de JSON local seguem funcionando normalmente.';
  }
  if (status === 404) {
    return 'Conta Riot ID ou partida não encontrada (404). Verifique Nome#TAG e o roteamento Americas (BR1).';
  }
  if (status === 429) {
    return 'Limite de requisições da Riot API atingido (429). Aguarde alguns segundos antes de tentar novamente.';
  }
  return `Erro HTTP ${status} na API da Riot.`;
}

export async function fetchRecentSoloQueueMatches(params: {
  apiKey: string;
  gameName: string;
  tagLine: string;
}): Promise<{
  ok: boolean;
  puuid?: string;
  matches?: RiotMatchListEntry[];
  error?: string;
}> {
  const apiKey = params.apiKey.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: 'Informe uma chave válida da Riot API (ou use o fluxo manual / importação de JSON sem chave).',
    };
  }

  const gameName = encodeURIComponent(params.gameName.trim());
  const tagLine = encodeURIComponent(params.tagLine.trim().replace(/^#/, ''));
  if (!gameName || !tagLine) {
    return { ok: false, error: 'Informe GameName e TAG (ex.: MeuNick e BR1).' };
  }

  try {
    const accRes = await fetch(
      `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`,
      {
        headers: { 'X-Riot-Token': apiKey },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!accRes.ok) {
      return { ok: false, error: mapRiotHttpError(accRes.status) };
    }
    const acc = (await accRes.json()) as { puuid?: string };
    if (!acc.puuid) {
      return { ok: false, error: 'PUUID não retornado pela Riot Account-V1.' };
    }

    const idsRes = await fetch(
      `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${acc.puuid}/ids?queue=420&count=5`,
      {
        headers: { 'X-Riot-Token': apiKey },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!idsRes.ok) {
      return { ok: false, error: mapRiotHttpError(idsRes.status) };
    }
    const ids = (await idsRes.json()) as string[];
    const entries: RiotMatchListEntry[] = [];

    for (const matchId of ids.slice(0, 5)) {
      const mRes = await fetch(
        `https://americas.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
        {
          headers: { 'X-Riot-Token': apiKey },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!mRes.ok) continue;
      const m = (await mRes.json()) as {
        info?: {
          gameCreation?: number;
          gameDuration?: number;
          queueId?: number;
          participants?: Array<{
            puuid?: string;
            championName?: string;
            win?: boolean;
            kills?: number;
            deaths?: number;
            assists?: number;
          }>;
        };
      };
      const me = m.info?.participants?.find((p) => p.puuid === acc.puuid);
      entries.push({
        matchId,
        gameCreation: m.info?.gameCreation ?? 0,
        gameDurationSeconds: m.info?.gameDuration ?? 0,
        queueId: m.info?.queueId ?? 420,
        championName: me?.championName ?? 'Desconhecido',
        win: Boolean(me?.win),
        kills: me?.kills ?? 0,
        deaths: me?.deaths ?? 0,
        assists: me?.assists ?? 0,
      });
    }

    return { ok: true, puuid: acc.puuid, matches: entries };
  } catch (err) {
    return {
      ok: false,
      error: `Falha de rede ao consultar Riot Match-V5: ${err instanceof Error ? err.message : 'erro desconhecido'}.`,
    };
  }
}

export async function fetchAndConvertRiotMatch(params: {
  apiKey: string;
  matchId: string;
  puuid: string;
}): Promise<{ ok: boolean; review?: ReviewMatch; error?: string }> {
  const apiKey = params.apiKey.trim();
  if (!apiKey) {
    return { ok: false, error: 'Chave da Riot API não fornecida.' };
  }

  try {
    const encodedId = encodeURIComponent(params.matchId);
    const [mRes, tRes] = await Promise.all([
      fetch(`https://americas.api.riotgames.com/lol/match/v5/matches/${encodedId}`, {
        headers: { 'X-Riot-Token': apiKey },
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`https://americas.api.riotgames.com/lol/match/v5/matches/${encodedId}/timeline`, {
        headers: { 'X-Riot-Token': apiKey },
        signal: AbortSignal.timeout(8000),
      }),
    ]);

    if (!mRes.ok) return { ok: false, error: mapRiotHttpError(mRes.status) };
    if (!tRes.ok) return { ok: false, error: mapRiotHttpError(tRes.status) };

    const matchData = (await mRes.json()) as MinimalRiotMatchData;
    const timelineData = (await tRes.json()) as MinimalRiotTimelineData;
    const review = convertRiotMatchTimelineToDraftReview(matchData, timelineData, params.puuid);
    return { ok: true, review };
  } catch (err) {
    return {
      ok: false,
      error: `Falha ao importar timeline Match-V5: ${err instanceof Error ? err.message : 'erro desconhecido'}.`,
    };
  }
}
