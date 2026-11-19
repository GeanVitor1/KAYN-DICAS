import type {
  DraftAnalysis,
  ReviewEvent,
  ReviewEventAnalysis,
  StudyLesson,
  TacticalRule,
  TrainingAnalysis,
  TrainingScenario,
} from '../shared/types';
import { CURATED_STUDY_LESSONS } from './studyLibrary';

export const TACTICAL_MEMORY_META = {
  version: '2026.11-memory-v1',
  updatedAt: '2026-11-19',
} as const;

interface RuleBlueprint {
  actionTitle: string;
  oneLineTip: string;
  preGameWatchReminder: string;
  signals: TacticalRule['signals'];
  changePlanCondition: string;
  uncertaintyNote?: string;
  patchValidity: string;
  draftTags: TacticalRule['draftTags'];
}

const CURATED_RULE_BLUEPRINTS: Record<string, RuleBlueprint> = {
  'caiozera-macro-bot-abort-river': {
    actionTitle: 'Quando desistir da Bot',
    oneLineTip: 'Bot inimiga sob a torre deles? Pule o gank e volte aos campos ou rio.',
    preGameWatchReminder: 'Bot sob torre inimiga? Sem espaço de gank — volte pros campos.',
    signals: [
      { icon: 'wave', label: 'Bot sob torre inimiga' },
      { icon: 'prio', label: 'Sem espaço de entrada' },
      { icon: 'vision', label: 'Rio só com cobertura' },
    ],
    changePlanCondition:
      'Rio só é opção se Bot e Mid tiverem vida, prioridade real e cobertura; sem visão ou suporte saudável, volte aos campos.',
    uncertaintyNote:
      'Wave adiantada sozinha não garante contestar o rio — sem vida, prioridade real, visão ou cobertura, trate a disputa como incerta.',
    patchValidity: 'Macro geral (independe de itens)',
    draftTags: ['bot_push', 'bot_risk', 'farm_first'],
  },
  'caiozera-macro-post-dragon-bot': {
    actionTitle: 'Recuperar vida antes de forçar flanco',
    oneLineTip: 'Saiu baixo do objetivo? Roube um campo para curar e resete sem forçar dive.',
    preGameWatchReminder: 'Após objetivo ou campo roubado: embolse o lucro e resete com vida.',
    signals: [
      { icon: 'hp', label: 'Vida baixa pós-objetivo' },
      { icon: 'objective', label: 'Lucro já garantido' },
      { icon: 'dash', label: 'Alvo com R ou torre' },
    ],
    changePlanCondition:
      'Só flanqueie atrás da torre se o alvo já gastou defesa/R e seus aliados estiverem em alcance de acompanhar.',
    uncertaintyNote:
      'Análise visual do VOD sem áudio; não atribui intenção verbal ao criador.',
    patchValidity: 'Macro geral (independe de itens)',
    draftTags: ['objective', 'bot_risk'],
  },
  'caiozera-micro-rhaast-e-wall-pivot': {
    actionTitle: 'Segurar Q e W dentro da parede',
    oneLineTip: 'Entre na parede com E e segure Q/W até o carry gastar o dash; depois vire no alvo ao alcance.',
    preGameWatchReminder: 'De Rhaast, segure Q/W na parede até o carry gastar o dash.',
    signals: [
      { icon: 'wall', label: 'Terreno grosso ao lado' },
      { icon: 'dash', label: 'Esperar dash inimigo' },
      { icon: 'hp', label: 'R em recarga' },
    ],
    changePlanCondition:
      'Se o alvo usar dash para longe da parede, não persiga no aberto — redirecione W → Q para quem está no corredor.',
    patchValidity: 'Mecânica base do Rhaast (patch do clipe não confirmado)',
    draftTags: ['red', 'wall_micro'],
  },
  'caiozera-micro-base-rhaast-tower-reset': {
    actionTitle: 'Resetar aggro da torre com R',
    oneLineTip: 'Espere o stun inimigo sair, marque com Q e use R para largar o aggro da torre antes do W.',
    preGameWatchReminder: 'Contra mago imóvel: espere o CC sair e use R para tirar aggro.',
    signals: [
      { icon: 'dash', label: 'CC inimigo já gasto' },
      { icon: 'wall', label: 'Entrada por trás da torre' },
      { icon: 'timer', label: 'Guardar W para saída do R' },
    ],
    changePlanCondition:
      'Se o inimigo ainda tiver stun/afastamento pronto perto da torre, não force o dive sozinho.',
    patchValidity: 'Mecânica base (ordem exata W/Q pós-R marcada como incerta)',
    draftTags: ['red', 'wall_micro'],
  },
  'karasmai-macro-skip-mid-pivot-top': {
    actionTitle: 'Pular campo para fechar forma antes do Dragão',
    oneLineTip: 'Alvo resetou na lane? Aborte em 2s e pivote onde uma troca curta fecha sua forma sem gastar Flash.',
    preGameWatchReminder: 'Barra quase cheia antes do Dragão? Troca curta sem Flash fecha a forma.',
    signals: [
      { icon: 'timer', label: 'Dragão em ~1 min' },
      { icon: 'orbs', label: 'Barra quase cheia' },
      { icon: 'gold', label: 'Sem gastar Flash' },
    ],
    changePlanCondition:
      'Se faltarem muitos orbes ou o alvo tiver vantagem 1v2 / JG inimigo perto, limpe os campos normais em vez de pular.',
    patchValidity: 'Macro verificado (legenda + visual; patch da S16 não exibido no HUD)',
    draftTags: ['orbs', 'objective', 'blue'],
  },
  'karasmai-micro-blue-dragon-save-flash': {
    actionTitle: 'Esperar o engage do time no Dragão',
    oneLineTip: 'De Kayn Azul, espere o CC aliado conectar no rio antes de sair da parede — e guarde o Flash.',
    preGameWatchReminder: 'De Azul em objetivos: espere o engage aliado e guarde o Flash.',
    signals: [
      { icon: 'objective', label: 'Luta no rio/Dragão' },
      { icon: 'wall', label: 'Flanco pela parede do pit' },
      { icon: 'timer', label: 'Esperar CC aliado' },
    ],
    changePlanCondition:
      'Se o alvo escapar com Flash antes do W, recue pela parede em vez de queimar seu Flash em perseguição cega.',
    patchValidity: 'Verificado (legenda + visual; ordem sub-segundo W/Q marcada como incerta)',
    draftTags: ['blue', 'objective', 'wall_micro'],
  },
  'karasmai-micro-rhaast-historical-s13': {
    actionTitle: 'Guardar W e R na troca de Rhaast',
    oneLineTip: 'Aproxime com E → Q, segure W para punir movimento e guarde R para curar enquanto o Q volta.',
    preGameWatchReminder: 'No Rhaast, guarde R para depois de absorver dano e resetar o Q.',
    signals: [
      { icon: 'wall', label: 'Selva fechada' },
      { icon: 'timer', label: 'Segurar W após Q' },
      { icon: 'hp', label: 'R para cura e recarga' },
    ],
    changePlanCondition:
      'Se estiver atrás em nível ou ainda de Kayn Base, evite aceitar 1v2 estendido na selva inimiga.',
    patchValidity: 'Referência histórica (Season 13 — ignore itens do vídeo)',
    draftTags: ['red', 'wall_micro'],
  },
  'karasmai-micro-blue-base-wall-historical-s13': {
    actionTitle: 'Entrar e sair pela parede de Kayn Azul',
    oneLineTip: 'No Azul, use R para ganhar segundos até o próximo E e sair de volta pela parede direto pros campos.',
    preGameWatchReminder: 'No Azul, nunca fique na luta: entre da parede, combe e saia no E.',
    signals: [
      { icon: 'wall', label: 'Parede livre para saída' },
      { icon: 'timer', label: 'R compra tempo pro E' },
      { icon: 'vision', label: 'Checar quem está perto' },
    ],
    changePlanCondition:
      'Se houver vários inimigos próximos sem visão, aborte a entrada e colete os campos da selva.',
    patchValidity: 'Referência histórica (Season 13 — use builds do Draft atual)',
    draftTags: ['blue', 'wall_micro'],
  },
  'drill-blue-w-motion': {
    actionTitle: 'W andando na parede antes de gastar Q',
    oneLineTip: 'De Kayn Azul, lance o W em movimento na parede e só entre com Q se o W conectar.',
    preGameWatchReminder: 'De Azul: lance W andando na parede e só gaste Q se acertar.',
    signals: [
      { icon: 'wall', label: 'Andando dentro do E' },
      { icon: 'dash', label: 'Alvo com dash/reação' },
      { icon: 'timer', label: 'Guardar Q até acertar W' },
    ],
    changePlanCondition:
      'Se o W errar, continue andando na parede com E até o próximo campo sem se jogar no CC.',
    patchValidity: 'Validado no patch 16.23.1 (exercício de treino)',
    draftTags: ['blue', 'wall_micro'],
  },
  'drill-q-wall-cancel': {
    actionTitle: 'Cancelar dash do Q na parede grossa',
    oneLineTip: 'Mire o Q contra uma parede grossa para aplicar os dois hits instantaneamente e acelerar o clear.',
    preGameWatchReminder: 'No 1º clear, cancele o Q em paredes grossas para acelerar o tempo.',
    signals: [
      { icon: 'wall', label: 'Parede grossa ao lado' },
      { icon: 'timer', label: 'Clear mais rápido' },
      { icon: 'hp', label: 'Guardar E para rota' },
    ],
    changePlanCondition:
      'Evite mirar em parede fina (como o fosso do Dragão) para não atravessar e perder o giro do Q.',
    patchValidity: 'Validado no patch 16.23.1 (exercício de treino)',
    draftTags: ['farm_first', 'wall_micro'],
  },
};

