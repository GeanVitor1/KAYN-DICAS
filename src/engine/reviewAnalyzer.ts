import type {
  EnemyResponseCertainty,
  LanePrioState,
  RecurringPattern,
  ReviewAnalysis,
  ReviewDiagnosticFinding,
  ReviewDiagnosticReport,
  ReviewEvent,
  ReviewEventAnalysis,
  ReviewEventType,
  ReviewLaneFocus,
  ReviewMatch,
  ReviewMatchStats,
  ReviewOutcome,
} from '../shared/types';

export const REVIEW_JSON_SCHEMA_VERSION = 2;

const LANE_LABEL_PT: Record<ReviewLaneFocus, string> = {
  top: 'Top',
  mid: 'Mid',
  bot: 'Bot',
  jungle: 'Selva',
  river: 'Rio',
};

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

  // Eventos capturados automaticamente (Live Client Data ou LCU local) sem edição manual de wave
  if (
    (event.decisionContextSource === 'live_captured' ||
      event.decisionContextSource === 'lcu_captured') &&
    event.allyPrio === 'unknown' &&
    event.timeSpentSeconds === null
  ) {
    if (event.outcome === 'kill' || event.outcome === 'assist' || event.outcome === 'completed_objective') {
      return {
        quality: 'boa',
        reason:
          event.type === 'objective'
            ? 'Objetivo convertido e confirmado na timeline da partida.'
            : 'Jogada convertida em abate/assistência confirmada — confira no replay se o tempo investido compensou os campos da selva.',
      };
    }
    if (event.outcome === 'died') {
      if (event.enemyResponseCertainty === 'confirmed') {
        return {
          quality: 'ruim',
          reason:
            'Morte de alto custo: o time adversário converteu objetivo épico ou torre imediatamente após sua queda.',
        };
      }
      if (event.kaynHpPercent !== null && event.kaynHpPercent < 55) {
        return {
          quality: 'ruim',
          reason: `Você já estava com ~${event.kaynHpPercent}% de vida antes da morte — disputar ou estender sem resetar abriu margem para punição.`,
        };
      }
      if (event.minute <= 14) {
        return {
          quality: 'questionavel',
          reason:
            'Morte no early game (antes dos 14 min) atrasa sua forma e quebra o ritmo de campos do Kayn. Edite a prio da wave se conferir no replay.',
        };
      }
      return {
        quality: 'indeterminada',
        reason:
          'Morte capturada automaticamente (sem dados de wave/visão). Revise no replay se havia prio ou informação do caçador inimigo.',
      };
    }
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

function buildPostGameDiagnostic(
  stats: ReviewMatchStats,
  sortedEvents: ReviewEvent[],
): ReviewDiagnosticReport {
  const durationMinutes = Math.max(1, stats.durationSeconds / 60);
  const deathEvents = sortedEvents.filter((e) => e.type === 'death' || e.outcome === 'died');

  const deathsByLane: Record<ReviewLaneFocus, number> = {
    top: 0,
    mid: 0,
    bot: 0,
    jungle: 0,
    river: 0,
  };
  let earlyDeaths = 0;
  let deathsBeforeObjective = 0;

  for (const d of deathEvents) {
    deathsByLane[d.lane] = (deathsByLane[d.lane] ?? 0) + 1;
    if (d.minute <= 14) earlyDeaths += 1;
    if (d.enemyResponseCertainty === 'confirmed') {
      deathsBeforeObjective += 1;
    }
  }

  // Caso não haja timeline completa, usa os contadores consolidados
  const totalDeaths = Math.max(stats.deaths, deathEvents.length);
  const effectiveEarlyDeaths =
    deathEvents.length > 0 ? earlyDeaths : (stats.earlyBenchmarks?.deathsBefore14 ?? 0);

  // Detectar sequências de mortes em curto intervalo (<= 3.2 min entre mortes consecutivas)
  const deathStreaks: string[] = [];
  const streakMinutes: number[] = [];
  let streakStartIdx = 0;
  for (let i = 1; i <= deathEvents.length; i += 1) {
    const isConsecutive =
      i < deathEvents.length &&
      deathEvents[i].minute - deathEvents[i - 1].minute <= 3.2;
    if (!isConsecutive) {
      const len = i - streakStartIdx;
      if (len >= 2) {
        const firstMin = deathEvents[streakStartIdx].minute;
        const lastMin = deathEvents[i - 1].minute;
        deathStreaks.push(`${len} mortes seguidas entre Min ${firstMin} e Min ${lastMin}`);
        for (let k = streakStartIdx; k < i; k += 1) {
          streakMinutes.push(deathEvents[k].minute);
        }
      }
      streakStartIdx = i;
    }
  }

  const mistakes: ReviewDiagnosticFinding[] = [];
  const strengths: ReviewDiagnosticFinding[] = [];
  let score = stats.result === 'win' ? 76 : 64;

  // 1. Mortes que entregaram objetivos / torres (Crítico)
  if (deathsBeforeObjective >= 1) {
    const objDeathMins = deathEvents
      .filter((d) => d.enemyResponseCertainty === 'confirmed')
      .map((d) => d.minute);
    score -= Math.min(22, deathsBeforeObjective * 11);
    mistakes.push({
      id: 'diag-death-before-obj',
      severity: 'critico',
      category: 'objetivos',
      title: `${deathsBeforeObjective} morte(s) entregaram objetivo ou torre logo em seguida`,
      evidence: `Confirmado nos minutos: ${objDeathMins.map((m) => `Min ${m}`).join(', ')}.`,
      whyItCostGame:
        'Morrer perto da janela de Dragão, Vastilarvas, Arauto ou Barão tira o Golpear do seu time e transforma 1 morte em bola de neve global.',
      actionNextGame:
        '60s antes de Dragão/Barão/Vastilarvas, faça reset para gastar ouro e jogue sem forçar jogadas isoladas sem visão.',
      minutes: objDeathMins,
    });
  }

  // 2. Mortes no Early Game (<= 14 min)
  if (effectiveEarlyDeaths >= 2) {
    const earlyMins = deathEvents.filter((d) => d.minute <= 14).map((d) => d.minute);
    const isCritical = effectiveEarlyDeaths >= 3;
    score -= isCritical ? 16 : 8;
    mistakes.push({
      id: 'diag-early-deaths',
      severity: isCritical ? 'critico' : 'atencao',
      category: 'mortes',
      title: `${effectiveEarlyDeaths} mortes antes dos 14 min (Kayn base punido cedo)`,
      evidence:
        earlyMins.length > 0
          ? `Mortes cedo em: ${earlyMins.map((m) => `Min ${m}`).join(', ')}.`
          : `${effectiveEarlyDeaths} mortes registradas na fase inicial.`,
      whyItCostGame:
        'O Kayn base é fraco em 2v2/3v3 prolongados. Morrer cedo atrasa sua forma, quebra o ciclo de campos e entrega controle da selva para o jungler adversário.',
      actionNextGame:
        'Antes da forma, priorize full clear + escaramuças apenas com vantagem numérica ou CC aliado garantido. Não morra por orbe cedo.',
      minutes: earlyMins,
    });
  }

  // 3. Sequência de mortes em curto intervalo
  if (deathStreaks.length > 0) {
    score -= 10;
    mistakes.push({
      id: 'diag-death-streak',
      severity: 'critico',
      category: 'mortes',
      title: 'Sequência de mortes seguidas sem estabilizar o mapa',
      evidence: deathStreaks.join(' · '),
      whyItCostGame:
        'Voltar da base direto para outra luta em desvantagem multiplica a diferença de ouro/XP e impede recuperar o ritmo.',
      actionNextGame:
        'Após qualquer morte, faça 1 ciclo completo de campos seguros (lado oposto do mapa) antes de voltar a procurar luta.',
      minutes: streakMinutes,
    });
  }

  // 4. Concentração de mortes na mesma rota (especialmente Bot ou Selva)
  const laneEntries = (Object.entries(deathsByLane) as Array<[ReviewLaneFocus, number]>).sort(
    (a, b) => b[1] - a[1],
  );
  const topDeathLane = laneEntries[0];
  if (topDeathLane && topDeathLane[1] >= 2 && stats.captureSource === 'lcu_history') {
    const [laneKey, count] = topDeathLane;
    const laneMins = deathEvents.filter((d) => d.lane === laneKey).map((d) => d.minute);
    const isBotOrHeavy = laneKey === 'bot' || count >= 3;
    score -= isBotOrHeavy ? 10 : 5;
    mistakes.push({
      id: `diag-lane-deaths-${laneKey}`,
      severity: isBotOrHeavy ? 'critico' : 'atencao',
      category: laneKey === 'bot' ? 'bot_disciplina' : 'mortes',
      title: `${count} mortes concentradas na região ${LANE_LABEL_PT[laneKey]}`,
      evidence: `Ocorrências em: ${laneMins.map((m) => `Min ${m}`).join(', ')}.`,
      whyItCostGame:
        laneKey === 'bot'
          ? 'Insistir na Bot sem prio ou contra suporte/jungler preparados entrega ouro duplo para o ADC inimigo.'
          : laneKey === 'jungle'
            ? 'Morrer repetidamente na selva indica invasões sem prioridade de rota ou falta de visão defensiva.'
            : `Repetir lutas na região ${LANE_LABEL_PT[laneKey]} sem ajustar visão/setup manteve o time em desvantagem.`,
      actionNextGame:
        laneKey === 'bot'
          ? 'Aplique a regra dos 8 segundos na Bot: só desça com prio + CC aliado + noção do JG inimigo; senão jogue pelo Top/farm.'
          : laneKey === 'jungle'
            ? 'Use sentinela de controle defensiva na entrada da selva e troque de lado (vertical jungle) quando perder pressão.'
            : `Antes de voltar para ${LANE_LABEL_PT[laneKey]}, verifique a wave e se seu mid/suporte podem acompanhar.`,
      minutes: laneMins,
    });
  }

  // 5. Ritmo de Farm (CS/min e CS@10)
  const csAt10 = stats.earlyBenchmarks?.csAt10 ?? null;
  if (stats.csPerMin < 6.4 || (csAt10 !== null && csAt10 < 60)) {
    const isCritical = stats.csPerMin < 5.6 || (csAt10 !== null && csAt10 < 52);
    score -= isCritical ? 14 : 7;
    const cs10Part = csAt10 !== null ? ` · CS aos 10m: ${csAt10} (meta ≥ 64)` : '';
    mistakes.push({
      id: 'diag-low-cs',
      severity: isCritical ? 'critico' : 'atencao',
      category: 'farm_ritmo',
      title: `Ritmo de farm abaixo do potencial do Kayn (${stats.csPerMin} CS/min)`,
      evidence: `${stats.totalCs} CS em ${Math.round(durationMinutes)} min (${stats.csPerMin}/min · meta Kayn ≥ 6.8/min)${cs10Part}.`,
      whyItCostGame:
        'Mesmo com as runas e itens certos, o Kayn depende de vantagem de nível e pico rápido do 1º/2º item. Farm baixo atrasa seus itens em 2–4 minutos e faz você perder lutas que deveria ganhar.',
      actionNextGame:
        'Limpe seus campos no nascimento (respawn) antes de procurar gank. Se o gank não abrir em 8s, volte imediatamente para a selva.',
    });
  } else if (stats.csPerMin >= 7.0) {
    score += 7;
    strengths.push({
      id: 'str-good-cs',
      severity: 'positivo',
      category: 'farm_ritmo',
      title: `Ótimo ritmo de farm (${stats.csPerMin} CS/min)`,
      evidence: `${stats.totalCs} CS em ${Math.round(durationMinutes)} min${csAt10 !== null ? ` (${csAt10} CS aos 10m)` : ''}.`,
      whyItCostGame: 'Você manteve o fluxo de ouro e XP do Kayn em dia.',
      actionNextGame: 'Continue protegendo seus respawns de selva e convertendo o ouro em resets limpos antes de objetivos.',
    });
  }

  // 6. Janela longa sem farmar (tempo perdido rondando/forçando)
  const dryMins = stats.earlyBenchmarks?.longestFarmDrySpellMinutes ?? null;
  const dryRange = stats.earlyBenchmarks?.longestFarmDrySpellRange ?? null;
  if (dryMins !== null && dryMins >= 3 && dryRange) {
    score -= dryMins >= 4 ? 9 : 5;
    mistakes.push({
      id: 'diag-farm-dry-spell',
      severity: dryMins >= 4 ? 'critico' : 'atencao',
      category: 'farm_ritmo',
      title: `Janela de ${dryMins} min seguidos quase sem farmar (${dryRange})`,
      evidence: `Entre ${dryRange}, você ganhou no máximo 3 CS por minuto.`,
      whyItCostGame:
        'Ficar 3+ minutos sem limpar campos (esperando gank, andando sem destino ou morrendo em sequência) cria um buraco de nível e ouro no mid game.',
      actionNextGame:
        'Sempre planeje o próximo campo antes de terminar o atual; se uma jogada travar, dê recall ou limpe o lado oposto imediatamente.',
    });
  }

  // 7. Comparação direta contra o Jungler Inimigo aos 10 e 15 min (quando disponível via LCU timeline)
  const goldDiff15 = stats.earlyBenchmarks?.goldDiffAt15VsEnemyJg ?? null;
  const csDiff15 = stats.earlyBenchmarks?.csDiffAt15VsEnemyJg ?? null;
  const csDiff10 = stats.earlyBenchmarks?.csDiffAt10VsEnemyJg ?? null;
  if (
    (goldDiff15 !== null && goldDiff15 <= -700) ||
    (csDiff15 !== null && csDiff15 <= -14)
  ) {
    const isCritical = (goldDiff15 ?? 0) <= -1200 || (csDiff15 ?? 0) <= -22;
    score -= isCritical ? 12 : 6;
    mistakes.push({
      id: 'diag-behind-enemy-jg',
      severity: isCritical ? 'critico' : 'atencao',
      category: 'farm_ritmo',
      title: 'Desvantagem clara contra o caçador inimigo aos 15 min',
      evidence: `Diff @15 vs JG inimigo: ${csDiff15 !== null ? `${csDiff15 > 0 ? '+' : ''}${csDiff15} CS` : ''}${csDiff15 !== null && goldDiff15 !== null ? ' · ' : ''}${goldDiff15 !== null ? `${goldDiff15 > 0 ? '+' : ''}${goldDiff15} ouro` : ''}.`,
      whyItCostGame:
        'Chegar aos 15 min atrás do outro jungler faz você perder todas as disputas de 2º/3º Dragão e Arauto, mesmo com a build correta.',
      actionNextGame:
        'Quando o JG inimigo mostrar no lado oposto, puna imediatamente invadindo os campos dele ou garantindo objetivo/farm garantido.',
    });
  } else if ((goldDiff15 !== null && goldDiff15 >= 600) || (csDiff10 !== null && csDiff10 >= 10)) {
    score += 6;
    strengths.push({
      id: 'str-ahead-enemy-jg',
      severity: 'positivo',
      category: 'farm_ritmo',
      title: 'Vantagem consistente sobre o caçador inimigo no early/mid',
      evidence: `Diff vs JG inimigo: ${csDiff10 !== null ? `${csDiff10 > 0 ? '+' : ''}${csDiff10} CS @10` : ''}${goldDiff15 !== null ? ` · ${goldDiff15 > 0 ? '+' : ''}${goldDiff15} ouro @15` : ''}.`,
      whyItCostGame: 'Você saiu na frente no duelo direto da selva.',
      actionNextGame: 'Use essa vantagem para dominar visão no rio e forçar objetivos antes do inimigo empatar o item.',
    });
  }

  // 8. Volume total de mortes
  if (totalDeaths >= 6 && !mistakes.some((m) => m.id === 'diag-early-deaths')) {
    const isCritical = totalDeaths >= 8;
    score -= isCritical ? 14 : 7;
    mistakes.push({
      id: 'diag-high-deaths',
      severity: isCritical ? 'critico' : 'atencao',
      category: 'mortes',
      title: `Número alto de mortes (${totalDeaths} mortes em ${Math.round(durationMinutes)} min)`,
      evidence: `KDA final: ${stats.kills}/${totalDeaths}/${stats.assists} (${(totalDeaths / (durationMinutes / 10)).toFixed(1)} mortes a cada 10 min).`,
      whyItCostGame:
        'Cada morte no mid/late custa 30–50s fora do mapa — tempo suficiente para o adversário limpar sua selva, fechar Dragão/Barão ou levar torres.',
      actionNextGame:
        'Guarde o E para sair pelas paredes quando entrar em lutas e evite dar facecheck sem visão antes de objetivos.',
    });
  } else if (totalDeaths <= 3 && durationMinutes >= 18) {
    score += 7;
    strengths.push({
      id: 'str-low-deaths',
      severity: 'positivo',
      category: 'mortes',
      title: `Boa disciplina de sobrevivência (${totalDeaths} morte(s))`,
      evidence: `Apenas ${totalDeaths} morte(s) em ${Math.round(durationMinutes)} min de partida.`,
      whyItCostGame: 'Você evitou entregar tempo morto e recompensas gratuitas.',
      actionNextGame: 'Mantenha esse controle de risco enquanto acelera pressão nos objetivos.',
    });
  }

  // 9. Controle de objetivos épicos
  const allyMajorObj =
    stats.objectives.allyDragons +
    stats.objectives.allyHeralds +
    stats.objectives.allyBarons +
    (stats.objectives.allyGrubs >= 3 ? 1 : 0);
  const enemyMajorObj =
    stats.objectives.enemyDragons +
    stats.objectives.enemyHeralds +
    stats.objectives.enemyBarons +
    (stats.objectives.enemyGrubs >= 3 ? 1 : 0);

  if (enemyMajorObj - allyMajorObj >= 2 || (stats.objectives.allyDragons === 0 && stats.objectives.enemyDragons >= 3)) {
    const isCritical = enemyMajorObj - allyMajorObj >= 3 || stats.objectives.enemyDragons >= 4;
    score -= isCritical ? 12 : 6;
    mistakes.push({
      id: 'diag-objectives-lost',
      severity: isCritical ? 'critico' : 'atencao',
      category: 'objetivos',
      title: `Desvantagem forte em objetivos épicos (${stats.objectives.allyDragons}×${stats.objectives.enemyDragons} Dragões)`,
      evidence: `Aliados: ${stats.objectives.allyDragons} Dragões, ${stats.objectives.allyHeralds} Arauto, ${stats.objectives.allyBarons} Barão · Inimigos: ${stats.objectives.enemyDragons} Dragões, ${stats.objectives.enemyHeralds} Arauto, ${stats.objectives.enemyBarons} Barão.`,
      whyItCostGame:
        'Ceder objetivos seguidos sem trocar pelo lado oposto acelera a Alma/Barão inimigo e força seu time a aceitar lutas ruins.',
      actionNextGame:
        'Se não tiver prio para disputar o Dragão, troque imediatamente por Vastilarvas/Arauto/torre do lado oposto (nunca ceda de graça).',
    });
  } else if (allyMajorObj > enemyMajorObj && allyMajorObj >= 3) {
    score += 6;
    strengths.push({
      id: 'str-objectives',
      severity: 'positivo',
      category: 'objetivos',
      title: `Bom controle de objetivos (${stats.objectives.allyDragons} Dragões · ${stats.objectives.allyBarons} Barão)`,
      evidence: `Saldo positivo nos objetivos épicos (${allyMajorObj} contra ${enemyMajorObj} do adversário).`,
      whyItCostGame: 'Você converteu presença de mapa em objetivos concretos.',
      actionNextGame: 'Continue preparando reset + visão 45–60s antes dos objetivos.',
    });
  }

  // 10. Participação em abates (KP%)
  if (stats.killParticipationPct !== null) {
    if (stats.killParticipationPct < 42 && durationMinutes >= 16) {
      score -= 6;
      mistakes.push({
        id: 'diag-low-kp',
        severity: 'atencao',
        category: 'participacao',
        title: `Baixa participação nas lutas do time (${stats.killParticipationPct}% KP)`,
        evidence: `${stats.kills + stats.assists} participações de ${stats.teamKills} abates do time (meta Jungle ≥ 50%).`,
        whyItCostGame:
          'Ficar distante das lutas principais impede o Kayn de carregar no pico de 1–2 itens e deixa suas rotas jogando em desvantagem numérica.',
        actionNextGame:
          'Após fechar seu ciclo de campos, alinhe sua rota ao lado do mapa onde o próximo objetivo ou luta vai acontecer.',
      });
    } else if (stats.killParticipationPct >= 58) {
      score += 5;
      strengths.push({
        id: 'str-high-kp',
        severity: 'positivo',
        category: 'participacao',
        title: `Alta presença nas lutas (${stats.killParticipationPct}% KP)`,
        evidence: `Participou de ${stats.kills + stats.assists} dos ${stats.teamKills} abates da equipe.`,
        whyItCostGame: 'Você esteve presente nos momentos decisivos do mapa.',
        actionNextGame: 'Mantenha a presença alta sem sacrificar o ritmo de farm.',
      });
    }
  }

  // 11. Adaptação situacional de build (mesmo usando core certo, faltou contra-item?)
  if (
    stats.planComparison &&
    stats.planComparison.missingCounterItems.length > 0 &&
    durationMinutes >= 20
  ) {
    score -= 5;
    mistakes.push({
      id: 'diag-missing-counter-item',
      severity: 'atencao',
      category: 'build_plano',
      title: 'Faltou adaptação situacional contra o time inimigo',
      evidence: `Pendente na build final: ${stats.planComparison.missingCounterItems.join('; ')}.`,
      whyItCostGame:
        'A build core padrão sozinha perde eficiência quando o adversário fecha muita armadura, cura ou escudos no mid/late game.',
      actionNextGame:
        'A partir do 2º/3º item, adapte sua build às ameaças reais da partida (anti-cura, penetração de armadura ou Presa da Serpente).',
    });
  }

  // 12. Visão muito baixa (quando disponível via LCU)
  if (
    stats.visionScore !== null &&
    stats.visionScore !== undefined &&
    durationMinutes >= 18 &&
    stats.visionScore / durationMinutes < 0.45
  ) {
    score -= 4;
    mistakes.push({
      id: 'diag-low-vision',
      severity: 'atencao',
      category: 'objetivos',
      title: `Placar de visão baixo para jungler (${stats.visionScore} em ${Math.round(durationMinutes)}m)`,
      evidence: `${(stats.visionScore / durationMinutes).toFixed(2)} visão/min (ideal para jungler ≥ 0.7/min).`,
      whyItCostGame:
        'Sem visão/Lente do Oráculo nas entradas do rio, você entra no escuro em contraganks e perde o primeiro posicionamento em objetivos.',
      actionNextGame:
        'Troque para Lente do Oráculo cedo e leve 1 Sentinela de Controle antes de Dragão/Barão.',
    });
  }

  // Ordenar: críticos primeiro
  const severityOrder: Record<ReviewDiagnosticFinding['severity'], number> = {
    critico: 0,
    atencao: 1,
    positivo: 2,
  };
  mistakes.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const clampedScore = Math.max(15, Math.min(98, Math.round(score)));
  const grade: ReviewDiagnosticReport['grade'] =
    clampedScore >= 86
      ? 'S'
      : clampedScore >= 74
        ? 'A'
        : clampedScore >= 60
          ? 'B'
          : clampedScore >= 46
            ? 'C'
            : 'D';

  const topTwo = mistakes.slice(0, 2);
  let headline: string;
  if (topTwo.length === 0) {
    headline =
      stats.result === 'loss'
        ? 'Seus números individuais foram sólidos — a derrota veio mais de decisões pontuais de mid/late ou execução de teamfight (revise os lances da timeline no replay).'
        : 'Partida muito consistente em ritmo de farm, disciplina de mortes e controle de mapa.';
  } else if (stats.result === 'loss') {
    headline = `O que mais pesou nessa derrota: ${topTwo.map((m) => m.title.toLowerCase()).join(' + ')}.`;
  } else {
    headline = `Vitória garantida, mas dá para evoluir em: ${topTwo.map((m) => m.title.toLowerCase()).join(' + ')}.`;
  }

  const kdaRatio =
    totalDeaths === 0 ? stats.kills + stats.assists : (stats.kills + stats.assists) / totalDeaths;
  const kpiCards: ReviewDiagnosticReport['kpiCards'] = [
    {
      label: 'KDA / Mortes',
      value: `${stats.kills}/${totalDeaths}/${stats.assists}`,
      target: 'Meta ≤ 4 mortes',
      status: totalDeaths <= 4 && kdaRatio >= 2.5 ? 'good' : totalDeaths >= 7 ? 'bad' : 'warn',
    },
    {
      label: 'Ritmo de Farm',
      value: `${stats.csPerMin} CS/m`,
      target: csAt10 !== null ? `Meta ≥ 6.8 · @10: ${csAt10}` : 'Meta ≥ 6.8 CS/m',
      status: stats.csPerMin >= 6.8 ? 'good' : stats.csPerMin < 5.8 ? 'bad' : 'warn',
    },
    {
      label: 'Participação (KP)',
      value: stats.killParticipationPct !== null ? `${stats.killParticipationPct}%` : '—',
      target: 'Meta ≥ 50%',
      status:
        stats.killParticipationPct === null
          ? 'warn'
          : stats.killParticipationPct >= 52
            ? 'good'
            : stats.killParticipationPct < 40
              ? 'bad'
              : 'warn',
    },
    {
      label: 'Objetivos Épicos',
      value: `${stats.objectives.allyDragons}D · ${stats.objectives.allyBarons}B`,
      target: `Inimigo: ${stats.objectives.enemyDragons}D · ${stats.objectives.enemyBarons}B`,
      status:
        allyMajorObj >= enemyMajorObj
          ? 'good'
          : enemyMajorObj - allyMajorObj >= 3
            ? 'bad'
            : 'warn',
    },
  ];

  if (csDiff15 !== null || goldDiff15 !== null) {
    const diffLabel =
      goldDiff15 !== null
        ? `${goldDiff15 >= 0 ? '+' : ''}${goldDiff15}g`
        : `${(csDiff15 ?? 0) >= 0 ? '+' : ''}${csDiff15 ?? 0} CS`;
    kpiCards.push({
      label: 'Vs JG Inimigo @15',
      value: diffLabel,
      target: csDiff15 !== null ? `CS @15: ${csDiff15 >= 0 ? '+' : ''}${csDiff15}` : 'Meta ≥ 0',
      status:
        (goldDiff15 ?? 0) >= 200 && (csDiff15 ?? 0) >= 0
          ? 'good'
          : (goldDiff15 ?? 0) <= -800 || (csDiff15 ?? 0) <= -15
            ? 'bad'
            : 'warn',
    });
  }

  return {
    overallScore: clampedScore,
    grade,
    headline,
    topMistakes: mistakes.slice(0, 5),
    strengths: strengths.slice(0, 3),
    deathBreakdown: {
      total: totalDeaths,
      earlyDeaths: effectiveEarlyDeaths,
      midLateDeaths: Math.max(0, totalDeaths - effectiveEarlyDeaths),
      deathsBeforeObjective,
      deathsByLane,
      deathStreaks,
    },
    kpiCards,
  };
}
  const diagnostic = match.matchStats
    ? buildPostGameDiagnostic(match.matchStats, sortedEvents)
    : undefined;

  // Foco prático para as próximas partidas
  let nextGamesFocus =
    'Regra dos 8 segundos na Bot: só cruze a parede se houver CC/setup aliado e ideia clara do jungler inimigo; se não abrir em 8s, volte para os campos.';
  if (diagnostic && diagnostic.topMistakes.length > 0) {
    nextGamesFocus = `Foco principal: ${diagnostic.topMistakes[0].actionNextGame}`;
  } else if (recurringPatterns.some((p) => p.id === 'pattern-bot-repeat')) {
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
    diagnostic,
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
        rawEv.decisionContextSource === 'api_partial_hypothesis' ||
        rawEv.decisionContextSource === 'live_captured' ||
        rawEv.decisionContextSource === 'lcu_captured'
          ? rawEv.decisionContextSource
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
    matchStats:
      candidate.matchStats && typeof candidate.matchStats === 'object'
        ? (candidate.matchStats as ReviewMatchStats)
        : undefined,
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
