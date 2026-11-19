import { describe, expect, it } from 'vitest';
import { DEMO_TRAINING_SCENARIOS } from '../src/engine/demos';
import {
  CURATED_STUDY_LESSONS,
  MAX_FAVORITE_MICRO_CARDS,
  buildFrozenMicroCards,
  buildTimestampedYouTubeUrl,
  createManualPendingLesson,
  filterStudyLessons,
  getAllStudyLessons,
  parseTimestampToSeconds,
  toggleFavoriteMicroId,
} from '../src/engine/studyLibrary';
import { analyzeTrainingScenario } from '../src/engine/trainingSimulator';

describe('Biblioteca de Estudo (Aba Aprender — CaiozeraLoL & Karasmai)', () => {
  it('coloca CaiozeraLoL no topo por padrão e exclui fontes pendentes das recomendações prontas', () => {
    const ready = filterStudyLessons(CURATED_STUDY_LESSONS, {
      creator: 'all',
      topic: 'all',
      form: 'all',
      includePending: false,
    });

    expect(ready.length).toBeGreaterThanOrEqual(8);
    expect(ready[0].creator).toBe('caiozera');
    expect(ready.every((l) => l.verificationStatus !== 'pending_curation')).toBe(true);

    const pending = filterStudyLessons(CURATED_STUDY_LESSONS, {
      creator: 'all',
      topic: 'all',
      form: 'all',
      includePending: true,
    });
    expect(pending.length).toBeGreaterThanOrEqual(3);
    expect(pending.every((l) => l.verificationStatus === 'pending_curation')).toBe(true);
  });

  it('filtra corretamente por criador, assunto (macro/micro) e forma do Kayn', () => {
    const karasmaiMicroBlue = filterStudyLessons(CURATED_STUDY_LESSONS, {
      creator: 'karasmai',
      topic: 'micro',
      form: 'blue',
      includePending: false,
    });
    expect(karasmaiMicroBlue.length).toBe(2);
    expect(karasmaiMicroBlue.every((l) => l.karasmaiPt !== undefined)).toBe(true);

    const caiozeraMacro = filterStudyLessons(CURATED_STUDY_LESSONS, {
      creator: 'caiozera',
      topic: 'macro',
      form: 'base',
      includePending: false,
    });
    expect(caiozeraMacro.length).toBe(2);
    expect(caiozeraMacro.every((l) => l.verificationStatus === 'visual_only' && !l.speechVerified)).toBe(
      true,
    );
  });

  it('não atribui o exemplo ilustrativo Q -> R -> W -> E ao CaiozeraLoL e marca referências de 2023 como históricas', () => {
    const caioMicros = CURATED_STUDY_LESSONS.filter(
      (l) => l.creator === 'caiozera' && l.topic === 'micro',
    );
    for (const m of caioMicros) {
      const seq = m.micro?.steps.map((s) => s.key).join(' -> ');
      expect(seq).not.toBe('Q -> R -> W -> E');
    }

    const s13Lessons = CURATED_STUDY_LESSONS.filter((l) => l.videoUrl.includes('xvKz5kMPUUs'));
    expect(s13Lessons.length).toBe(2);
    expect(s13Lessons.every((l) => l.isHistoricalReference)).toBe(true);
  });

  it('interpreta timestamps e gera URL com parâmetro ?t=...s', () => {
    expect(parseTimestampToSeconds('03:55')).toBe(235);
    expect(parseTimestampToSeconds('1:05:10')).toBe(3910);
    expect(parseTimestampToSeconds('637')).toBe(637);
    expect(parseTimestampToSeconds('04:99')).toBeNull();

    const url = buildTimestampedYouTubeUrl('https://www.youtube.com/watch?v=ubwHhx3DdZA', 235);
    expect(url).toBe('https://www.youtube.com/watch?v=ubwHhx3DdZA&t=235s');
  });

  it('respeita limite máximo de 3 cartões favoritos, bloqueia pendentes e gera cartões compactos', () => {
    const allReadyMicros = filterStudyLessons(CURATED_STUDY_LESSONS, {
      creator: 'all',
      topic: 'micro',
      form: 'all',
      includePending: false,
    });
    expect(allReadyMicros.length).toBeGreaterThanOrEqual(4);

    let favs: string[] = [];
    for (let i = 0; i < MAX_FAVORITE_MICRO_CARDS; i += 1) {
      const r = toggleFavoriteMicroId(favs, allReadyMicros[i].id, CURATED_STUDY_LESSONS);
      expect(r.warning).toBeUndefined();
      favs = r.ids;
    }
    expect(favs.length).toBe(3);

    // 4º favorito deve ser recusado com aviso
    const fourth = toggleFavoriteMicroId(favs, allReadyMicros[3].id, CURATED_STUDY_LESSONS);
    expect(fourth.ids.length).toBe(3);
    expect(fourth.warning).toBeTruthy();

    // Fonte pendente não pode ser favoritada
    const pendingRes = toggleFavoriteMicroId([], 'caiozera-pending-stepz', CURATED_STUDY_LESSONS);
    expect(pendingRes.ids.length).toBe(0);
    expect(pendingRes.warning).toBeTruthy();

    const compact = buildFrozenMicroCards(favs, CURATED_STUDY_LESSONS);
    expect(compact.length).toBe(3);
    expect(compact[0].steps.length).toBeGreaterThanOrEqual(3);
    expect(compact[0].heldAbilityHint.length).toBeGreaterThan(5);
  });

  it('cadastra fonte pendente manual offline e mantém fora das lições prontas', () => {
    const created = createManualPendingLesson({
      title: 'Estudo de invade nível 3',
      creator: 'caiozera',
      topic: 'macro',
      form: 'base',
      videoUrl: 'https://www.youtube.com/watch?v=ubwHhx3DdZA',
      timestampInput: '12:30',
      note: 'Checar ward no pixel',
    });
    expect(created.ok).toBe(true);
    expect(created.lesson?.verificationStatus).toBe('pending_curation');
    expect(created.lesson?.contextStartSeconds).toBe(750);

    const all = getAllStudyLessons([created.lesson!]);
    const ready = filterStudyLessons(all, {
      creator: 'all',
      topic: 'all',
      form: 'all',
      includePending: false,
    });
    expect(ready.some((l) => l.id === created.lesson!.id)).toBe(false);

    const bad = createManualPendingLesson({
      title: 'Teste',
      creator: 'karasmai',
      topic: 'macro',
      form: 'blue',
      videoUrl: 'http://invalido',
      timestampInput: '01:00',
      note: '',
    });
    expect(bad.ok).toBe(false);
  });

  it('vincula lições verificadas a cenários válidos da aba Treino', () => {
    const withTraining = CURATED_STUDY_LESSONS.filter((l) => l.linkedTrainingScenarioId);
    expect(withTraining.length).toBeGreaterThanOrEqual(2);

    for (const lesson of withTraining) {
      const scenario = DEMO_TRAINING_SCENARIOS.find(
        (s) => s.id === lesson.linkedTrainingScenarioId,
      );
      expect(scenario).toBeDefined();
      const analysis = analyzeTrainingScenario(scenario!);
      expect(analysis.preferredOption.optionId).toBeTruthy();
      if (lesson.id === 'caiozera-macro-bot-abort-river') {
        expect(analysis.preferredOption.optionId).not.toBe('gank_bot');
      }
    }
  });
});