export function buildTacticalRulesFromLessons(lessons: StudyLesson[] = CURATED_STUDY_LESSONS): TacticalRule[] {
  const ready = lessons.filter((l) => l.verificationStatus !== 'pending_curation');

  return ready.map((lesson) => {
    const bp = CURATED_RULE_BLUEPRINTS[lesson.id];
    if (bp) {
      return {
        id: `rule-${lesson.id}`,
        version: TACTICAL_MEMORY_META.version,
        lessonId: lesson.id,
        creator: lesson.creator,
        creatorDisplayName: lesson.creatorDisplayName,
        attributionLabel: lesson.attributionLabel,
        topic: lesson.topic,
        form: lesson.form,
        actionTitle: bp.actionTitle,
        oneLineTip: bp.oneLineTip,
        preGameWatchReminder: bp.preGameWatchReminder,
        signals: bp.signals.slice(0, 3),
        changePlanCondition: bp.changePlanCondition,
        uncertaintyNote: bp.uncertaintyNote,
        sourceLabel: `${lesson.channelName} · ${lesson.timestampDisplay}`,
        timestampDisplay: lesson.timestampDisplay,
        gameClockDisplay: lesson.gameClockDisplay,
        videoUrl: lesson.videoUrl,
        contextStartSeconds: lesson.contextStartSeconds,
        verificationStatus: lesson.verificationStatus,
        speechVerified: lesson.speechVerified,
        isHistoricalReference: lesson.isHistoricalReference,
        patchValidity: bp.patchValidity,
        draftTags: bp.draftTags,
        linkedTrainingScenarioId: lesson.linkedTrainingScenarioId,
      };
    }

    // Fallback determinístico para eventuais lições customizadas promovidas
    return {
      id: `rule-${lesson.id}`,
      version: TACTICAL_MEMORY_META.version,
      lessonId: lesson.id,
      creator: lesson.creator,
      creatorDisplayName: lesson.creatorDisplayName,
      attributionLabel: lesson.attributionLabel,
      topic: lesson.topic,
      form: lesson.form,
      actionTitle: lesson.title,
      oneLineTip: lesson.shortSummaryPt,
      preGameWatchReminder: lesson.shortSummaryPt,
      signals: [{ icon: 'vision', label: lesson.topic === 'macro' ? 'Leitura de mapa' : 'Execução mecânica' }],
      changePlanCondition:
        lesson.macro?.chooseDifferentWhen ??
        lesson.micro?.targetDodgesOrDashes ??
        'Reavalie se faltar visão, vida ou prioridade das lanes.',
      sourceLabel: `${lesson.channelName} · ${lesson.timestampDisplay}`,
      timestampDisplay: lesson.timestampDisplay,
      gameClockDisplay: lesson.gameClockDisplay,
      videoUrl: lesson.videoUrl,
      contextStartSeconds: lesson.contextStartSeconds,
      verificationStatus: lesson.verificationStatus,
      speechVerified: lesson.speechVerified,
      isHistoricalReference: lesson.isHistoricalReference,
      patchValidity: lesson.patch,
      draftTags: lesson.form === 'blue' ? ['blue'] : lesson.form === 'red' ? ['red'] : ['farm_first'],
      linkedTrainingScenarioId: lesson.linkedTrainingScenarioId,
    };
  });
}

