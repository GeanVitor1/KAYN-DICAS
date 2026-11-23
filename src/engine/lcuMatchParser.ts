import type { LcuMatchListEntry } from '../shared/ipc';
import type {
  CatalogSnapshot,
  DraftSide,
  KaynFormChoice,
  LaneRole,
  ReviewEvent,
  ReviewLaneFocus,
  ReviewMatch,
  ReviewMatchStats,
} from '../shared/types';
import { getChampionTacticalProfile } from './championTactics';
import { analyzeDraft } from './draftAnalyzer';

const ALL_ROLES: LaneRole[] = ['top', 'jungle', 'mid', 'bot', 'support'];

const ARMOR_PEN_ITEMS = new Set(['3071', '6694', '3036', '3033', '3035']); // Cutelo, Serylda, Dominik, Lembrete Mortal, Último Sussurro
const ANTI_HEAL_ITEMS = new Set(['3123', '6609', '3075', '3076', '3033']); // Carrasco, Serrespada, Espinhos, Colete Espinhoso, Lembrete Mortal
const ANTI_SHIELD_ITEMS = new Set(['6695']); // Presa da Serpente

export function getQueueLabelPt(queueId: number): string {
  switch (queueId) {
    case 420:
      return 'Solo/Duo';
    case 440:
      return 'Flex';
    case 400:
      return 'Normal Alternada';
    case 430:
    case 490:
      return 'Normal';
    case 450:
      return 'ARAM';
    case 700:
      return 'Clash';
    default:
      return queueId > 0 ? `Fila #${queueId}` : 'Partida';
  }
}

export function classifySummonersRiftLane(pos?: { x?: number; y?: number } | null): ReviewLaneFocus {
  if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
    return 'jungle';
  }
  const { x, y } = pos;

  // Fosso do Dragão (~9866, 4414) e Fosso do Barão/Vastilarvas (~5007, 10471) + corredores do Rio
  const distDragon = Math.hypot(x - 9866, y - 4414);
  const distBaron = Math.hypot(x - 5007, y - 10471);
  if (distDragon <= 1850 || distBaron <= 1850) {
    return 'river';
  }

  // Bot lane (faixa inferior / direita do mapa)
  if ((x >= 8500 && y <= 4600) || (x >= 11200 && y <= 7000)) {
    return 'bot';
  }

  // Top lane (faixa superior / esquerda do mapa)
  if ((x <= 6200 && y >= 10200) || (x <= 3600 && y >= 7800)) {
    return 'top';
  }

  // Mid lane (diagonal central x ≈ y)
  if (Math.abs(x - y) <= 2100 && x >= 3500 && x <= 11500) {
    return 'mid';
  }

  // Rio (diagonal secundária x + y ≈ 14800)
  if (Math.abs(x + y - 14800) <= 1350 && x >= 3400 && x <= 11600) {
    return 'river';
  }

  return 'jungle';
}

export function evaluateMatchPlanComparison(params: {
  allies: DraftSide;
  enemies: DraftSide;
  ownedItemIds: string[];
  catalog: CatalogSnapshot;
  preferBlueAsTiebreaker?: boolean;
}): {
  recommendedForm: KaynFormChoice;
  planComparison: NonNullable<ReviewMatchStats['planComparison']>;
} {
  const analysis = analyzeDraft(
    {
      id: 'postgame-eval',
      name: 'Comparação Pós-Jogo',
      allies: params.allies,
      enemies: params.enemies,
      staticNotes: '',
      updatedAt: new Date().toISOString(),
    },
    params.catalog,
    { preferBlueAsTiebreaker: params.preferBlueAsTiebreaker ?? true },
  );

  const enemyIds = ALL_ROLES.map((r) => params.enemies[r]).filter((id): id is string => Boolean(id));
  const enemyProfiles = enemyIds
    .map((id) => getChampionTacticalProfile(id, params.catalog))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const enemyArmorCount = enemyProfiles.filter((p) => p.heavyArmorUser || p.isFrontline).length;
  const enemyHealingCount = enemyProfiles.filter((p) => p.heavyHealing).length;
  const enemyShieldCount = enemyProfiles.filter((p) => p.heavyShields).length;

  const builtSet = new Set(params.ownedItemIds);
  const missingCounterItems: string[] = [];

  if (enemyArmorCount >= 2 && !Array.from(builtSet).some((id) => ARMOR_PEN_ITEMS.has(id))) {
    missingCounterItems.push(
      analysis.recommendedForm === 'blue'
        ? 'Penetração de Armadura (Rancor de Serylda) contra 2+ frontlines/armadura'
        : 'Redução de Armadura (Cutelo Negro / Rancor de Serylda) contra 2+ frontlines/armadura',
    );
  }
  if (enemyHealingCount >= 2 && !Array.from(builtSet).some((id) => ANTI_HEAL_ITEMS.has(id))) {
    missingCounterItems.push('Anti-cura (Chamado do Carrasco / Serrespada Quimiopunk / Espinhos) contra 2+ fontes de cura');
  }
  if (enemyShieldCount >= 2 && !Array.from(builtSet).some((id) => ANTI_SHIELD_ITEMS.has(id))) {
    missingCounterItems.push('Anti-escudo (Presa da Serpente) contra composição com muitos escudos');
  }

  return {
    recommendedForm: analysis.recommendedForm,
    planComparison: {
      expectedFormLabel: analysis.recommendedFormLabel,
      enemyArmorCount,
      enemyHealingCount,
      enemyShieldCount,
      missingCounterItems,
    },
  };
}

