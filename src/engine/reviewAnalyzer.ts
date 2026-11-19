import type {
  EnemyResponseCertainty,
  LanePrioState,
  RecurringPattern,
  ReviewAnalysis,
  ReviewEvent,
  ReviewEventAnalysis,
  ReviewEventType,
  ReviewLaneFocus,
  ReviewMatch,
  ReviewOutcome,
} from '../shared/types';

export const REVIEW_JSON_SCHEMA_VERSION = 1;

const OUTCOME_LABELS: Record<ReviewOutcome, string> = {
  kill: 'Abate',
  assist: 'Assistência',
  forced_spell_or_recall: 'Feitiço forçado / Recall inimigo',
  nothing_lost_tempo: 'Sem retorno (perda de tempo)',
  died: 'Kayn morreu na jogada',
  completed_objective: 'Objetivo concluído',
  clean_reset: 'Reset limpo',
  efficient_clear: 'Rota de farm eficiente',
};

function evaluateDecisionByVisibleInfo(event: ReviewEvent): {
  quality: ReviewEventAnalysis['decisionQuality'];
  reason: string;
} {
  if (event.decisionContextSource === 'api_partial_hypothesis' && event.allyPrio === 'unknown' && event.timeSpentSeconds === null) {
    return {
      quality: 'indeterminada',
      reason:
        'Importação automática parcial (sem dados de prio da wave, postura do suporte ou tempo real esperando). Preencha o contexto manualmente antes de julgar a decisão.',
    };
  }

  if (event.type === 'reset') {
    if (event.resourcesReady === false || (event.kaynHpPercent !== null && event.kaynHpPercent <= 45)) {
      return {
        quality: 'boa',
        reason: 'Reset justificado por vida baixa/recursos gastos para voltar com item e ritmo limpo.',
      };
    }
    return {
      quality: 'boa',
      reason: 'Reset planejado para converter ouro acumulado antes da próxima disputa.',
    };
  }

  if (event.type === 'farm') {
    return {
      quality: 'boa',
      reason: 'Rota de campos garante ouro e XP previsíveis sem depender de erro adversário.',
    };
  }

  if (event.type === 'objective') {
    if (event.allyPrio === 'enemy') {
      return {
        quality: 'ruim',
        reason: 'Objetivo iniciado sem prioridade nas rotas adjacentes — alto risco de colapso adversário.',
      };
    }
    if (event.allyPrio === 'unknown' && event.estimatedEnemyJungler === 'unknown') {
      return {
        quality: 'questionavel',
        reason: 'Faltavam informações de prioridade e do caçador inimigo antes de puxar o objetivo.',
      };
    }
    return {
      quality: 'boa',
      reason: 'Havia suporte de prioridade ou janela no mapa para iniciar o objetivo.',
    };
  }

  // Gank ou Death em tentativa de jogada
  const noPrio = event.allyPrio === 'enemy';
  const sameSideEnemyJg =
    (event.lane === 'bot' && event.estimatedEnemyJungler === 'bot_side') ||
    (event.lane === 'top' && event.estimatedEnemyJungler === 'top_side') ||
    (event.lane === 'mid' && event.estimatedEnemyJungler === 'mid');
  const lowHp = event.kaynHpPercent !== null && event.kaynHpPercent < 55;
  const longWait = event.timeSpentSeconds !== null && event.timeSpentSeconds >= 18;

  if (noPrio && (sameSideEnemyJg || event.estimatedEnemyJungler === 'unknown')) {
    return {
      quality: 'ruim',
      reason:
        'Com informações da hora, faltava prioridade aliada e havia risco real de resposta do caçador inimigo.',
    };
  }
  if (lowHp) {
    return {
      quality: 'ruim',
      reason: `Entrar com ${event.kaynHpPercent}% de vida expôs você à virada no 2v2/3v3 mesmo sem erro de leitura da wave.`,
    };
  }
  if (longWait && event.outcome === 'nothing_lost_tempo') {
    return {
      quality: 'questionavel',
      reason: `A janela inicial até podia existir, mas ficar ${event.timeSpentSeconds}s insistindo transformou a jogada em perda de tempo.`,
    };
  }
  if (event.allyPrio === 'unknown' && event.estimatedEnemyJungler === 'unknown') {
    return {
      quality: 'questionavel',
      reason: 'Decisão tomada sem confirmar pressão nem leitura do caçador inimigo.',
    };
  }

  return {
    quality: 'boa',
    reason:
      'Pelos dados disponíveis no momento (pressão/janela e recursos), a tentativa fazia sentido antes do desfecho.',
  };
}

