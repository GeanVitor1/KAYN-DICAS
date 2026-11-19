import { describe, expect, it } from 'vitest';
import { DEMO_TRAINING_SCENARIOS } from '../src/engine/demos';
import { analyzeTrainingScenario } from '../src/engine/trainingSimulator';
import type { TrainingScenario } from '../src/shared/types';

describe('Simulador de Treino de Decisões', () => {
  it('é determinístico para o mesmo cenário', () => {
    const s = DEMO_TRAINING_SCENARIOS[0];
    const r1 = analyzeTrainingScenario(s);
    const r2 = analyzeTrainingScenario(s);
    expect(r1).toEqual(r2);
  });

  it('cobre todos os 6 cenários mínimos e muda o veredito do Dragão quando a pressão das lanes muda', () => {
    // 1. Bot sem prio + suporte baixo + JG sumido -> NÃO começar Dragão mesmo com CS alto
    const c1 = analyzeTrainingScenario(DEMO_TRAINING_SCENARIOS[0]);
    expect(c1.preferredOption.optionId).not.toBe('start_objective');
    expect(c1.trapWarning).toBeTruthy();
    expect(c1.farmTempoNote).toContain('Selva: 28');
    expect(c1.farmTempoNote).toContain('CS de lane: 4');

    // 2. JG inimigo confirmado no Top + Mid e Bot livres -> Dragão aberto
    const c2 = analyzeTrainingScenario(DEMO_TRAINING_SCENARIOS[1]);
    expect(c2.preferredOption.optionId).toBe('start_objective');

    // Alterando apenas a pressão das lanes e posição do JG no cenário 2 muda o resultado
    const c2FlippedPrio: TrainingScenario = {
      ...DEMO_TRAINING_SCENARIOS[1],
      midPrio: 'enemy',
      botPrio: 'enemy',
      alliesCanMoveMid: 'no',
      alliesCanMoveBot: 'no',
      enemyJunglerPosition: 'unknown',
    };
    const c2FlippedRes = analyzeTrainingScenario(c2FlippedPrio);
    expect(c2FlippedRes.preferredOption.optionId).not.toBe('start_objective');

    // 3. Bot com setup aliado e inimigo avançado -> convergir Bot
    const c3 = analyzeTrainingScenario(DEMO_TRAINING_SCENARIOS[2]);
    expect(c3.preferredOption.optionId).toBe('gank_bot');
    expect(c3.preferredOption.abortConditions.length).toBeGreaterThan(0);

    // 4. Bot tentadora após tempo parado -> voltar para campos e evitar armadilha
    const c4 = analyzeTrainingScenario(DEMO_TRAINING_SCENARIOS[3]);
    expect(c4.preferredOption.optionId).toBe('farm_route');
    expect(c4.trapWarning).toBeTruthy();

    // 5. Ouro para componente antes do objetivo -> resetar
    const c5 = analyzeTrainingScenario(DEMO_TRAINING_SCENARIOS[4]);
    expect(c5.preferredOption.optionId).toBe('reset_spend_gold');

    // 6. Atrás no jogo e sem visão -> recuperar farm em vez de forçar orbes
    const c6 = analyzeTrainingScenario(DEMO_TRAINING_SCENARIOS[5]);
    expect(c6.preferredOption.optionId).toBe('farm_route');
  });

  it('gera decisões condicionais e separa fatos observados, hipóteses e dados desconhecidos quando há lacunas', () => {
    const partial: TrainingScenario = {
      ...DEMO_TRAINING_SCENARIOS[1],
      laneCs: null,
      jungleCampsCleared: null,
      botPrio: 'unknown',
      midPrio: 'unknown',
      enemyJunglerPosition: 'unknown',
      botSupportHpLow: 'unknown',
      alliesCanMoveBot: 'unknown',
    };
    const res = analyzeTrainingScenario(partial);
    expect(res.unknownFields.length).toBeGreaterThanOrEqual(4);
    expect(res.conditionalDecisions.length).toBeGreaterThanOrEqual(2);
    expect(res.workingHypotheses.length).toBeGreaterThan(0);
    expect(res.mostImpactfulUnknown.toLowerCase()).toContain('jungler');
  });
});
