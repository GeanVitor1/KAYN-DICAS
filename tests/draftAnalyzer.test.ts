import { describe, expect, it } from 'vitest';
import snapshotJson from '../src/data/ddragon-snapshot.json';
import { DEMO_DRAFTS, createEmptyDraft } from '../src/engine/demos';
import {
  analyzeDraft,
  createFrozenCardFromAnalysis,
} from '../src/engine/draftAnalyzer';
import { classifyChampionOrbType } from '../src/engine/kaynMechanics';
import type { CatalogSnapshot, DraftState } from '../src/shared/types';

const catalog = snapshotJson as unknown as CatalogSnapshot;

describe('Motor de Análise de Draft (Kayn Jungle)', () => {
  it('recomenda Kayn Azul no demo favorável ao Azul e Rhaast no demo favorável ao Rhaast', () => {
    const blueRes = analyzeDraft(DEMO_DRAFTS.blue, catalog, {
      preferBlueAsTiebreaker: false,
    });
    expect(blueRes.recommendedForm).toBe('blue');
    expect(blueRes.confidence.level).toBe('alta');
    expect(blueRes.runes.primaryTreeName).toBe('Dominação');

    const redRes = analyzeDraft(DEMO_DRAFTS.red, catalog, {
      preferBlueAsTiebreaker: false,
    });
    expect(redRes.recommendedForm).toBe('red');
    expect(redRes.runes.primaryTreeName).toBe('Precisão');
  });

  it('NUNCA mascara um draft claramente favorável ao Rhaast quando preferência pelo Azul está ativada', () => {
    const redWithBluePref = analyzeDraft(DEMO_DRAFTS.red, catalog, {
      preferBlueAsTiebreaker: true,
    });
    expect(redWithBluePref.recommendedForm).toBe('red');
    expect(redWithBluePref.tiebreakerApplied).toBe(false);
    expect(redWithBluePref.tiebreakerBlockedReason).toBeTruthy();
  });

  it('usa preferência pelo Azul apenas como desempate no draft equilibrado', () => {
    const balancedNoPref = analyzeDraft(DEMO_DRAFTS.balanced, catalog, {
      preferBlueAsTiebreaker: false,
    });
    expect(balancedNoPref.recommendedForm).toBe('open');
    expect(balancedNoPref.tiebreakerApplied).toBe(false);

    const balancedWithPref = analyzeDraft(DEMO_DRAFTS.balanced, catalog, {
      preferBlueAsTiebreaker: true,
    });
    expect(balancedWithPref.recommendedForm).toBe('blue');
    expect(balancedWithPref.tiebreakerApplied).toBe(true);
    expect(balancedWithPref.alternativeForm).toBe('red');
  });

  it('lida com draft vazio, parcial e troca de posição (flex pick) sem crash', () => {
    const empty = createEmptyDraft();
    const resEmpty = analyzeDraft(empty, catalog, { preferBlueAsTiebreaker: true });
    expect(resEmpty.recommendedForm).toBe('open');
    expect(resEmpty.confidence.level).toBe('baixa');
    expect(resEmpty.missingDraftGaps.length).toBeGreaterThan(0);

    const swapped: DraftState = {
      ...DEMO_DRAFTS.balanced,
      enemies: {
        ...DEMO_DRAFTS.balanced.enemies,
        top: DEMO_DRAFTS.balanced.enemies.mid,
        mid: DEMO_DRAFTS.balanced.enemies.top,
      },
    };
    const resSwapped = analyzeDraft(swapped, catalog, { preferBlueAsTiebreaker: false });
    expect(resSwapped.lanes.perLane.top.favorableConditionSentence.length).toBeGreaterThan(10);
    expect(resSwapped.lanes.perLane.mid.fallbackConditionSentence.length).toBeGreaterThan(10);
  });

  it('NÃO dá prioridade automática à Bot quando faltam setup aliado e condições limpas', () => {
    const badBotDraft: DraftState = {
      id: 'bad-bot-test',
      name: 'Bot ruim vs Top ótimo',
      allies: {
        top: 'Renekton',
        jungle: 'Kayn',
        mid: 'Orianna',
        bot: 'Smolder',
        support: 'Yuumi',
      },
      enemies: {
        top: 'Kayle',
        jungle: 'LeeSin',
        mid: 'Syndra',
        bot: 'Ezreal',
        support: 'Janna',
      },
      staticNotes: '',
      updatedAt: '2026-11-18T00:00:00.000Z',
    };
    const res = analyzeDraft(badBotDraft, catalog, { preferBlueAsTiebreaker: true });
    expect(res.lanes.firstGankWindow).not.toBe('bot');
    expect(res.lanes.bestPlayAroundLane).toBe('top');
    expect(res.lanes.perLane.bot.firstWindowScore).toBeLessThan(
      res.lanes.perLane.top.firstWindowScore,
    );
  });

  it('respeita exceções de orbe (Rakan/Nilah melee, Lillia/Thresh/Graves/Yuumi ranged, Jayce híbrido)', () => {
    expect(classifyChampionOrbType('Rakan', 300)).toBe('melee');
    expect(classifyChampionOrbType('Nilah', 225)).toBe('melee');
    expect(classifyChampionOrbType('Lillia', 325)).toBe('ranged');
    expect(classifyChampionOrbType('Thresh', 450)).toBe('ranged');
    expect(classifyChampionOrbType('Graves', 425)).toBe('ranged');
    expect(classifyChampionOrbType('Yuumi', 425)).toBe('ranged');
    expect(classifyChampionOrbType('Jayce', 125)).toBe('hybrid');
  });

  it('nunca exibe "chance de vitória" ou "probabilidade de sucesso" e preserva snapshot congelado', () => {
    const res = analyzeDraft(DEMO_DRAFTS.blue, catalog, { preferBlueAsTiebreaker: true });
    const serialized = JSON.stringify(res).toLowerCase();
    expect(serialized).not.toContain('chance de vitória');
    expect(serialized).not.toContain('probabilidade de sucesso');
    expect(serialized).not.toContain('winrate');

    const frozen = createFrozenCardFromAnalysis(DEMO_DRAFTS.blue, res);
    expect(frozen.recommendedForm).toBe('blue');

    // Mutar o draft original não altera o cartão congelado
    const mutatedDraft: DraftState = {
      ...DEMO_DRAFTS.red,
      id: DEMO_DRAFTS.blue.id,
      name: 'Mutado',
    };
    const newAnalysis = analyzeDraft(mutatedDraft, catalog, { preferBlueAsTiebreaker: false });
    expect(newAnalysis.recommendedForm).toBe('red');
    expect(frozen.recommendedForm).toBe('blue');
    expect(frozen.draftName).toBe(DEMO_DRAFTS.blue.name);
  });
});
