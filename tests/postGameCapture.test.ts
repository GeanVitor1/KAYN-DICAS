import { describe, expect, it } from 'vitest';
import snapshotJson from '../src/data/ddragon-snapshot.json';
import {
  classifySummonersRiftLane,
  convertLcuMatchToReview,
  parseLcuMatchList,
} from '../src/engine/lcuMatchParser';
import { LiveMatchRecorder } from '../src/engine/liveMatchRecorder';
import {
  analyzeReviewMatch,
  parseAndValidateReviewJson,
  serializeReviewJson,
} from '../src/engine/reviewAnalyzer';
import type { CatalogSnapshot } from '../src/shared/types';

const catalog = snapshotJson as unknown as CatalogSnapshot;

describe('Gravação Automática Pós-Jogo (LiveMatchRecorder)', () => {
  it('grava partida ao vivo completa, detecta morte antes de Dragão, seca de farm e gera diagnóstico real', () => {
    const recorder = new LiveMatchRecorder();

    const makePayload = (
      gameTime: number,
      opts: {
        cs: number;
        hp: number;
        kills: number;
        deaths: number;
        assists: number;
        events: Array<Record<string, unknown>>;
      },
    ) => ({
      activePlayer: {
        riotId: 'Gean#BR1',
        riotIdGameName: 'Gean',
        level: Math.min(18, Math.max(1, Math.floor(gameTime / 110) + 1)),
        currentGold: 1100,
        championStats: { currentHealth: opts.hp, maxHealth: 1000 },
      },
      allPlayers: [
        {
          riotId: 'Gean#BR1',
          riotIdGameName: 'Gean',
          summonerName: 'Gean',
          championName: 'Kayn',
          rawChampionName: 'game_character_displayname_Kayn',
          team: 'ORDER',
          position: 'JUNGLE',
          level: 11,
          scores: {
            kills: opts.kills,
            deaths: opts.deaths,
            assists: opts.assists,
            creepScore: opts.cs,
          },
          items: [
            { itemID: 6697, displayName: 'Húbris', count: 1, slot: 0 },
            { itemID: 3142, displayName: 'Youmuu', count: 1, slot: 1 },
          ],
        },
        {
          riotId: 'AllyTop#BR1',
          summonerName: 'AllyTop',
          championName: 'Garen',
          team: 'ORDER',
          position: 'TOP',
          scores: { kills: 2, deaths: 3, assists: 1, creepScore: 140 },
          items: [],
        },
        {
          riotId: 'EnemyJg#BR1',
          summonerName: 'EnemyJg',
          championName: 'LeeSin',
          team: 'CHAOS',
          position: 'JUNGLE',
          scores: { kills: 6, deaths: 1, assists: 5, creepScore: 150 },
          items: [],
        },
        {
          riotId: 'EnemyTop#BR1',
          summonerName: 'EnemyTop',
          championName: 'Aatrox',
          team: 'CHAOS',
          position: 'TOP',
          scores: { kills: 4, deaths: 1, assists: 2, creepScore: 160 },
          items: [],
        },
        {
          riotId: 'EnemyMid#BR1',
          summonerName: 'EnemyMid',
          championName: 'Sylas',
          team: 'CHAOS',
          position: 'MIDDLE',
          scores: { kills: 3, deaths: 2, assists: 4, creepScore: 155 },
          items: [],
        },
      ],
      gameData: { gameTime, gameMode: 'CLASSIC', mapNumber: 11 },
      events: { Events: opts.events },
    });

    // Simula amostras por minuto com janela de 4 min sem farmar (Min 6..10)
    const csSeries: Array<[number, number, number]> = [
      [240, 28, 900],
      [300, 36, 850],
      [360, 44, 800],
      [420, 45, 420], // baixa vida antes da morte aos 7m15s (435s)
      [480, 46, 950],
      [540, 47, 900],
      [600, 48, 880], // CS@10 = 48 (baixo!)
      [900, 88, 920],
    ];
    for (const [sec, cs, hp] of csSeries) {
      recorder.ingestLivePayload(
        makePayload(sec, { cs, hp, kills: 1, deaths: 2, assists: 1, events: [] }),
        catalog,
      );
    }

    const endRes = recorder.ingestLivePayload(
      makePayload(1440, {
        cs: 120, // 5.0 CS/min em 24m
        hp: 0,
        kills: 2,
        deaths: 5,
        assists: 2,
        events: [
          {
            EventName: 'ChampionKill',
            EventTime: 435, // 7.3 min
            KillerName: 'EnemyJg',
            VictimName: 'Gean',
            Assisters: ['EnemyMid'],
          },
          {
            EventName: 'DragonKill',
            EventTime: 465, // 30s após a morte do Kayn!
            KillerName: 'EnemyJg',
          },
          {
            EventName: 'ChampionKill',
            EventTime: 560, // 9.3 min (sequência de mortes <= 3 min!)
            KillerName: 'EnemyTop',
            VictimName: 'Gean',
            Assisters: [],
          },
          {
            EventName: 'ChampionKill',
            EventTime: 780, // 13 min (3ª morte antes dos 14m)
            KillerName: 'EnemyJg',
            VictimName: 'Gean',
            Assisters: [],
          },
          {
            EventName: 'DragonKill',
            EventTime: 820,
            KillerName: 'EnemyJg',
          },
          {
            EventName: 'DragonKill',
            EventTime: 1180,
            KillerName: 'EnemyJg',
          },
          {
            EventName: 'GameEnd',
            EventTime: 1440,
            Result: 'Lose',
          },
        ],
      }),
      catalog,
    );

    expect(endRes.gameEndedNow).toBe(true);
    const review = recorder.finalizeMatch(catalog);
    expect(review).not.toBeNull();
    expect(review?.isExampleDemo).toBe(false);
    expect(review?.matchStats?.result).toBe('loss');
    expect(review?.matchStats?.csPerMin).toBe(5);
    expect(review?.matchStats?.earlyBenchmarks?.csAt10).toBe(48);
    expect(review?.matchStats?.earlyBenchmarks?.longestFarmDrySpellMinutes).toBeGreaterThanOrEqual(3);
    // Nunca persiste nomes de invocador/Riot IDs
    expect(JSON.stringify(review)).not.toContain('Gean#BR1');
    expect(JSON.stringify(review)).not.toContain('EnemyJg');

    const analysis = analyzeReviewMatch(review!);
    expect(analysis.diagnostic).toBeDefined();
    expect(analysis.diagnostic!.deathBreakdown.deathsBeforeObjective).toBeGreaterThanOrEqual(1);
    expect(analysis.diagnostic!.deathBreakdown.earlyDeaths).toBe(3);
    expect(analysis.diagnostic!.deathBreakdown.deathStreaks.length).toBeGreaterThanOrEqual(1);
    expect(analysis.diagnostic!.topMistakes.some((m) => m.id === 'diag-death-before-obj')).toBe(true);
    expect(analysis.diagnostic!.topMistakes.some((m) => m.id === 'diag-early-deaths')).toBe(true);
    expect(analysis.diagnostic!.topMistakes.some((m) => m.id === 'diag-low-cs')).toBe(true);
    expect(analysis.diagnostic!.grade === 'C' || analysis.diagnostic!.grade === 'D').toBe(true);

    // Round-trip JSON preserva matchStats
    const roundTrip = parseAndValidateReviewJson(serializeReviewJson(review!));
    expect(roundTrip.ok).toBe(true);
    expect(roundTrip.review?.matchStats?.result).toBe('loss');
    expect(roundTrip.review?.matchStats?.csPerMin).toBe(5);
  });

  it('ignora partidas muito curtas (< 120s / remake)', () => {
    const recorder = new LiveMatchRecorder();
    recorder.ingestLivePayload(
      {
        activePlayer: { riotId: 'Gean#BR1', level: 1, currentGold: 500, championStats: {} },
        allPlayers: [
          { riotId: 'Gean#BR1', championName: 'Kayn', team: 'ORDER', position: 'JUNGLE', scores: {}, items: [] },
        ],
        gameData: { gameTime: 90, gameMode: 'CLASSIC', mapNumber: 11 },
        events: { Events: [] },
      },
      catalog,
    );
    expect(recorder.finalizeMatch(catalog)).toBeNull();
  });
});