function evaluateExecution(event: ReviewEvent): {
  quality: ReviewEventAnalysis['executionQuality'];
  reason: string;
} {
  if (event.type === 'reset' || event.type === 'farm') {
    return {
      quality: 'nao_aplicavel',
      reason: 'Ação macro de rotina sem disputa mecânica direta registrada.',
    };
  }

  const noteLower = event.executionNote.toLowerCase();
  const hasExplicitMechIssue =
    /errou|erro|mecânic|mecanica|combo|sem flash|tarde|atras|apress|dive|torre|desencontro|fora de alcance|w errado|ult/i.test(
      noteLower,
    );

  if (event.outcome === 'died' && hasExplicitMechIssue) {
    return {
      quality: 'falha_execucao',
      reason: event.executionNote || 'Falha de execução mecânica/timing durante a tentativa.',
    };
  }

  if (event.outcome === 'nothing_lost_tempo' && hasExplicitMechIssue) {
    return {
      quality: 'falha_execucao',
      reason: event.executionNote || 'Execução imprecisa impediu converter uma janela que estava aberta.',
    };
  }

  if (event.outcome === 'kill' || event.outcome === 'assist' || event.outcome === 'forced_spell_or_recall' || event.outcome === 'completed_objective') {
    return {
      quality: 'limpa',
      reason:
        event.executionNote.trim() ||
        'Execução gerou vantagem concreta (abate, feitiço forçado, pressão de wave ou objetivo).',
    };
  }

  if (event.outcome === 'died') {
    return {
      quality: 'falha_execucao',
      reason:
        event.executionNote.trim() ||
        'A tentativa terminou em morte do Kayn — verifique se o limite do dano/contragank foi subestimado.',
    };
  }

  return {
    quality: 'indeterminada',
    reason: event.executionNote.trim() || 'Sem detalhe mecânico suficiente para isolar execução da decisão.',
  };
}

function suggestAlternative(event: ReviewEvent): { alternative: string; tradeoff: string } {
  if (event.lane === 'bot' && (event.type === 'gank' || event.type === 'death')) {
    if (event.allyPrio === 'enemy' || event.estimatedEnemyJungler === 'bot_side') {
      return {
        alternative: 'Ignorar a Bot, concluir campos do lado oposto (Top/Vastilarvas) ou resetar com ouro.',
        tradeoff: 'Abre mão de tentar orbes azuis imediatos na Bot, mas preserva tempo de farm, evita morte e nega resposta gratuita no lado oposto.',
      };
    }
    if (event.timeSpentSeconds !== null && event.timeSpentSeconds >= 16) {
      return {
        alternative: 'Abortar após 6-8s sem abertura e limpar os campos adjacentes / Aronguejo.',
        tradeoff: 'Você deixa a Bot jogar na pressão própria por 1 ciclo, mas evita perder respawn da selva e 1 nível inteiro para o caçador inimigo.',
      };
    }
    return {
      alternative: 'Entrar apenas para forçar pressão e sair rápido, ou conectar com o Mid antes de descer.',
      tradeoff: 'Menor chance de abate imediato, porém risco próximo de zero e manutenção do ritmo.',
    };
  }

  if (event.type === 'objective') {
    return {
      alternative: 'Trocar o objetivo por invasão de campo oposto / rotação na rota com prioridade.',
      tradeoff: 'Cede 1 objetivo inicial, mas impede perder 2-3 abates + tempo morto no mesmo lance.',
    };
  }

  return {
    alternative: 'Seguir ciclo de farm + reset antes da próxima janela de objetivo.',
    tradeoff: 'Menos impacto imediato no placar, porém pico de item garantido para a briga seguinte.',
  };
}