function buildChampionKeyMap(catalog: CatalogSnapshot): Map<string, { id: string; name: string }> {
  const map = new Map<string, { id: string; name: string }>();
  for (const champ of Object.values(catalog.champions)) {
    map.set(String(champ.key), { id: champ.id, name: champ.name });
  }
  return map;
}

function normalizeLcuLane(timeline?: Record<string, unknown>, stats?: Record<string, unknown>): LaneRole | null {
  const lane = String(timeline?.lane ?? '').toUpperCase();
  const role = String(timeline?.role ?? '').toUpperCase();
  const teamPos = String(stats?.teamPosition ?? '').toUpperCase();
  const check = teamPos || lane;

  if (check === 'TOP') return 'top';
  if (check === 'JUNGLE') return 'jungle';
  if (check === 'MIDDLE' || check === 'MID') return 'mid';
  if (check === 'UTILITY' || role === 'DUO_SUPPORT' || role === 'SUPPORT') return 'support';
  if (check === 'BOTTOM' || check === 'BOT') {
    return role === 'DUO_SUPPORT' ? 'support' : 'bot';
  }
  return null;
}

function assignParticipantsToDraftSide(
  participants: Array<Record<string, unknown>>,
  champByKey: Map<string, { id: string; name: string }>,
): DraftSide {
  const side: DraftSide = {
    top: null,
    jungle: null,
    mid: null,
    bot: null,
    support: null,
  };
  const unassigned: string[] = [];

  for (const p of participants) {
    const champInfo = champByKey.get(String(p.championId ?? ''));
    if (!champInfo) continue;
    const role = normalizeLcuLane(
      p.timeline as Record<string, unknown> | undefined,
      p.stats as Record<string, unknown> | undefined,
    );
    if (role && !side[role]) {
      side[role] = champInfo.id;
    } else {
      unassigned.push(champInfo.id);
    }
  }

  for (const id of unassigned) {
    const open = ALL_ROLES.find((r) => !side[r]);
    if (open) side[open] = id;
  }

  return side;
}

function extractGamesArray(rawHistory: unknown): Array<Record<string, unknown>> {
  if (!rawHistory || typeof rawHistory !== 'object') return [];
  const root = rawHistory as Record<string, unknown>;
  if (Array.isArray(root.games)) {
    return root.games as Array<Record<string, unknown>>;
  }
  if (root.games && typeof root.games === 'object') {
    const nested = (root.games as Record<string, unknown>).games;
    if (Array.isArray(nested)) {
      return nested as Array<Record<string, unknown>>;
    }
  }
  return [];
}

function findLocalParticipant(
  game: Record<string, unknown>,
  localIds?: { puuid?: string; summonerId?: number; accountId?: number },
): Record<string, unknown> | null {
  const participants = Array.isArray(game.participants)
    ? (game.participants as Array<Record<string, unknown>>)
    : [];
  if (participants.length === 0) return null;
  if (participants.length === 1) return participants[0];

  const identities = Array.isArray(game.participantIdentities)
    ? (game.participantIdentities as Array<Record<string, unknown>>)
    : [];

  if (localIds && identities.length > 0) {
    const matchedIdentity = identities.find((ident) => {
      const player = (ident.player ?? {}) as Record<string, unknown>;
      return (
        (localIds.puuid && typeof player.puuid === 'string' && player.puuid === localIds.puuid) ||
        (localIds.summonerId && Number(player.summonerId) === localIds.summonerId) ||
        (localIds.accountId && Number(player.accountId) === localIds.accountId)
      );
    });
    if (matchedIdentity && typeof matchedIdentity.participantId === 'number') {
      const hit = participants.find((p) => p.participantId === matchedIdentity.participantId);
      if (hit) return hit;
    }
  }

  return participants[0];
}

