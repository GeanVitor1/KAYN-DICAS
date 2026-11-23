import { convertLcuMatchToReview, parseLcuMatchList } from '../engine/lcuMatchParser';
import type { LcuMatchListEntry } from '../shared/ipc';
import type { CatalogSnapshot, ReviewMatch } from '../shared/types';
import { buildLcuAuthHeader, readActiveLockfile, requestLocalhostJson } from './lcuClient';

interface LocalSummonerIds {
  puuid?: string;
  summonerId?: number;
  accountId?: number;
}

async function fetchCurrentSummonerIds(
  port: number,
  authHeader: string,
): Promise<LocalSummonerIds> {
  const res = await requestLocalhostJson({
    port,
    urlPath: '/lol-summoner/v1/current-summoner',
    authHeader,
    timeoutMs: 2200,
  });
  if (!res.ok || !res.data || typeof res.data !== 'object') {
    return {};
  }
  const obj = res.data as Record<string, unknown>;
  return {
    puuid: typeof obj.puuid === 'string' ? obj.puuid : undefined,
    summonerId: typeof obj.summonerId === 'number' ? obj.summonerId : undefined,
    accountId: typeof obj.accountId === 'number' ? obj.accountId : undefined,
  };
}

export async function fetchLcuRecentMatches(params: {
  catalog: CatalogSnapshot;
  existingMatchIds: Set<string>;
}): Promise<{
  ok: boolean;
  matches?: LcuMatchListEntry[];
  error?: string;
}> {
  const lockfile = readActiveLockfile();
  if (!lockfile) {
    return {
      ok: false,
      error:
        'Cliente do League of Legends não encontrado aberto. Abra o cliente do LoL (não precisa estar em partida) e tente novamente.',
    };
  }

  const auth = buildLcuAuthHeader(lockfile);
  const localIds = await fetchCurrentSummonerIds(lockfile.port, auth);

  // Tenta o endpoint padrão do cliente atual e depois fallback por PUUID
  let historyRes = await requestLocalhostJson({
    port: lockfile.port,
    urlPath: '/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=15',
    authHeader: auth,
    timeoutMs: 4000,
  });

  if ((!historyRes.ok || !historyRes.data) && localIds.puuid) {
    historyRes = await requestLocalhostJson({
      port: lockfile.port,
      urlPath: `/lol-match-history/v1/products/lol/${encodeURIComponent(localIds.puuid)}/matches?begIndex=0&endIndex=15`,
      authHeader: auth,
      timeoutMs: 4000,
    });
  }

  if (!historyRes.ok || !historyRes.data) {
    return {
      ok: false,
      error:
        'Não foi possível ler o histórico no cliente do LoL (verifique se você está logado na tela principal do cliente).',
    };
  }

  const matches = parseLcuMatchList(
    historyRes.data,
    params.catalog,
    params.existingMatchIds,
    localIds,
  );

  if (matches.length === 0) {
    return {
      ok: false,
      error: 'Nenhuma partida recente válida (> 3 min) encontrada no histórico do cliente do LoL.',
    };
  }

  return { ok: true, matches };
}

export async function importLcuMatchById(params: {
  gameId: string;
  catalog: CatalogSnapshot;
  preferBlueAsTiebreaker?: boolean;
}): Promise<{
  ok: boolean;
  review?: ReviewMatch;
  error?: string;
}> {
  const lockfile = readActiveLockfile();
  if (!lockfile) {
    return {
      ok: false,
      error: 'Cliente do League of Legends não encontrado aberto.',
    };
  }

  const auth = buildLcuAuthHeader(lockfile);
  const encodedId = encodeURIComponent(params.gameId);

  const [localIds, gameRes, timelineRes] = await Promise.all([
    fetchCurrentSummonerIds(lockfile.port, auth),
    requestLocalhostJson({
      port: lockfile.port,
      urlPath: `/lol-match-history/v1/games/${encodedId}`,
      authHeader: auth,
      timeoutMs: 5000,
    }),
    requestLocalhostJson({
      port: lockfile.port,
      urlPath: `/lol-match-history/v1/game-timelines/${encodedId}`,
      authHeader: auth,
      timeoutMs: 5000,
    }),
  ]);

  if (!gameRes.ok || !gameRes.data || typeof gameRes.data !== 'object') {
    return {
      ok: false,
      error: `Não foi possível carregar os detalhes da partida #${params.gameId} no cliente do LoL.`,
    };
  }

  const rawTimeline =
    timelineRes.ok && timelineRes.data && typeof timelineRes.data === 'object'
      ? (timelineRes.data as Record<string, unknown>)
      : null;

  const review = convertLcuMatchToReview({
    rawGame: gameRes.data as Record<string, unknown>,
    rawTimeline,
    catalog: params.catalog,
    localIds,
    preferBlueAsTiebreaker: params.preferBlueAsTiebreaker,
  });

  if (!review) {
    return {
      ok: false,
      error: 'Falha ao converter os dados da partida para revisão.',
    };
  }

  return { ok: true, review };
}

export async function importLatestLcuMatch(params: {
  catalog: CatalogSnapshot;
  existingMatchIds: Set<string>;
  preferBlueAsTiebreaker?: boolean;
  preferSummonersRift?: boolean;
}): Promise<{
  ok: boolean;
  review?: ReviewMatch;
  error?: string;
}> {
  const listRes = await fetchLcuRecentMatches({
    catalog: params.catalog,
    existingMatchIds: params.existingMatchIds,
  });
  if (!listRes.ok || !listRes.matches || listRes.matches.length === 0) {
    return { ok: false, error: listRes.error ?? 'Nenhuma partida recente encontrada.' };
  }

  const candidate =
    params.preferSummonersRift !== false
      ? (listRes.matches.find((m) => m.mapId === 11) ?? listRes.matches[0])
      : listRes.matches[0];

  return importLcuMatchById({
    gameId: candidate.gameId,
    catalog: params.catalog,
    preferBlueAsTiebreaker: params.preferBlueAsTiebreaker,
  });
}