export function analyzeReviewMatch(match: ReviewMatch): ReviewAnalysis {
  const sortedEvents = [...match.events].sort((a, b) => a.minute - b.minute);
  const perEvent: ReviewEventAnalysis[] = [];
  const missingContextWarnings: string[] = [];

  for (const ev of sortedEvents) {
    const decision = evaluateDecisionByVisibleInfo(ev);
    const execution = evaluateExecution(ev);
    const alt = suggestAlternative(ev);

    const isBotAttempt = ev.lane === 'bot' && (ev.type === 'gank' || ev.type === 'death');
    const productiveWithoutKill =
      ev.outcome === 'forced_spell_or_recall' &&
      (ev.timeSpentSeconds === null || ev.timeSpentSeconds <= 24);

    if (ev.decisionContextSource === 'api_partial_hypothesis') {
      missingContextWarnings.push(
        `Min ${ev.minute}: evento importado de fonte parcial sem tempo gasto ou wave; revise manualmente antes de concluir culpa.`,
      );
    }

    const timeNote =
      ev.timeSpentSeconds !== null
        ? `${ev.timeSpentSeconds}s investidos`
        : 'Tempo gasto desconhecido';
    const tempoAndCostNote = `${timeNote} — Desfecho: ${OUTCOME_LABELS[ev.outcome]}. ${ev.whatHappenedAfter || 'Sem consequência posterior registrada.'}`;

    const enemyPunishCertaintyLabel =
      ev.enemyResponseCertainty === 'confirmed'
        ? `[CONFIRMADO] ${ev.enemyResponseText || 'Resposta adversária confirmada na fonte.'}`
        : `[HIPÓTESE] ${ev.enemyResponseText || 'Possível resposta adversária (não confirmada diretamente — edite se conferir no replay).'}`;

    perEvent.push({
      eventId: ev.id,
      minute: ev.minute,
      isBotAttempt,
      decisionQuality: decision.quality,
      decisionReason: decision.reason,
      executionQuality: execution.quality,
      executionReason: execution.reason,
      tempoAndCostNote,
      enemyPunishCertaintyLabel,
      plausibleAlternative: alt.alternative,
      alternativeTradeoff: alt.tradeoff,
      productiveWithoutKill,
    });
  }

  // Sumário específico das tentativas na Bot
  const botEvents = sortedEvents.filter(
    (e) => e.lane === 'bot' && (e.type === 'gank' || e.type === 'death'),
  );
  const botAnalyses = perEvent.filter((a) => a.isBotAttempt);

  const times = botEvents
    .map((e) => e.timeSpentSeconds)
    .filter((t): t is number => t !== null);
  const avgTime =
    times.length > 0 ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : null;

  const botAttemptsSummary: ReviewAnalysis['botAttemptsSummary'] = {
    totalAttempts: botEvents.length,
    killsOrAssists: botEvents.filter((e) => e.outcome === 'kill' || e.outcome === 'assist').length,
    productiveSpellOrRecall: botAnalyses.filter((a) => a.productiveWithoutKill).length,
    wastedTempoOrDeaths: botEvents.filter(
      (e) => e.outcome === 'nothing_lost_tempo' || e.outcome === 'died',
    ).length,
    averageTimeSpentSeconds: avgTime,
    attemptsDetail: botEvents.map((ev, idx) => ({
      minute: ev.minute,
      outcomeLabel: OUTCOME_LABELS[ev.outcome],
      potentialCost:
        ev.enemyResponseText ||
        (ev.timeSpentSeconds && ev.timeSpentSeconds >= 16
          ? `Perda de ~${ev.timeSpentSeconds}s de ciclo e pressão no lado oposto.`
          : 'Baixo custo se voltou logo para os campos.'),
      decisionQuality: botAnalyses[idx]?.decisionQuality ?? 'indeterminada',
    })),
  };

  // Detectar até 3 padrões recorrentes baseados em evidências reais da timeline
  const recurringPatterns: RecurringPattern[] = [];

  const repeatedBadBot = sortedEvents.filter(
    (e, i) =>
      e.lane === 'bot' &&
      (e.type === 'gank' || e.type === 'death') &&
      (perEvent[i]?.decisionQuality === 'ruim' || e.outcome === 'died' || e.outcome === 'nothing_lost_tempo'),
  );
  if (repeatedBadBot.length >= 2) {
    recurringPatterns.push({
      id: 'pattern-bot-repeat',
      title: 'Insistência repetida na Bot sem condições favoráveis',
      description: `Você forçou ou repetiu ${repeatedBadBot.length} passagens caras na Bot (mortes ou perda de tempo sem setup/prio).`,
      exampleMinutes: repeatedBadBot.map((e) => e.minute),
    });
  }

  const longWaitEvents = sortedEvents.filter(
    (e) =>
      (e.type === 'gank' || e.type === 'death') &&
      e.timeSpentSeconds !== null &&
      e.timeSpentSeconds >= 16 &&
      e.outcome !== 'kill' &&
      e.outcome !== 'completed_objective',
  );
  if (longWaitEvents.length >= 1) {
    recurringPatterns.push({
      id: 'pattern-tempo-wait',
      title: 'Tempo excessivo esperando ou alongando gank',
      description: `Em ${longWaitEvents.length} lance(s) você gastou 16s+ sem conversão, atrasando seus campos e abrindo resposta inimiga.`,
      exampleMinutes: longWaitEvents.map((e) => e.minute),
    });
  }

  const unknownJgForced = sortedEvents.filter(
    (e) =>
      (e.type === 'gank' || e.type === 'objective' || e.type === 'death') &&
      e.estimatedEnemyJungler === 'unknown' &&
      (e.outcome === 'died' || e.outcome === 'nothing_lost_tempo'),
  );
  if (unknownJgForced.length >= 1) {
    recurringPatterns.push({
      id: 'pattern-blind-enemy-jg',
      title: 'Jogadas agressivas sem leitura do jungler inimigo',
      description: `Entradas feitas sem estimar onde o caçador adversário estava resultaram em punição ou perda de turno.`,
      exampleMinutes: unknownJgForced.map((e) => e.minute),
    });
  }

  const executionFailuresOnGoodCalls = perEvent.filter(
    (p) => p.decisionQuality === 'boa' && p.executionQuality === 'falha_execucao',
  );
  if (recurringPatterns.length < 3 && executionFailuresOnGoodCalls.length >= 1) {
    recurringPatterns.push({
      id: 'pattern-good-call-bad-exec',
      title: 'Boas leituras desperdiçadas por execução apressada',
      description: `A janela existia pelas informações do mapa, mas o erro na execução mecânica impediu fechar a jogada.`,
      exampleMinutes: executionFailuresOnGoodCalls.map((p) => p.minute),
    });
  }

  // Foco prático para as próximas partidas
  let nextGamesFocus =
    'Regra dos 8 segundos na Bot: só cruze a parede se houver CC/setup aliado e ideia clara do jungler inimigo; se não abrir em 8s, volte para os campos.';
  if (recurringPatterns.some((p) => p.id === 'pattern-bot-repeat')) {
    nextGamesFocus =
      'Foco principal: quebrar o hábito automático da Bot. Antes de descer, confirme prio + vida do suporte + posição do jungler inimigo; caso falte qualquer um, feche o ciclo de farm/Top.';
  } else if (recurringPatterns.some((p) => p.id === 'pattern-good-call-bad-exec')) {
    nextGamesFocus =
      'Foco principal: suas leituras de janela estão boas, ajuste a paciência na execução (espere o dash inimigo ou o CC do suporte antes de gastar Q/W).';
  }

  return {
    matchId: match.id,
    botAttemptsSummary,
    perEvent,
    recurringPatterns: recurringPatterns.slice(0, 3),
    nextGamesFocus,
    missingContextWarnings,
  };
}