export function parseLcuMatchList(
  rawHistory: unknown,
  catalog: CatalogSnapshot,
  existingMatchIds: Set<string>,
  localIds?: { puuid?: string; summonerId?: number; accountId?: number },
): LcuMatchListEntry[] {
  const games = extractGamesArray(rawHistory);
  const champByKey = buildChampionKeyMap(catalog);
  const results: LcuMatchListEntry[] = [];

  for (const g of games) {
    const gameId = String(g.gameId ?? '');
    if (!gameId) continue;
    const duration = Number(g.gameDuration ?? 0);
    if (duration < 180) continue; // Ignora remakes curtos (< 3 min)

    const me = findLocalParticipant(g, localIds);
    if (!me) continue;
    const stats = (me.stats ?? {}) as Record<string, unknown>;
    const champInfo = champByKey.get(String(me.championId ?? ''));
    const totalCs =
      Number(stats.totalMinionsKilled ?? 0) + Number(stats.neutralMinionsKilled ?? 0);
    const minutes = Math.max(1, duration / 60);
    const queueId = Number(g.queueId ?? 0);

    results.push({
      gameId,
      gameCreation: Number(g.gameCreation ?? 0),
      gameDurationSeconds: duration,
      queueId,
      queueLabel: getQueueLabelPt(queueId),
      mapId: Number(g.mapId ?? 11),
      championId: champInfo?.id ?? String(me.championId ?? 'Unknown'),
      championName: champInfo?.name ?? `Campeão #${String(me.championId ?? '?')}`,
      win: Boolean(stats.win),
      kills: Number(stats.kills ?? 0),
      deaths: Number(stats.deaths ?? 0),
      assists: Number(stats.assists ?? 0),
      totalCs,
      csPerMin: Math.round((totalCs / minutes) * 10) / 10,
      alreadyImported: existingMatchIds.has(`LCU_${gameId}`) || existingMatchIds.has(gameId),
    });
  }

  return results.sort((a, b) => b.gameCreation - a.gameCreation);
}

function monsterTypePt(monsterType: string, subType?: string): string {
  const m = monsterType.toUpperCase();
  if (m === 'DRAGON') {
    if (subType?.includes('ELDER')) return 'Dragão Ancião';
    return 'Dragão';
  }
  if (m === 'BARON_NASHOR') return 'Barão Na’Shor';
  if (m === 'RIFTHERALD') return 'Arauto do Vale';
  if (m === 'HORDE') return 'Vastilarvas';
  if (m === 'ATAKHAN') return 'Atakhan';
  return 'Objetivo épico';
}

