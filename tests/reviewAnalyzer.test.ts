import { describe, expect, it } from 'vitest';
import { DEMO_REVIEWS } from '../src/engine/demos';
import {
  analyzeReviewMatch,
  convertRiotMatchTimelineToDraftReview,
  parseAndValidateReviewJson,
  serializeReviewJson,
} from '../src/engine/reviewAnalyzer';

describe('Analisador de Revisão Pós-Jogo', () => {
  it('avalia gank sem kill que força feitiço como produtivo e destaca tentativas ruins na bot', () => {
    const review = DEMO_REVIEWS[0];
    const analysis = analyzeReviewMatch(review);

    expect(analysis.botAttemptsSummary.totalAttempts).toBe(3);
    expect(analysis.botAttemptsSummary.productiveSpellOrRecall).toBe(1);
    expect(analysis.botAttemptsSummary.wastedTempoOrDeaths).toBe(2);

    const min4 = analysis.perEvent.find((e) => e.minute === 4);
    expect(min4?.productiveWithoutKill).toBe(true);
    expect(min4?.decisionQuality).toBe('boa');

    const min6 = analysis.perEvent.find((e) => e.minute === 6);
    expect(min6?.enemyPunishCertaintyLabel).toContain('[HIPÓTESE]');

    const min8 = analysis.perEvent.find((e) => e.minute === 8);
    expect(min8?.enemyPunishCertaintyLabel).toContain('[CONFIRMADO]');
    expect(min8?.decisionQuality).toBe('ruim');

    expect(analysis.recurringPatterns.length).toBeGreaterThanOrEqual(1);
    expect(analysis.recurringPatterns.length).toBeLessThanOrEqual(3);
    expect(analysis.nextGamesFocus.length).toBeGreaterThan(15);
  });

  it('separa decisão boa pelas informações do momento de falha de execução mecânica', () => {
    const review = DEMO_REVIEWS[1];
    const analysis = analyzeReviewMatch(review);
    const min5 = analysis.perEvent.find((e) => e.minute === 5);

    expect(min5?.decisionQuality).toBe('boa');
    expect(min5?.executionQuality).toBe('falha_execucao');
    expect(min5?.plausibleAlternative.length).toBeGreaterThan(10);
    expect(min5?.alternativeTradeoff.length).toBeGreaterThan(10);
  });

  it('faz round-trip de export/import JSON e rejeita JSON inválido sem quebrar', () => {
    const json = serializeReviewJson(DEMO_REVIEWS[0]);
    const parsed = parseAndValidateReviewJson(json);
    expect(parsed.ok).toBe(true);
    expect(parsed.review?.events.length).toBe(DEMO_REVIEWS[0].events.length);

    expect(parseAndValidateReviewJson('{invalido').ok).toBe(false);
    expect(parseAndValidateReviewJson('{"foo": 123}').ok).toBe(false);
  });

  it('conversor Match-V5 opcional não inventa ganks nem tempo gasto e marca contexto como parcial/hipótese', () => {
    const draftReview = convertRiotMatchTimelineToDraftReview(
      {
        metadata: { matchId: 'BR1_999999999' },
        info: {
          gameVersion: '16.23.1.123',
          participants: [
            { puuid: 'p1', participantId: 2, championName: 'Kayn', teamId: 100 },
            { puuid: 'e1', participantId: 7, championName: 'LeeSin', teamId: 200 },
          ],
        },
      },
      {
        info: {
          frames: [
            {
              events: [
                {
                  type: 'CHAMPION_KILL',
                  timestamp: 8 * 60000,
                  killerId: 7,
                  victimId: 2,
                  position: { x: 11500, y: 3200 },
                },
                {
                  type: 'ELITE_MONSTER_KILL',
                  timestamp: 8 * 60000 + 25000,
                  killerId: 7,
                  monsterType: 'DRAGON',
                },
              ],
            },
          ],
        },
      },
      'p1',
    );

    expect(draftReview.events.length).toBe(1);
    const ev = draftReview.events[0];
    expect(ev.lane).toBe('bot');
    expect(ev.decisionContextSource).toBe('api_partial_hypothesis');
    expect(ev.allyPrio).toBe('unknown');
    expect(ev.timeSpentSeconds).toBeNull();
    expect(ev.enemyResponseCertainty).toBe('confirmed');

    const analysis = analyzeReviewMatch(draftReview);
    expect(analysis.perEvent[0].decisionQuality).toBe('indeterminada');
  });
});