export function serializeReviewJson(match: ReviewMatch): string {
  return JSON.stringify(
    {
      schemaVersion: REVIEW_JSON_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      review: match,
    },
    null,
    2,
  );
}

const VALID_TYPES = new Set<ReviewEventType>(['gank', 'death', 'reset', 'farm', 'objective']);
const VALID_LANES = new Set<ReviewLaneFocus>(['top', 'mid', 'bot', 'jungle', 'river']);
const VALID_OUTCOMES = new Set<ReviewOutcome>([
  'kill',
  'assist',
  'forced_spell_or_recall',
  'nothing_lost_tempo',
  'died',
  'completed_objective',
  'clean_reset',
  'efficient_clear',
]);
const VALID_PRIO = new Set<LanePrioState>(['ally', 'even', 'enemy', 'unknown']);

export function parseAndValidateReviewJson(rawText: string): {
  ok: boolean;
  review?: ReviewMatch;
  error?: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: 'JSON inválido: não foi possível interpretar o arquivo.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Formato inválido: objeto raiz esperado.' };
  }

  const root = parsed as Record<string, unknown>;
  const candidate = (root.review && typeof root.review === 'object' ? root.review : root) as Record<string, unknown>;

  if (typeof candidate.title !== 'string' || !Array.isArray(candidate.events)) {
    return {
      ok: false,
      error: 'Formato de revisão inválido: campos "title" (string) e "events" (array) são obrigatórios.',
    };
  }

  const sanitizedEvents: ReviewEvent[] = [];
  for (let i = 0; i < candidate.events.length; i += 1) {
    const rawEv = candidate.events[i] as Record<string, unknown>;
    if (!rawEv || typeof rawEv !== 'object') continue;
    const minute = Number(rawEv.minute);
    if (!Number.isFinite(minute) || minute < 0) {
      return { ok: false, error: `Evento #${i + 1} possui "minute" inválido.` };
    }
    const type = VALID_TYPES.has(rawEv.type as ReviewEventType) ? (rawEv.type as ReviewEventType) : 'gank';
    const lane = VALID_LANES.has(rawEv.lane as ReviewLaneFocus) ? (rawEv.lane as ReviewLaneFocus) : 'bot';
    const outcome = VALID_OUTCOMES.has(rawEv.outcome as ReviewOutcome)
      ? (rawEv.outcome as ReviewOutcome)
      : 'nothing_lost_tempo';
    const allyPrio = VALID_PRIO.has(rawEv.allyPrio as LanePrioState)
      ? (rawEv.allyPrio as LanePrioState)
      : 'unknown';
    const certainty: EnemyResponseCertainty =
      rawEv.enemyResponseCertainty === 'confirmed' ? 'confirmed' : 'hypothesis';

    sanitizedEvents.push({
      id: typeof rawEv.id === 'string' && rawEv.id ? rawEv.id : `ev-import-${i + 1}`,
      minute,
      type,
      lane,
      allyPrio,
      estimatedEnemyJungler:
        rawEv.estimatedEnemyJungler === 'bot_side' ||
        rawEv.estimatedEnemyJungler === 'top_side' ||
        rawEv.estimatedEnemyJungler === 'mid' ||
        rawEv.estimatedEnemyJungler === 'dead_or_base'
          ? rawEv.estimatedEnemyJungler
          : 'unknown',
      kaynHpPercent:
        typeof rawEv.kaynHpPercent === 'number' && Number.isFinite(rawEv.kaynHpPercent)
          ? rawEv.kaynHpPercent
          : null,
      resourcesReady: typeof rawEv.resourcesReady === 'boolean' ? rawEv.resourcesReady : null,
      timeSpentSeconds:
        typeof rawEv.timeSpentSeconds === 'number' && Number.isFinite(rawEv.timeSpentSeconds)
          ? rawEv.timeSpentSeconds
          : null,
      outcome,
      whatHappenedAfter: typeof rawEv.whatHappenedAfter === 'string' ? rawEv.whatHappenedAfter : '',
      enemyResponseText: typeof rawEv.enemyResponseText === 'string' ? rawEv.enemyResponseText : '',
      enemyResponseCertainty: certainty,
      executionNote: typeof rawEv.executionNote === 'string' ? rawEv.executionNote : '',
      decisionContextSource:
        rawEv.decisionContextSource === 'api_partial_hypothesis'
          ? 'api_partial_hypothesis'
          : 'manual_observed',
      linkedLessonId:
        typeof rawEv.linkedLessonId === 'string' && rawEv.linkedLessonId.trim()
          ? rawEv.linkedLessonId
          : null,
    });
  }

  const review: ReviewMatch = {
    id:
      typeof candidate.id === 'string' && candidate.id.trim()
        ? candidate.id
        : `review-${Date.now()}`,
    title: candidate.title.trim(),
    isExampleDemo: Boolean(candidate.isExampleDemo),
    sourceLabel:
      typeof candidate.sourceLabel === 'string' && candidate.sourceLabel
        ? candidate.sourceLabel
        : 'Importação JSON local',
    patch: typeof candidate.patch === 'string' && candidate.patch ? candidate.patch : 'Desconhecido',
    rankContext:
      typeof candidate.rankContext === 'string' && candidate.rankContext
        ? candidate.rankContext
        : 'Solo/Duo',
    matchId: typeof candidate.matchId === 'string' ? candidate.matchId : undefined,
    plannedForm: candidate.plannedForm === 'red' ? 'red' : 'blue',
    actualFormMinute:
      typeof candidate.actualFormMinute === 'number' ? candidate.actualFormMinute : null,
    actualFormChosen:
      candidate.actualFormChosen === 'blue' || candidate.actualFormChosen === 'red'
        ? candidate.actualFormChosen
        : null,
    events: sanitizedEvents,
    playerSummaryNote:
      typeof candidate.playerSummaryNote === 'string' ? candidate.playerSummaryNote : '',
  };

  return { ok: true, review };
}