export function convertLcuMatchToReview(params: {
  rawGame: Record<string, unknown>;
  rawTimeline?: Record<string, unknown> | null;
  catalog: CatalogSnapshot;
  localIds?: { puuid?: string; summonerId?: number; accountId?: number };
  preferBlueAsTiebreaker?: boolean;
}): ReviewMatch | null {
  const { rawGame, rawTimeline, catalog, localIds } = params;
  const gameId = String(rawGame.gameId ?? '');
  if (!gameId) return null;

  const champByKey = buildChampionKeyMap(catalog);
  const participants = Array.isArray(rawGame.participants)
    ? (rawGame.participants as Array<Record<string, unknown>>)
    : [];
  const me = findLocalParticipant(rawGame, localIds);
  if (!me) return null;

  const myPid = Number(me.participantId ?? 1);
  const myTeamId = Number(me.teamId ?? 100);
  const myStats = (me.stats ?? {}) as Record<string, unknown>;
  const durationSeconds = Math.max(1, Number(rawGame.gameDuration ?? 0));
  const durationMinutes = Math.max(1, durationSeconds / 60);

  const champInfo = champByKey.get(String(me.championId ?? ''));
  const championId = champInfo?.id ?? 'Kayn';
  const championName = champInfo?.name ?? 'Kayn';

  const allyParticipants = participants.filter((p) => Number(p.teamId ?? 100) === myTeamId);
  const enemyParticipants = participants.filter((p) => Number(p.teamId ?? 200) !== myTeamId);
  const allyPids = new Set(allyParticipants.map((p) => Number(p.participantId)));
  const enemyPids = new Set(enemyParticipants.map((p) => Number(p.participantId)));

  const champNameByPid = new Map<number, string>();
  for (const p of participants) {
    const pid = Number(p.participantId);
    const info = champByKey.get(String(p.championId ?? ''));
    if (info) champNameByPid.set(pid, info.name);
  }

  const allies = assignParticipantsToDraftSide(allyParticipants, champByKey);
  const enemies = assignParticipantsToDraftSide(enemyParticipants, champByKey);

  // Identifica o jungler inimigo para benchmark @10 e @15
  const enemyJgParticipant =
    enemyParticipants.find(
      (p) =>
        normalizeLcuLane(
          p.timeline as Record<string, unknown> | undefined,
          p.stats as Record<string, unknown> | undefined,
        ) === 'jungle',
    ) ??
    enemyParticipants.find((p) => Number(p.spell1Id) === 11 || Number(p.spell2Id) === 11) ??
    null;
  const enemyJgPid = enemyJgParticipant ? Number(enemyJgParticipant.participantId) : null;

  // Itens construídos (item0..item5, ignora trinket item6)
  const itemsBuilt: Array<{ itemId: string; name: string }> = [];
  for (let slot = 0; slot <= 5; slot += 1) {
    const rawId = Number(myStats[`item${slot}`] ?? 0);
    if (rawId > 0) {
      const id = String(rawId);
      itemsBuilt.push({
        itemId: id,
        name: catalog.items[id]?.name ?? `Item #${id}`,
      });
    }
  }

  const kills = Number(myStats.kills ?? 0);
  const deaths = Number(myStats.deaths ?? 0);
  const assists = Number(myStats.assists ?? 0);
  const teamKills = allyParticipants.reduce(
    (sum, p) => sum + Number(((p.stats ?? {}) as Record<string, unknown>).kills ?? 0),
    0,
  );
  const killParticipationPct =
    teamKills > 0 ? Math.min(100, Math.round(((kills + assists) / teamKills) * 100)) : null;

  const totalCs =
    Number(myStats.totalMinionsKilled ?? 0) + Number(myStats.neutralMinionsKilled ?? 0);
  const csPerMin = Math.round((totalCs / durationMinutes) * 10) / 10;
  const goldEarned = Number(myStats.goldEarned ?? 0);
  const goldPerMin = Math.round(goldEarned / durationMinutes);
  const damageToChampions =
    typeof myStats.totalDamageDealtToChampions === 'number'
      ? myStats.totalDamageDealtToChampions
      : null;
  const visionScore =
    typeof myStats.visionScore === 'number' ? myStats.visionScore : null;
  const level = Number(myStats.champLevel ?? 1);
  const win = Boolean(myStats.win);

  const objectives = {
    allyDragons: 0,
    enemyDragons: 0,
    allyGrubs: 0,
    enemyGrubs: 0,
    allyHeralds: 0,
    enemyHeralds: 0,
    allyBarons: 0,
    enemyBarons: 0,
  };

  // Processa timeline minuto a minuto (quando disponível)
  const frames = Array.isArray(rawTimeline?.frames)
    ? (rawTimeline!.frames as Array<Record<string, unknown>>)
    : [];

  const allTimelineEvents: Array<Record<string, unknown>> = [];
  for (const f of frames) {
    if (Array.isArray(f.events)) {
      for (const ev of f.events as Array<Record<string, unknown>>) {
        allTimelineEvents.push(ev);
      }
    }
  }

  // Benchmarks @10, @15 e maior janela sem farm
  let csAt10: number | null = null;
  let csAt15: number | null = null;
  let goldDiffAt10VsEnemyJg: number | null = null;
  let csDiffAt10VsEnemyJg: number | null = null;
  let goldDiffAt15VsEnemyJg: number | null = null;
  let csDiffAt15VsEnemyJg: number | null = null;

  const csByMinute: Array<{ minute: number; cs: number }> = [];
  for (let idx = 0; idx < frames.length; idx += 1) {
    const f = frames[idx];
    const pFrames = (f.participantFrames ?? {}) as Record<string, Record<string, unknown>>;
    const myFrame = pFrames[String(myPid)] ?? pFrames[myPid];
    if (!myFrame) continue;

    const myFrameCs =
      Number(myFrame.minionsKilled ?? 0) + Number(myFrame.jungleMinionsKilled ?? 0);
    const myFrameGold = Number(myFrame.totalGold ?? 0);
    csByMinute.push({ minute: idx, cs: myFrameCs });

    const enemyJgFrame =
      enemyJgPid !== null ? pFrames[String(enemyJgPid)] ?? pFrames[enemyJgPid] : null;
    const enemyJgCs = enemyJgFrame
      ? Number(enemyJgFrame.minionsKilled ?? 0) + Number(enemyJgFrame.jungleMinionsKilled ?? 0)
      : null;
    const enemyJgGold = enemyJgFrame ? Number(enemyJgFrame.totalGold ?? 0) : null;

    if (idx === 10) {
      csAt10 = myFrameCs;
      if (enemyJgCs !== null) csDiffAt10VsEnemyJg = myFrameCs - enemyJgCs;
      if (enemyJgGold !== null) goldDiffAt10VsEnemyJg = myFrameGold - enemyJgGold;
    }
    if (idx === 15) {
      csAt15 = myFrameCs;
      if (enemyJgCs !== null) csDiffAt15VsEnemyJg = myFrameCs - enemyJgCs;
      if (enemyJgGold !== null) goldDiffAt15VsEnemyJg = myFrameGold - enemyJgGold;
    }
  }

  // Detecta maior sequência consecutiva de minutos (entre min 3 e 25) com <= 3 CS ganhos por minuto
  let longestDry = 0;
  let longestRange: string | null = null;
  let curDry = 0;
  let curStart = 0;
  for (let i = 1; i < csByMinute.length; i += 1) {
    const m = csByMinute[i].minute;
    if (m < 4 || m > 26) {
      curDry = 0;
      continue;
    }
    const deltaCs = csByMinute[i].cs - csByMinute[i - 1].cs;
    if (deltaCs <= 3) {
      if (curDry === 0) curStart = m - 1;
      curDry += 1;
      if (curDry > longestDry) {
        longestDry = curDry;
        longestRange = `Min ${curStart}–${m}`;
      }
    } else {
      curDry = 0;
    }
  }

  const events: ReviewEvent[] = [];
  let seq = 1;
  let deathsBefore14 = 0;
  let killsAssistsBefore14 = 0;

  for (const ev of allTimelineEvents) {
    const evType = String(ev.type ?? '');
    const ts = Number(ev.timestamp ?? 0);
    const minute = Math.max(1, Math.round((ts / 60000) * 10) / 10);

    if (evType === 'ELITE_MONSTER_KILL') {
      const killerId = Number(ev.killerId ?? 0);
      const isAlly = allyPids.has(killerId);
      const mType = String(ev.monsterType ?? '');
      const mSub = typeof ev.monsterSubType === 'string' ? ev.monsterSubType : undefined;

      if (mType === 'DRAGON') {
        if (isAlly) objectives.allyDragons += 1;
        else objectives.enemyDragons += 1;
      } else if (mType === 'HORDE') {
        if (isAlly) objectives.allyGrubs += 1;
        else objectives.enemyGrubs += 1;
      } else if (mType === 'RIFTHERALD') {
        if (isAlly) objectives.allyHeralds += 1;
        else objectives.enemyHeralds += 1;
      } else if (mType === 'BARON_NASHOR') {
        if (isAlly) objectives.allyBarons += 1;
        else objectives.enemyBarons += 1;
      }

      if (isAlly) {
        const involved =
          killerId === myPid ||
          (Array.isArray(ev.assistingParticipantIds) &&
            (ev.assistingParticipantIds as number[]).includes(myPid));
        events.push({
          id: `lcu-ev-${seq++}`,
          minute,
          type: 'objective',
          lane: 'river',
          allyPrio: 'unknown',
          estimatedEnemyJungler: 'unknown',
          kaynHpPercent: null,
          resourcesReady: null,
          timeSpentSeconds: null,
          outcome: 'completed_objective',
          whatHappenedAfter: involved
            ? `${monsterTypePt(mType, mSub)} garantido com sua participação.`
            : `${monsterTypePt(mType, mSub)} garantido pela equipe.`,
          enemyResponseText:
            'Verifique no replay se o caçador adversário trocou por campos ou objetivo no lado oposto.',
          enemyResponseCertainty: 'hypothesis',
          executionNote: '',
          decisionContextSource: 'lcu_captured',
        });
      }
      continue;
    }

    if (evType === 'CHAMPION_KILL') {
      const killerId = Number(ev.killerId ?? 0);
      const victimId = Number(ev.victimId ?? 0);
      const assistsIds = Array.isArray(ev.assistingParticipantIds)
        ? (ev.assistingParticipantIds as number[])
        : [];

      const iKilled = killerId === myPid;
      const iAssisted = assistsIds.includes(myPid);
      const iDied = victimId === myPid;
      if (!iKilled && !iAssisted && !iDied) continue;

      const lane = classifySummonersRiftLane(
        ev.position as { x?: number; y?: number } | undefined,
      );

      if (iDied && minute <= 14) deathsBefore14 += 1;
      if ((iKilled || iAssisted) && minute <= 14) killsAssistsBefore14 += 1;

      // Verifica punição inimiga confirmada nos próximos 75s (objetivo épico ou torre)
      const nearbyEnemyObj = allTimelineEvents.find((other) => {
        const oTs = Number(other.timestamp ?? 0);
        if (oTs < ts || oTs > ts + 75000) return false;
        if (other.type === 'ELITE_MONSTER_KILL' && enemyPids.has(Number(other.killerId ?? 0))) {
          return true;
        }
        return false;
      });

      const nearbyEnemyTower = allTimelineEvents.find((other) => {
        const oTs = Number(other.timestamp ?? 0);
        if (oTs < ts || oTs > ts + 65000) return false;
        // BUILDING_KILL: teamId indica o time dono da torre destruída
        if (other.type === 'BUILDING_KILL' && Number(other.teamId ?? 0) === myTeamId) {
          return true;
        }
        return false;
      });

      let enemyResponseText =
        'Sem objetivo épico ou torre inimiga imediata confirmada nos 75s seguintes; confira no replay se perdeu campos da selva.';
      let enemyResponseCertainty: 'confirmed' | 'hypothesis' = 'hypothesis';

      if (nearbyEnemyObj) {
        const delay = Math.round((Number(nearbyEnemyObj.timestamp ?? ts) - ts) / 1000);
        const objName = monsterTypePt(
          String(nearbyEnemyObj.monsterType ?? ''),
          typeof nearbyEnemyObj.monsterSubType === 'string'
            ? nearbyEnemyObj.monsterSubType
            : undefined,
        );
        enemyResponseText = `Inimigo garantiu ${objName} ${delay}s após esse lance.`;
        enemyResponseCertainty = 'confirmed';
      } else if (nearbyEnemyTower && iDied) {
        const delay = Math.round((Number(nearbyEnemyTower.timestamp ?? ts) - ts) / 1000);
        enemyResponseText = `Inimigo derrubou torre aliada ${delay}s após sua morte.`;
        enemyResponseCertainty = 'confirmed';
      }

      if (iDied) {
        const killerName = champNameByPid.get(killerId) ?? 'adversário';
        const enemyCount = 1 + assistsIds.filter((id) => enemyPids.has(id)).length;
        const fightLabel =
          enemyCount === 1
            ? `morte solo (1v1) para ${killerName}`
            : `abatido por ${killerName} + ${enemyCount - 1} inimigo(s) (${enemyCount} envolvidos)`;
        const estimatedEnemyJungler =
          enemyJgPid !== null && (killerId === enemyJgPid || assistsIds.includes(enemyJgPid))
            ? lane === 'bot'
              ? 'bot_side'
              : lane === 'top'
                ? 'top_side'
                : lane === 'mid'
                  ? 'mid'
                  : 'unknown'
            : 'unknown';

        events.push({
          id: `lcu-ev-${seq++}`,
          minute,
          type: 'death',
          lane,
          allyPrio: 'unknown',
          estimatedEnemyJungler,
          kaynHpPercent: null,
          resourcesReady: null,
          timeSpentSeconds: null,
          outcome: 'died',
          whatHappenedAfter: `Registrado no cliente: ${fightLabel}.`,
          enemyResponseText,
          enemyResponseCertainty,
          executionNote:
            enemyCount === 1
              ? `Morte solo para ${killerName} — verifique se subestimou o duelo ou entrou sem cooldowns.`
              : `Cercado por ${enemyCount} inimigos — verifique se faltou visão ou leitura do jungler inimigo.`,
          decisionContextSource: 'lcu_captured',
        });
      } else {
        const victimName = champNameByPid.get(victimId) ?? 'inimigo';
        events.push({
          id: `lcu-ev-${seq++}`,
          minute,
          type: 'gank',
          lane,
          allyPrio: 'unknown',
          estimatedEnemyJungler: 'unknown',
          kaynHpPercent: null,
          resourcesReady: null,
          timeSpentSeconds: null,
          outcome: iKilled ? 'kill' : 'assist',
          whatHappenedAfter: iKilled
            ? `Abate confirmado em ${victimName}.`
            : `Assistência confirmada no abate de ${victimName}.`,
          enemyResponseText,
          enemyResponseCertainty,
          executionNote: '',
          decisionContextSource: 'lcu_captured',
        });
      }
    }
  }

  // Fallback para objetivos quando timeline não veio disponível
  if (frames.length === 0 && Array.isArray(rawGame.teams)) {
    for (const t of rawGame.teams as Array<Record<string, unknown>>) {
      const isAlly = Number(t.teamId ?? 0) === myTeamId;
      if (isAlly) {
        objectives.allyDragons = Number(t.dragonKills ?? 0);
        objectives.allyBarons = Number(t.baronKills ?? 0);
        objectives.allyHeralds = Number(t.riftHeraldKills ?? 0);
        objectives.allyGrubs = Number(t.hordeKills ?? 0);
      } else {
        objectives.enemyDragons = Number(t.dragonKills ?? 0);
        objectives.enemyBarons = Number(t.baronKills ?? 0);
        objectives.enemyHeralds = Number(t.riftHeraldKills ?? 0);
        objectives.enemyGrubs = Number(t.hordeKills ?? 0);
      }
    }
  }

  const { recommendedForm, planComparison } = evaluateMatchPlanComparison({
    allies,
    enemies,
    ownedItemIds: itemsBuilt.map((i) => i.itemId),
    catalog,
    preferBlueAsTiebreaker: params.preferBlueAsTiebreaker,
  });

  const queueId = Number(rawGame.queueId ?? 0);
  const queueLabel = getQueueLabelPt(queueId);
  const resultLabel = win ? 'Vitória' : 'Derrota';
  const durationMinRounded = Math.round(durationMinutes);
  const patchRaw = String(rawGame.gameVersion ?? catalog.patch);
  const patch = patchRaw.split('.').slice(0, 2).join('.') || catalog.patch;

  const matchStats: ReviewMatchStats = {
    capturedAt: new Date(Number(rawGame.gameCreation ?? Date.now())).toISOString(),
    captureSource: 'lcu_history',
    result: win ? 'win' : 'loss',
    durationSeconds,
    queueLabel,
    championId,
    championName,
    kills,
    deaths,
    assists,
    teamKills,
    killParticipationPct,
    totalCs,
    csPerMin,
    goldEarned,
    goldPerMin,
    damageToChampions,
    visionScore,
    level,
    itemsBuilt,
    allies,
    enemies,
    recommendedFormFromDraft: recommendedForm,
    objectives,
    earlyBenchmarks: {
      csAt10,
      csAt15,
      deathsBefore14,
      killsAssistsBefore14,
      longestFarmDrySpellMinutes: longestDry >= 3 ? longestDry : null,
      longestFarmDrySpellRange: longestDry >= 3 ? longestRange : null,
      goldDiffAt10VsEnemyJg,
      csDiffAt10VsEnemyJg,
      goldDiffAt15VsEnemyJg,
      csDiffAt15VsEnemyJg,
    },
    planComparison,
  };

  return {
    id: `review-lcu-${gameId}`,
    title: `${resultLabel} · ${championName} ${kills}/${deaths}/${assists} (${durationMinRounded}m · ${queueLabel})`,
    isExampleDemo: false,
    sourceLabel: 'Importado do Cliente LoL (LCU local + Timeline)',
    patch,
    rankContext: `${queueLabel} BR`,
    matchId: `LCU_${gameId}`,
    plannedForm: recommendedForm === 'red' ? 'red' : 'blue',
    actualFormMinute: null,
    actualFormChosen: null,
    events,
    playerSummaryNote:
      'Capturado direto do cliente local do LoL com timeline e coordenadas reais. Estado exato da wave e tempo parado no mato seguem editáveis manualmente se quiser revisar o replay.',
    matchStats,
  };
}