export interface SelectedPreGameReminder {
  ruleId?: string;
  title: string;
  text: string;
  watchCondition: string;
  sourceLabel?: string;
  isPinnedByUser: boolean;
}

/**
 * Seleciona 2-3 lembretes táticos curtos para o pré-jogo e cartão flutuante,
 * combinando escolhas fixadas pelo jogador + contexto do draft (sem presumir estado de wave).
 */
export function selectPreGameReminders(
  analysis: DraftAnalysis,
  rules: TacticalRule[],
  pinnedReminderIds: string[] = [],
  userNotesByRule: Record<string, string> = {},
  draftStaticNotes = '',
): SelectedPreGameReminder[] {
  const result: SelectedPreGameReminder[] = [];
  const addedRuleIds = new Set<string>();

  const formatRuleText = (rule: TacticalRule) => {
    const custom = userNotesByRule[rule.id]?.trim();
    return custom || rule.preGameWatchReminder;
  };

  // 1. Lembretes escolhidos manualmente pelo jogador (sempre priorizados)
  for (const rid of pinnedReminderIds) {
    const found = rules.find((r) => r.id === rid || r.lessonId === rid);
    if (found && !addedRuleIds.has(found.id)) {
      addedRuleIds.add(found.id);
      result.push({
        ruleId: found.id,
        title: found.actionTitle,
        text: formatRuleText(found),
        watchCondition: found.changePlanCondition,
        sourceLabel: found.creatorDisplayName,
        isPinnedByUser: true,
      });
    }
  }

  // 2. Pontuar regras pelo draft atual (sem assumir wave; sempre indicando o que observar no jogo)
  const botBadOrRisky =
    analysis.lanes.firstGankWindow !== 'bot' ||
    analysis.lanes.perLane.bot.countergankRisk === 'alto';

  const scored = rules
    .filter((r) => !addedRuleIds.has(r.id))
    .map((rule) => {
      let score = 0;
      if (rule.creator === 'caiozera') score += 2;
      if (botBadOrRisky && (rule.draftTags.includes('bot_risk') || rule.draftTags.includes('bot_push'))) {
        score += 4;
      }
      if (analysis.lanes.firstGankWindow === 'farm_first' && rule.draftTags.includes('farm_first')) {
        score += 3;
      }
      if (analysis.recommendedForm === 'blue' && rule.draftTags.includes('blue')) {
        score += 3;
      }
      if (analysis.recommendedForm === 'red' && rule.draftTags.includes('red')) {
        score += 3;
      }
      if (analysis.orbDivergenceNote && rule.draftTags.includes('orbs')) {
        score += 3;
      }
      if (rule.isHistoricalReference) score -= 2;
      return { rule, score };
    })
    .sort((a, b) => b.score - a.score);

  for (const { rule } of scored) {
    if (result.length >= 2) break;
    addedRuleIds.add(rule.id);
    result.push({
      ruleId: rule.id,
      title: rule.actionTitle,
      text: formatRuleText(rule),
      watchCondition: rule.changePlanCondition,
      sourceLabel: rule.creatorDisplayName,
      isPinnedByUser: false,
    });
  }

  // 3. Se o jogador escreveu nota curta no rascunho, incluir como lembrete próprio
  const firstUserLine = draftStaticNotes
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  if (firstUserLine && result.length < 3) {
    result.push({
      title: 'Nota do jogador',
      text: firstUserLine,
      watchCondition: 'Definido por você antes da partida.',
      isPinnedByUser: true,
    });
  }

  return result.slice(0, 3);
}

