import type {
  BuildItemRef,
  BuildRecommendation,
  CatalogSnapshot,
  DraftSide,
  LaneRole,
  LiveEnemyThreatItem,
  LiveItemSummary,
  LiveLolStatus,
  LiveMatchTelemetry,
} from '../shared/types';

export interface ParsedLockfile {
  processName: string;
  pid: number;
  port: number;
  password: string;
  protocol: string;
}

const ALL_ROLES: LaneRole[] = ['top', 'jungle', 'mid', 'bot', 'support'];

// Itens inimigos notáveis que afetam diretamente a escolha situacional do Kayn
const ARMOR_THREAT_ITEM_IDS = new Set([
  '3047', // Botas Galvanizadas de Aço
  '3075', // Armadura de Espinhos
  '3110', // Coração Congelado
  '3143', // Presságio de Randuin
  '3742', // Couraça do Defunto
  '3068', // Égide de Fogo Solar
  '3157', // Ampulheta de Zhonya
  '3026', // Anjo Guardião
  '6333', // Dança da Morte
  '3076', // Colete Espinhoso
  '3082', // Armadura do Vigia
  '6665', // Jak'Sho
  '2502', // Desespero Eterno
]);

const HEALING_THREAT_ITEM_IDS = new Set([
  '3153', // Espada do Rei Destruído
  '3072', // Sedenta por Sangue
  '3074', // Hidra Raivosa
  '6610', // Céu Dividido
  '3065', // Semblante Espiritual
  '3165', // Morellonomicon (não cura, ignorado)
  '6662', // Manopla (não cura)
  '6631', // Quebrapassos (não cura)
].filter((id) => !['3165', '6662', '6631'].includes(id)));

const SHIELD_THREAT_ITEM_IDS = new Set([
  '3053', // Sinal de Sterak
  '3156', // Mandíbula de Malmortius
  '6673', // Arco-escudo Imortal
  '3190', // Medalhão dos Solari de Ferro
  '3040', // Abraço de Seraph
  '3119', // Aproximação Invernal
  '3121', // Fimbulwinter
  '6692', // Eclipse
]);

export function parseLockfileContent(raw: string): ParsedLockfile | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':');
  if (parts.length < 5) return null;
  const [processName, pidStr, portStr, password, protocol] = parts;
  const pid = Number(pidStr);
  const port = Number(portStr);
  if (!Number.isInteger(pid) || !Number.isInteger(port) || port <= 0 || port > 65535 || !password) {
    return null;
  }
  return {
    processName,
    pid,
    port,
    password,
    protocol: protocol || 'https',
  };
}