/**
 * Conversão opcional e conservadora de dados Riot Match-V5 + Timeline.
 * NUNCA inventa ganks falhos, tempo gasto no mato, prio de wave ou posição do jungler inimigo.
 * Apenas registra abates, mortes e objetivos épicos confirmados na timeline como ponto de partida
 * para o jogador completar manualmente.
 */
export interface MinimalRiotTimelineEvent {
  type: string;
  timestamp: number;
  killerId?: number;
  victimId?: number;
  assistingParticipantIds?: number[];
  monsterType?: string;
  position?: { x: number; y: number };
}

export interface MinimalRiotMatchData {
  metadata?: { matchId?: string };
  info?: {
    gameVersion?: string;
    participants?: Array<{
      puuid?: string;
      participantId?: number;
      championName?: string;
      teamId?: number;
    }>;
  };
}

export interface MinimalRiotTimelineData {
  info?: {
    frames?: Array<{
      events?: MinimalRiotTimelineEvent[];
    }>;
  };
}

function approximateLaneFromPosition(pos?: { x: number; y: number }): ReviewLaneFocus {
  if (!pos) return 'river';
  // Mapa SR aprox 0..15000: canto inferior direito = bot, superior esquerdo = top, diagonal central = mid
  if (pos.x > 9500 && pos.y < 6000) return 'bot';
  if (pos.x < 5500 && pos.y > 9000) return 'top';
  if (Math.abs(pos.x - pos.y) < 2500 && pos.x > 4500 && pos.x < 10500) return 'mid';
  return 'jungle';
}

