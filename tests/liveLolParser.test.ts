import { describe, expect, it } from 'vitest';
import snapshotJson from '../src/data/ddragon-snapshot.json';
import { buildItemRecommendation } from '../src/engine/buildProfiles';
import {
  computeNextBuildStep,
  formatGameClock,
  mapLcuSessionToLiveDraft,
  mapLiveClientDataToStatus,
  parseLockfileContent,
} from '../src/engine/liveLolParser';
import type { CatalogSnapshot } from '../src/shared/types';

const catalog = snapshotJson as unknown as CatalogSnapshot;

describe('Integração ao vivo com League of Legends (LCU & Live Client Data)', () => {
  it('interpreta lockfile oficial do LeagueClient corretamente', () => {
    const parsed = parseLockfileContent('LeagueClient:12345:54321:secretToken123:https');
    expect(parsed).toEqual({
      processName: 'LeagueClient',
      pid: 12345,
      port: 54321,
      password: 'secretToken123',
      protocol: 'https',
    });
    expect(parseLockfileContent('invalido')).toBeNull();
  });

  it('mapeia Seleção de Campeões (LCU) usando apenas championId e posição (sem nomes/PUUIDs)', () => {
    const mockSession = {
      localPlayerCellId: 1,
      myTeam: [
        { cellId: 0, championId: 516, assignedPosition: 'top', summonerId: 99999 }, // Ornn
        { cellId: 1, championId: 141, assignedPosition: 'jungle', summonerId: 11111 }, // Kayn
        { cellId: 2, championId: 103, assignedPosition: 'middle' }, // Ahri
        { cellId: 3, championId: 145, assignedPosition: 'bottom' }, // Kai'Sa
        { cellId: 4, championId: 111, assignedPosition: 'utility' }, // Nautilus
      ],
      theirTeam: [
        { cellId: 5, championId: 126, assignedPosition: 'top' }, // Jayce
        { cellId: 6, championId: 104, assignedPosition: 'jungle' }, // Graves
        { cellId: 7, championId: 134, assignedPosition: 'middle' }, // Syndra
        { cellId: 8, championId: 222, assignedPosition: 'bottom' }, // Jinx
        { cellId: 9, championId: 0, assignedPosition: 'utility' }, // Ainda não escolhido
      ],
      actions: [],
    };

    const liveDraft = mapLcuSessionToLiveDraft(mockSession, catalog);
    expect(liveDraft).not.toBeNull();
    expect(liveDraft?.allies).toEqual({
      top: 'Ornn',
      jungle: 'Kayn',
      mid: 'Ahri',
      bot: 'Kaisa',
      support: 'Nautilus',
    });
    expect(liveDraft?.enemies.top).toBe('Jayce');
    expect(liveDraft?.enemies.jungle).toBe('Graves');
    expect(liveDraft?.enemies.mid).toBe('Syndra');
    expect(liveDraft?.enemies.bot).toBe('Jinx');
    expect(liveDraft?.enemies.support).toBeNull();
    expect(liveDraft?.revealedEnemiesCount).toBe(4);
    expect(liveDraft?.localPlayerChampionId).toBe('Kayn');
    expect(JSON.stringify(liveDraft)).not.toContain('99999');
  });

  it('mapeia partida ao vivo (Live Client Data), itens comprados, ouro e ameaças inimigas reais', () => {
    const mockAllGameData = {
      activePlayer: {
        riotId: 'Gean#BR1',
        level: 9,
        currentGold: 1650,
        championStats: { currentHealth: 1420, maxHealth: 1600 },
      },
      allPlayers: [
        { riotId: 'AllyTop#BR1', championName: 'Camille', rawChampionName: 'game_character_displayname_Camille', team: 'ORDER', position: 'TOP', level: 9, scores: { kills: 1, deaths: 1, assists: 2, creepScore: 90 }, items: [] },
        {
          riotId: 'Gean#BR1',
          championName: 'Kayn',
          rawChampionName: 'game_character_displayname_Kayn',
          team: 'ORDER',
          position: 'JUNGLE',
          level: 9,
          scores: { kills: 4, deaths: 1, assists: 3, creepScore: 86 },
          items: [{ itemID: 6692, displayName: 'Eclipse', count: 1, slot: 0 }],
        },
        { riotId: 'AllyMid#BR1', championName: 'Orianna', team: 'ORDER', position: 'MIDDLE', level: 9, scores: {}, items: [] },
        { riotId: 'AllyBot#BR1', championName: 'Ezreal', team: 'ORDER', position: 'BOTTOM', level: 8, scores: {}, items: [] },
        { riotId: 'AllySup#BR1', championName: 'Lulu', team: 'ORDER', position: 'UTILITY', level: 7, scores: {}, items: [] },
        {
          riotId: 'EnemyTop#BR1',
          championName: 'Ornn',
          team: 'CHAOS',
          position: 'TOP',
          level: 9,
          scores: {},
          items: [{ itemID: 3075, displayName: 'Armadura de Espinhos', count: 1, slot: 0 }],
        },
        { riotId: 'EnemyJg#BR1', championName: 'Sejuani', team: 'CHAOS', position: 'JUNGLE', level: 8, scores: {}, items: [] },
        { riotId: 'EnemyMid#BR1', championName: 'Sylas', team: 'CHAOS', position: 'MIDDLE', level: 9, scores: {}, items: [] },
        { riotId: 'EnemyBot#BR1', championName: 'Xayah', team: 'CHAOS', position: 'BOTTOM', level: 8, scores: {}, items: [] },
        { riotId: 'EnemySup#BR1', championName: 'Alistar', team: 'CHAOS', position: 'UTILITY', level: 7, scores: {}, items: [] },
      ],
      gameData: { gameTime: 742, gameMode: 'CLASSIC', mapNumber: 11 },
      events: {
        Events: [{ EventName: 'DragonKill', KillerName: 'Gean' }],
      },
    };

    const mapped = mapLiveClientDataToStatus(mockAllGameData, catalog);
    expect(mapped).not.toBeNull();
    expect(mapped?.liveDraft.allies.jungle).toBe('Kayn');
    expect(mapped?.liveDraft.enemies.top).toBe('Ornn');
    expect(mapped?.liveMatch.currentGold).toBe(1650);
    expect(mapped?.liveMatch.totalCreepScore).toBe(86);
    expect(mapped?.liveMatch.ownedItemIds).toContain('6692');
    expect(mapped?.liveMatch.enemyItemThreats.some((t) => t.championId === 'Ornn' && t.threat === 'armor')).toBe(true);
    expect(formatGameClock(mapped!.liveMatch.gameTimeSeconds)).toBe('12:22');

    // Próximo item da build de Rhaast após já ter Eclipse (6692) deve ser Cutelo Negro (3071)
    const redBuild = buildItemRecommendation('red', [], catalog);
    const step = computeNextBuildStep(redBuild, mapped!.liveMatch.ownedItemIds, mapped!.liveMatch.currentGold);
    expect(step.completedCoreCount).toBe(1);
    expect(step.nextItem?.id).toBe('3071');
    expect(step.goldNeeded).toBeGreaterThan(0);
  });
});