function normalizeName(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizePosition(rawPos: unknown): LaneRole | null {
  if (typeof rawPos !== 'string') return null;
  const p = rawPos.trim().toLowerCase();
  if (p === 'top') return 'top';
  if (p === 'jungle' || p === 'jg') return 'jungle';
  if (p === 'middle' || p === 'mid') return 'mid';
  if (p === 'bottom' || p === 'bot' || p === 'adc') return 'bot';
  if (p === 'utility' || p === 'support' || p === 'sup') return 'support';
  return null;
}

function createChampionLookup(catalog: CatalogSnapshot): {
  byKey: Map<string, string>;
  byNormalized: Map<string, string>;
} {
  const byKey = new Map<string, string>();
  const byNormalized = new Map<string, string>();

  for (const champ of Object.values(catalog.champions)) {
    byKey.set(String(champ.key), champ.id);
    byNormalized.set(normalizeName(champ.id), champ.id);
    byNormalized.set(normalizeName(champ.name), champ.id);
  }
  // Aliases comuns da Live Client Data API
  byNormalized.set('wukong', 'MonkeyKing');
  byNormalized.set('renataglasc', 'Renata');
  byNormalized.set('nunuwillump', 'Nunu');
  byNormalized.set('nunuampwillump', 'Nunu');
  return { byKey, byNormalized };
}

function resolveChampionFromLivePlayer(
  player: Record<string, unknown>,
  lookup: ReturnType<typeof createChampionLookup>,
): string | null {
  const rawName = typeof player.rawChampionName === 'string' ? player.rawChampionName : '';
  if (rawName) {
    const cleaned = rawName.replace(/^game_character_displayname_/i, '');
    const hit = lookup.byNormalized.get(normalizeName(cleaned));
    if (hit) return hit;
  }
  const champName = typeof player.championName === 'string' ? player.championName : '';
  if (champName) {
    const hit = lookup.byNormalized.get(normalizeName(champName));
    if (hit) return hit;
  }
  return null;
}

function assignPlayersToSide(
  entries: Array<{ champId: string | null; role: LaneRole | null }>,
): DraftSide {
  const side: DraftSide = {
    top: null,
    jungle: null,
    mid: null,
    bot: null,
    support: null,
  };
  const unassigned: string[] = [];

  for (const entry of entries) {
    if (!entry.champId) continue;
    if (entry.role && !side[entry.role]) {
      side[entry.role] = entry.champId;
    } else {
      unassigned.push(entry.champId);
    }
  }

  for (const champId of unassigned) {
    const openRole = ALL_ROLES.find((r) => !side[r]);
    if (openRole) {
      side[openRole] = champId;
    }
  }

  return side;
}

/**
 * Converte a sessão oficial LCU (`/lol-champ-select/v1/session`) em DraftSide,
 * lendo APENAS IDs de campeões e posições atribuídas — nunca lê ou expõe nomes/PUUIDs
 * de jogadores (respeita 100% o anonimato do champion select).
 */
export function mapLcuSessionToLiveDraft(
  rawSession: unknown,
  catalog: CatalogSnapshot,
): LiveLolStatus['liveDraft'] {
  if (!rawSession || typeof rawSession !== 'object') return null;
  const session = rawSession as Record<string, unknown>;
  const myTeamRaw = Array.isArray(session.myTeam) ? (session.myTeam as Array<Record<string, unknown>>) : [];
  const theirTeamRaw = Array.isArray(session.theirTeam) ? (session.theirTeam as Array<Record<string, unknown>>) : [];

  if (myTeamRaw.length === 0 && theirTeamRaw.length === 0) return null;

  const { byKey } = createChampionLookup(catalog);
  const localCellId = typeof session.localPlayerCellId === 'number' ? session.localPlayerCellId : null;

  // Mapear picks em andamento nas actions (ex.: inimigo selecionando ou já travado)
  const actionChampByCell = new Map<number, number>();
  if (Array.isArray(session.actions)) {
    for (const group of session.actions) {
      if (!Array.isArray(group)) continue;
      for (const act of group as Array<Record<string, unknown>>) {
        if (act.type === 'pick' && typeof act.actorCellId === 'number' && typeof act.championId === 'number' && act.championId > 0) {
          actionChampByCell.set(act.actorCellId, act.championId);
        }
      }
    }
  }

  let localPlayerPosition: LaneRole | null = null;
  let localPlayerChampionId: string | null = null;

  const allyEntries = myTeamRaw.map((member) => {
    const cellId = typeof member.cellId === 'number' ? member.cellId : -1;
    const lockedId = typeof member.championId === 'number' && member.championId > 0 ? member.championId : 0;
    const intentId =
      typeof member.championPickIntent === 'number' && member.championPickIntent > 0
        ? member.championPickIntent
        : 0;
    const actionId = actionChampByCell.get(cellId) ?? 0;
    const numericId = lockedId || actionId || intentId;
    const champId = numericId > 0 ? (byKey.get(String(numericId)) ?? null) : null;
    const role = normalizePosition(member.assignedPosition);

    if (localCellId !== null && cellId === localCellId) {
      localPlayerPosition = role;
      localPlayerChampionId = champId;
    }

    return { champId, role };
  });

  const enemyEntries = theirTeamRaw.map((member) => {
    const cellId = typeof member.cellId === 'number' ? member.cellId : -1;
    const lockedId = typeof member.championId === 'number' && member.championId > 0 ? member.championId : 0;
    const actionId = actionChampByCell.get(cellId) ?? 0;
    const numericId = lockedId || actionId;
    const champId = numericId > 0 ? (byKey.get(String(numericId)) ?? null) : null;
    const role = normalizePosition(member.assignedPosition);
    return { champId, role };
  });

  const allies = assignPlayersToSide(allyEntries);
  const enemies = assignPlayersToSide(enemyEntries);

  const allyCount = ALL_ROLES.filter((r) => Boolean(allies[r])).length;
  const enemyCount = ALL_ROLES.filter((r) => Boolean(enemies[r])).length;

  return {
    allies,
    enemies,
    isMyTeamComplete: allyCount >= 5,
    revealedEnemiesCount: enemyCount,
    localPlayerPosition,
    localPlayerChampionId,
  };
}

/**
 * Converte o payload oficial da Riot Live Client Data API (`127.0.0.1:2999/liveclientdata/allgamedata`)
 * em composição real 5v5 + telemetria factual da partida atual.
 */
export function mapLiveClientDataToStatus(
  rawData: unknown,
  catalog: CatalogSnapshot,
): {
  liveDraft: NonNullable<LiveLolStatus['liveDraft']>;
  liveMatch: LiveMatchTelemetry;
} | null {
  if (!rawData || typeof rawData !== 'object') return null;
  const data = rawData as Record<string, unknown>;
  const activePlayer = (data.activePlayer ?? {}) as Record<string, unknown>;
  const allPlayers = Array.isArray(data.allPlayers)
    ? (data.allPlayers as Array<Record<string, unknown>>)
    : [];
  const gameData = (data.gameData ?? {}) as Record<string, unknown>;
  const eventsObj = (data.events ?? {}) as Record<string, unknown>;
  const events = Array.isArray(eventsObj.Events)
    ? (eventsObj.Events as Array<Record<string, unknown>>)
    : [];

  if (allPlayers.length === 0) return null;

  const lookup = createChampionLookup(catalog);

  // Identificar qual jogador em allPlayers é o jogador local (apenas em memória para saber ORDER vs CHAOS)
  const activeRiotId = typeof activePlayer.riotId === 'string' ? activePlayer.riotId.toLowerCase() : '';
  const activeGameName =
    typeof activePlayer.riotIdGameName === 'string' ? activePlayer.riotIdGameName.toLowerCase() : '';
  const activeSummoner =
    typeof activePlayer.summonerName === 'string' ? activePlayer.summonerName.toLowerCase() : '';

  const localPlayer =
    allPlayers.find((p) => {
      const pRiotId = typeof p.riotId === 'string' ? p.riotId.toLowerCase() : '';
      const pGameName = typeof p.riotIdGameName === 'string' ? p.riotIdGameName.toLowerCase() : '';
      const pSumm = typeof p.summonerName === 'string' ? p.summonerName.toLowerCase() : '';
      return (
        (activeRiotId && pRiotId === activeRiotId) ||
        (activeGameName && pGameName === activeGameName) ||
        (activeSummoner && pSumm === activeSummoner)
      );
    }) ?? allPlayers[0];

  const playerTeam: 'ORDER' | 'CHAOS' = localPlayer.team === 'CHAOS' ? 'CHAOS' : 'ORDER';
  const allyPlayers = allPlayers.filter((p) => (p.team === 'CHAOS' ? 'CHAOS' : 'ORDER') === playerTeam);
  const enemyPlayers = allPlayers.filter((p) => (p.team === 'CHAOS' ? 'CHAOS' : 'ORDER') !== playerTeam);

  const allies = assignPlayersToSide(
    allyPlayers.map((p) => ({
      champId: resolveChampionFromLivePlayer(p, lookup),
      role: normalizePosition(p.position),
    })),
  );
  const enemies = assignPlayersToSide(
    enemyPlayers.map((p) => ({
      champId: resolveChampionFromLivePlayer(p, lookup),
      role: normalizePosition(p.position),
    })),
  );

  const playerChampionId = resolveChampionFromLivePlayer(localPlayer, lookup);
  const playerChampionName =
    (playerChampionId ? catalog.champions[playerChampionId]?.name : null) ??
    String(localPlayer.championName ?? 'Kayn');
  const localPlayerPosition = normalizePosition(localPlayer.position);

  const stats = (activePlayer.championStats ?? {}) as Record<string, unknown>;
  const scores = (localPlayer.scores ?? {}) as Record<string, unknown>;

  const rawItems = Array.isArray(localPlayer.items)
    ? (localPlayer.items as Array<Record<string, unknown>>)
    : [];
  const ownedItems: LiveItemSummary[] = rawItems
    .filter((it) => typeof it.itemID === 'number' && it.itemID > 0)
    .map((it) => {
      const id = String(it.itemID);
      return {
        itemId: id,
        name: catalog.items[id]?.name ?? String(it.displayName ?? `Item #${id}`),
        count: Number(it.count ?? 1),
        slot: Number(it.slot ?? 0),
      };
    });

  // Inspecionar itens reais comprados pelos inimigos para alertas factuais de build
  const enemyItemThreats: LiveEnemyThreatItem[] = [];
  for (const enemy of enemyPlayers) {
    const enemyChampId = resolveChampionFromLivePlayer(enemy, lookup) ?? String(enemy.championName ?? 'Inimigo');
    const enemyChampName =
      (enemyChampId && catalog.champions[enemyChampId]?.name) || String(enemy.championName ?? enemyChampId);
    const eItems = Array.isArray(enemy.items) ? (enemy.items as Array<Record<string, unknown>>) : [];
    for (const it of eItems) {
      const itemId = String(it.itemID ?? '');
      if (!itemId) continue;
      let threat: LiveEnemyThreatItem['threat'] | null = null;
      if (ARMOR_THREAT_ITEM_IDS.has(itemId)) threat = 'armor';
      else if (HEALING_THREAT_ITEM_IDS.has(itemId)) threat = 'healing';
      else if (SHIELD_THREAT_ITEM_IDS.has(itemId)) threat = 'shields';

      if (threat) {
        enemyItemThreats.push({
          championId: enemyChampId,
          championName: enemyChampName,
          itemId,
          itemName: catalog.items[itemId]?.name ?? String(it.displayName ?? `Item #${itemId}`),
          threat,
        });
      }
    }
  }

  // Contar objetivos já abatidos nos eventos públicos da partida
  const allyNames = new Set(
    allyPlayers.flatMap((p) => [
      typeof p.summonerName === 'string' ? p.summonerName.toLowerCase() : '',
      typeof p.riotIdGameName === 'string' ? p.riotIdGameName.toLowerCase() : '',
    ]).filter(Boolean),
  );

  const objectivesTaken = {
    allyDragons: 0,
    enemyDragons: 0,
    allyBarons: 0,
    enemyBarons: 0,
    allyHeralds: 0,
    enemyHeralds: 0,
    allyGrubs: 0,
    enemyGrubs: 0,
  };

  for (const ev of events) {
    const evName = String(ev.EventName ?? '');
    const killer = String(ev.KillerName ?? '').toLowerCase();
    const isAlly = allyNames.has(killer);
    if (evName === 'DragonKill') {
      if (isAlly) objectivesTaken.allyDragons += 1;
      else objectivesTaken.enemyDragons += 1;
    } else if (evName === 'BaronKill') {
      if (isAlly) objectivesTaken.allyBarons += 1;
      else objectivesTaken.enemyBarons += 1;
    } else if (evName === 'HeraldKill') {
      if (isAlly) objectivesTaken.allyHeralds += 1;
      else objectivesTaken.enemyHeralds += 1;
    } else if (evName === 'HordeKill') {
      if (isAlly) objectivesTaken.allyGrubs += 1;
      else objectivesTaken.enemyGrubs += 1;
    }
  }

  return {
    liveDraft: {
      allies,
      enemies,
      isMyTeamComplete: ALL_ROLES.filter((r) => Boolean(allies[r])).length >= 5,
      revealedEnemiesCount: ALL_ROLES.filter((r) => Boolean(enemies[r])).length,
      localPlayerPosition,
      localPlayerChampionId: playerChampionId,
    },
    liveMatch: {
      gameTimeSeconds: Math.max(0, Math.floor(Number(gameData.gameTime ?? 0))),
      gameMode: String(gameData.gameMode ?? 'CLASSIC'),
      mapNumber: Number(gameData.mapNumber ?? 11),
      playerChampionId,
      playerChampionName,
      playerTeam,
      level: Number(activePlayer.level ?? localPlayer.level ?? 1),
      currentGold: Math.floor(Number(activePlayer.currentGold ?? 0)),
      currentHealth: Math.round(Number(stats.currentHealth ?? 0)),
      maxHealth: Math.round(Number(stats.maxHealth ?? 0)),
      kills: Number(scores.kills ?? 0),
      deaths: Number(scores.deaths ?? 0),
      assists: Number(scores.assists ?? 0),
      totalCreepScore: Number(scores.creepScore ?? 0),
      ownedItemIds: ownedItems.map((i) => i.itemId),
      ownedItems,
      enemyItemThreats,
      objectivesTaken,
    },
  };
}

export function formatGameClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export interface NextBuildStepInfo {
  nextItem: BuildItemRef | null;
  goldNeeded: number;
  canAffordNow: boolean;
  completedCoreCount: number;
}

export function computeNextBuildStep(
  build: BuildRecommendation,
  ownedItemIds: string[],
  currentGold: number,
): NextBuildStepInfo {
  const owned = new Set(ownedItemIds);
  const completedCoreCount = build.core.filter((c) => owned.has(c.id)).length;
  const nextItem = build.core.find((c) => c.availableInCatalog && !owned.has(c.id)) ?? null;
  if (!nextItem) {
    return {
      nextItem: null,
      goldNeeded: 0,
      canAffordNow: false,
      completedCoreCount,
    };
  }
  const goldNeeded = Math.max(0, nextItem.gold - Math.floor(currentGold));
  return {
    nextItem,
    goldNeeded,
    canAffordNow: goldNeeded === 0 && nextItem.gold > 0,
    completedCoreCount,
  };
}