export function convertRiotMatchTimelineToDraftReview(
  matchData: MinimalRiotMatchData,
  timelineData: MinimalRiotTimelineData,
  playerPuuid: string,
): ReviewMatch {
  const participants = matchData.info?.participants ?? [];
  const player = participants.find((p) => p.puuid === playerPuuid);
  const playerPid = player?.participantId ?? -1;
  const playerTeam = player?.teamId ?? 100;
  const enemyIds = new Set(
    participants.filter((p) => p.teamId !== playerTeam).map((p) => p.participantId),
  );
  const allyIds = new Set(
    participants.filter((p) => p.teamId === playerTeam).map((p) => p.participantId),
  );

  const rawEvents: MinimalRiotTimelineEvent[] = [];
  for (const frame of timelineData.info?.frames ?? []) {
    for (const ev of frame.events ?? []) {
      rawEvents.push(ev);
    }
  }

  const events: ReviewEvent[] = [];
  let seq = 1;

  for (const ev of rawEvents) {
    const minute = Math.max(1, Math.round((ev.timestamp / 60000) * 10) / 10);

    if (ev.type === 'CHAMPION_KILL') {
      const involvedAsKiller = ev.killerId === playerPid;
      const involvedAsAssist = Array.isArray(ev.assistingParticipantIds) && ev.assistingParticipantIds.includes(playerPid);
      const playerDied = ev.victimId === playerPid;

      if (!involvedAsKiller && !involvedAsAssist && !playerDied) continue;

      const lane = approximateLaneFromPosition(ev.position);
      // Verifica se houve objetivo inimigo confirmado nos 90s seguintes
      const nearbyEnemyObj = rawEvents.find(
        (other) =>
          other.type === 'ELITE_MONSTER_KILL' &&
          other.timestamp >= ev.timestamp &&
          other.timestamp <= ev.timestamp + 90000 &&
          enemyIds.has(other.killerId),
      );

      events.push({
        id: `riot-ev-${seq++}`,
        minute,
        type: playerDied ? 'death' : 'gank',
        lane,
        allyPrio: 'unknown',
        estimatedEnemyJungler: 'unknown',
        kaynHpPercent: null,
        resourcesReady: null,
        timeSpentSeconds: null,
        outcome: playerDied ? 'died' : involvedAsKiller ? 'kill' : 'assist',
        whatHappenedAfter: 'Evento extraído de abate/morte na Match-V5 (sem registro de tempo parado antes do lance).',
        enemyResponseText: nearbyEnemyObj
          ? `Inimigo confirmou ${nearbyEnemyObj.monsterType || 'objetivo épico'} logo após (~${Math.round((nearbyEnemyObj.timestamp - ev.timestamp) / 1000)}s depois).`
          : 'Sem objetivo épico inimigo confirmado imediatamente depois; revise campos perdidos no replay.',
        enemyResponseCertainty: nearbyEnemyObj ? 'confirmed' : 'hypothesis',
        executionNote: 'Preencha manualmente o que aconteceu na jogada e se houve erro de execução.',
        decisionContextSource: 'api_partial_hypothesis',
      });
    } else if (ev.type === 'ELITE_MONSTER_KILL' && (ev.killerId === playerPid || allyIds.has(ev.killerId))) {
      events.push({
        id: `riot-ev-${seq++}`,
        minute,
        type: 'objective',
        lane: 'river',
        allyPrio: 'unknown',
        estimatedEnemyJungler: 'unknown',
        kaynHpPercent: null,
        resourcesReady: null,
        timeSpentSeconds: null,
        outcome: 'completed_objective',
        whatHappenedAfter: `Objetivo aliado registrado (${ev.monsterType || 'Monstro épico'}).`,
        enemyResponseText: 'Verifique se o adversário trocou pelo objetivo/campos do outro lado.',
        enemyResponseCertainty: 'hypothesis',
        executionNote: '',
        decisionContextSource: 'api_partial_hypothesis',
      });
    }
  }

  return {
    id: `review-riot-${matchData.metadata?.matchId || Date.now()}`,
    title: `[Match-V5 Parcial] ${matchData.metadata?.matchId || 'Partida'} (${player?.championName || 'Kayn'})`,
    isExampleDemo: false,
    sourceLabel: 'Riot Match-V5 (importação parcial — complete hipóteses manualmente)',
    patch: matchData.info?.gameVersion?.split('.').slice(0, 2).join('.') || 'Desconhecido',
    rankContext: 'Solo/Duo',
    matchId: matchData.metadata?.matchId,
    plannedForm: 'blue',
    actualFormMinute: null,
    actualFormChosen: null,
    events,
    playerSummaryNote:
      'Importado via Match-V5: a API registra abates e objetivos, mas NÃO informa ganks que só queimaram Flash, wave exata ou tempo esperando no mato. Complete os lances manualmente.',
  };
}
