import { describe, expect, it } from 'vitest';
import snapshotJson from '../src/data/ddragon-snapshot.json';
import { DEMO_DRAFTS, DEMO_REVIEWS, DEMO_TRAINING_SCENARIOS } from '../src/engine/demos';
import { analyzeDraft, createFrozenCardFromAnalysis } from '../src/engine/draftAnalyzer';
import { analyzeReviewMatch } from '../src/engine/reviewAnalyzer';
import { CURATED_STUDY_LESSONS } from '../src/engine/studyLibrary';
import {
  buildTacticalRulesFromLessons,
  matchRulesForReviewEvent,
  matchRulesForTrainingScenario,
  selectPreGameReminders,
} from '../src/engine/tacticalMemory';
import { analyzeTrainingScenario } from '../src/engine/trainingSimulator';
import type { CatalogSnapshot } from '../src/shared/types';

const catalog = snapshotJson as unknown as CatalogSnapshot;

describe('Memória Tática Local (Pré-jogo, Treino, Revisão e Cartão)', () => {
  it('converte lições prontas de CaiozeraLoL e Karasmai em regras táticas curtas sem incluir pendentes', () => {
    const rules = buildTacticalRulesFromLessons(CURATED_STUDY_LESSONS);
    expect(rules.length).toBeGreaterThanOrEqual(8);
    expect(rules.every((r) => r.verificationStatus !== 'pending_curation')).toBe(true);

    const botRule = rules.find((r) => r.lessonId === 'caiozera-macro-bot-abort-river');
    expect(botRule).toBeDefined();
    expect(botRule?.actionTitle).toBe('Quando desistir da Bot');
    expect(botRule?.signals.length).toBeLessThanOrEqual(3);
    expect(botRule?.changePlanCondition.toLowerCase()).toContain('rio');
    expect(botRule?.uncertaintyNote?.toLowerCase()).toContain('incerta');
  });

  it('alimenta o pré-jogo e o cartão estático respeitando lembretes fixados e correções do jogador', () => {
    const rules = buildTacticalRulesFromLessons(CURATED_STUDY_LESSONS);
    const analysis = analyzeDraft(DEMO_DRAFTS.red, catalog, { preferBlueAsTiebreaker: true });

    const reminders = selectPreGameReminders(
      analysis,
      rules,
      ['rule-caiozera-macro-bot-abort-river'],
      { 'rule-caiozera-macro-bot-abort-river': 'Minha regra: Bot na torre? Volte aos campos.' },
    );

    expect(reminders.length).toBeGreaterThanOrEqual(2);
    expect(reminders[0].text).toBe('Minha regra: Bot na torre? Volte aos campos.');
    expect(reminders[0].isPinnedByUser).toBe(true);

    const card = createFrozenCardFromAnalysis(
      DEMO_DRAFTS.red,
      analysis,
      [],
      reminders.map((r) => ({ ruleId: r.ruleId, text: r.text, watchCondition: r.watchCondition })),
    );
    expect(card.selectedTacticalReminders?.[0].text).toBe(
      'Minha regra: Bot na torre? Volte aos campos.',
    );
    expect(card.runesVisual?.keystone.name).toBe('Conquistador');
    expect(card.buildVisual?.core.length).toBe(3);
  });

  it('cruza regras táticas com cenários do Treino e eventos da Revisão', () => {
    const rules = buildTacticalRulesFromLessons(CURATED_STUDY_LESSONS);

    // Cenário da lição do CaiozeraLoL
    const caioScenario = DEMO_TRAINING_SCENARIOS.find(
      (s) => s.id === 'train-lesson-caiozera-bot-river',
    )!;
    const trainAnalysis = analyzeTrainingScenario(caioScenario);
    const matchedTrain = matchRulesForTrainingScenario(caioScenario, trainAnalysis, rules);
    expect(matchedTrain.some((r) => r.lessonId === 'caiozera-macro-bot-abort-river')).toBe(true);

    // Evento ruim na Bot na Revisão
    const review = DEMO_REVIEWS[0];
    const reviewAnalysis = analyzeReviewMatch(review);
    const badBotEvent = review.events.find((e) => e.minute === 6)!;
    const badBotAnalysis = reviewAnalysis.perEvent.find((a) => a.eventId === badBotEvent.id)!;
    const matchedRev = matchRulesForReviewEvent(badBotEvent, badBotAnalysis, rules);
    expect(matchedRev?.lessonId).toBe('caiozera-macro-bot-abort-river');
  });
});