/**
 * Cruza regras da memória tática com o cenário atual do Treino para explicar
 * por que a decisão preferida faz sentido com base em evidências verificadas.
 */
export function matchRulesForTrainingScenario(
  scenario: TrainingScenario,
  analysis: TrainingAnalysis,
  rules: TacticalRule[],
): TacticalRule[] {
  const matched: TacticalRule[] = [];
  const seen = new Set<string>();

  const pushRule = (r?: TacticalRule) => {
    if (r && !seen.has(r.id)) {
      seen.add(r.id);
      matched.push(r);
    }
  };

  // Match direto por cenário vinculado
  pushRule(rules.find((r) => r.linkedTrainingScenarioId === scenario.id));

  // Match por sinais do cenário
  if (
    scenario.botWaveState === 'pushed_to_enemy' ||
    scenario.timeAlreadyWaitingSeconds >= 10 ||
    (scenario.botPrio === 'enemy' && analysis.preferredOption.optionId === 'farm_route')
  ) {
    pushRule(rules.find((r) => r.lessonId === 'caiozera-macro-bot-abort-river'));
  }

  if (scenario.needOrbsUrgently && scenario.objectiveType === 'dragon') {
    pushRule(rules.find((r) => r.lessonId === 'karasmai-macro-skip-mid-pivot-top'));
  }

  if (scenario.hpPercent < 65 && scenario.objectiveType !== 'none') {
    pushRule(rules.find((r) => r.lessonId === 'caiozera-macro-post-dragon-bot'));
  }

  if (scenario.kaynFormState === 'blue' && scenario.objectiveType !== 'none') {
    pushRule(rules.find((r) => r.lessonId === 'karasmai-micro-blue-dragon-save-flash'));
  }

  return matched.slice(0, 2);
}

/**
 * Cruza regras da memória tática com eventos da Revisão pós-jogo.
 */
export function matchRulesForReviewEvent(
  event: ReviewEvent,
  eventAnalysis: ReviewEventAnalysis,
  rules: TacticalRule[],
): TacticalRule | null {
  if (event.linkedLessonId) {
    const direct = rules.find((r) => r.lessonId === event.linkedLessonId);
    if (direct) return direct;
  }

  if (
    eventAnalysis.isBotAttempt &&
    (eventAnalysis.decisionQuality === 'ruim' || eventAnalysis.decisionQuality === 'questionavel')
  ) {
    return rules.find((r) => r.lessonId === 'caiozera-macro-bot-abort-river') ?? null;
  }

  if (event.type === 'objective' && event.allyPrio === 'enemy') {
    return rules.find((r) => r.lessonId === 'caiozera-macro-post-dragon-bot') ?? null;
  }

  return null;
}