describe('Importador Direto do Histórico LCU (Zero Chave API)', () => {
  it('classifica coordenadas de Summoner’s Rift em Bot, Top, Mid, Rio (Dragão/Barão) e Selva', () => {
    expect(classifySummonersRiftLane({ x: 12500, y: 2200 })).toBe('bot');
    expect(classifySummonersRiftLane({ x: 2200, y: 12600 })).toBe('top');
    expect(classifySummonersRiftLane({ x: 7400, y: 7400 })).toBe('mid');
    expect(classifySummonersRiftLane({ x: 9860, y: 4410 })).toBe('river'); // Dragão
    expect(classifySummonersRiftLane({ x: 5000, y: 10470 })).toBe('river'); // Barão/Vastilarvas
    expect(classifySummonersRiftLane({ x: 7800, y: 3100 })).toBe('jungle'); // Selva bot azul
  });

  it('lista partidas do LCU, converte timeline com diff vs JG inimigo e diagnostica erros por rota', () => {
    const rawHistory = {
      games: {
        games: [
          {
            gameId: 77712345,
            gameCreation: Date.now() - 600000,
            gameDuration: 1560, // 26 min
            queueId: 420,
            mapId: 11,
            participants: [
              {
                participantId: 1,
                championId: 141, // Kayn
                stats: {
                  win: false,
                  kills: 3,
                  deaths: 6,
                  assists: 4,
                  totalMinionsKilled: 15,
                  neutralMinionsKilled: 135,
                },
              },
            ],
          },
        ],
      },
    };

    const list = parseLcuMatchList(rawHistory, catalog, new Set());
    expect(list.length).toBe(1);
    expect(list[0].championId).toBe('Kayn');
    expect(list[0].queueLabel).toBe('Solo/Duo');
    expect(list[0].win).toBe(false);

    const rawGame = {
      gameId: 77712345,
      gameCreation: Date.now() - 600000,
      gameDuration: 1560,
      queueId: 420,
      gameVersion: '16.23.1.555',
      participantIdentities: [
        { participantId: 2, player: { puuid: 'my-local-puuid', summonerName: 'SecretLocalPlayer' } },
        { participantId: 7, player: { puuid: 'enemy-jg-puuid', summonerName: 'EnemySecretName' } },
      ],
      participants: [
        { participantId: 1, teamId: 100, championId: 516, timeline: { lane: 'TOP' }, stats: { kills: 2, deaths: 3, assists: 4 } },
        {
          participantId: 2,
          teamId: 100,
          championId: 141, // Kayn
          timeline: { lane: 'JUNGLE' },
          stats: {
            win: false,
            kills: 3,
            deaths: 6,
            assists: 4,
            totalMinionsKilled: 16,
            neutralMinionsKilled: 130,
            goldEarned: 9200,
            totalDamageDealtToChampions: 14500,
            visionScore: 9,
            champLevel: 13,
            item0: 6692, // Eclipse
            item1: 3047, // Botas
            item2: 6333, // Dança da Morte (sem Cutelo nem anti-cura contra Aatrox/Soraka/Ornn)
          },
        },
        { participantId: 3, teamId: 100, championId: 103, timeline: { lane: 'MIDDLE' }, stats: { kills: 4, deaths: 4, assists: 3 } },
        { participantId: 4, teamId: 100, championId: 145, timeline: { lane: 'BOTTOM', role: 'DUO_CARRY' }, stats: { kills: 3, deaths: 5, assists: 2 } },
        { participantId: 5, teamId: 100, championId: 111, timeline: { lane: 'BOTTOM', role: 'DUO_SUPPORT' }, stats: { kills: 1, deaths: 6, assists: 7 } },
        // Inimigos com muita cura + armadura
        { participantId: 6, teamId: 200, championId: 266, timeline: { lane: 'TOP' }, stats: { kills: 5 } }, // Aatrox
        { participantId: 7, teamId: 200, championId: 64, timeline: { lane: 'JUNGLE' }, stats: { kills: 8 } }, // Lee Sin
        { participantId: 8, teamId: 200, championId: 517, timeline: { lane: 'MIDDLE' }, stats: { kills: 4 } }, // Sylas
        { participantId: 9, teamId: 200, championId: 222, timeline: { lane: 'BOTTOM', role: 'DUO_CARRY' }, stats: { kills: 5 } }, // Jinx
        { participantId: 10, teamId: 200, championId: 16, timeline: { lane: 'BOTTOM', role: 'DUO_SUPPORT' }, stats: { kills: 1 } }, // Soraka
      ],
    };

    const frames = Array.from({ length: 16 }, (_, min) => ({
      timestamp: min * 60000,
      participantFrames: {
        '2': {
          minionsKilled: min,
          jungleMinionsKilled: min <= 10 ? min * 5 : 50 + (min - 10) * 4,
          totalGold: 500 + min * 320,
        },
        '7': {
          minionsKilled: min,
          jungleMinionsKilled: min * 7,
          totalGold: 500 + min * 430,
        },
      },
      events:
        min === 6
          ? [
              {
                type: 'CHAMPION_KILL',
                timestamp: 6 * 60000 + 10000,
                killerId: 7,
                victimId: 2,
                assistingParticipantIds: [9, 10],
                position: { x: 12400, y: 2400 }, // Bot!
              },
            ]
          : min === 8
            ? [
                {
                  type: 'CHAMPION_KILL',
                  timestamp: 8 * 60000 + 20000,
                  killerId: 9,
                  victimId: 2,
                  assistingParticipantIds: [7, 10],
                  position: { x: 12100, y: 2700 }, // 2ª morte na Bot!
                },
                {
                  type: 'ELITE_MONSTER_KILL',
                  timestamp: 8 * 60000 + 55000,
                  killerId: 7,
                  monsterType: 'DRAGON',
                },
              ]
            : [],
    }));

    const review = convertLcuMatchToReview({
      rawGame,
      rawTimeline: { frames },
      catalog,
      localIds: { puuid: 'my-local-puuid' },
    });

    expect(review).not.toBeNull();
    expect(review?.matchStats?.earlyBenchmarks?.csDiffAt15VsEnemyJg).toBeLessThan(-15);
    expect(review?.matchStats?.earlyBenchmarks?.goldDiffAt15VsEnemyJg).toBeLessThan(-1000);
    expect(review?.matchStats?.planComparison?.missingCounterItems.length).toBeGreaterThanOrEqual(1);
    // Privacidade: zero nomes/PUUIDs persistidos
    expect(JSON.stringify(review)).not.toContain('SecretLocalPlayer');
    expect(JSON.stringify(review)).not.toContain('EnemySecretName');
    expect(JSON.stringify(review)).not.toContain('my-local-puuid');

    const analysis = analyzeReviewMatch(review!);
    expect(analysis.diagnostic?.deathBreakdown.deathsByLane.bot).toBe(2);
    expect(analysis.diagnostic?.topMistakes.some((m) => m.id === 'diag-lane-deaths-bot')).toBe(true);
    expect(analysis.diagnostic?.topMistakes.some((m) => m.id === 'diag-behind-enemy-jg')).toBe(true);
    expect(analysis.diagnostic?.topMistakes.some((m) => m.id === 'diag-death-before-obj')).toBe(true);
  });
});
