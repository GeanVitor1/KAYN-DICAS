import type {
  TrainingAnalysis,
  TrainingOptionEvaluation,
  TrainingOptionId,
  TrainingScenario,
} from '../shared/types';

const OPTION_LABELS: Record<TrainingOptionId, string> = {
  start_objective: 'Jogar pelo objetivo (Dragão / Vastilarvas / Arauto)',
  gank_bot: 'Gankar ou convergir na Bot Lane',
  gank_other_lane: 'Gankar Mid/Top alternativo',
  farm_route: 'Seguir rota de farm na jungle',
  reset_spend_gold: 'Resetar (Base) para gastar ouro e repor vida/visão',
};

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function analyzeTrainingScenario(scenario: TrainingScenario): TrainingAnalysis {
  const observedFacts: string[] = [];
  const workingHypotheses: string[] = [];
  const unknownFields: string[] = [];
  const conditionalDecisions: string[] = [];

  // Separar CS de lane e campos da jungle explicitamente
  let farmTempoNote: string;
  if (scenario.laneCs !== null && scenario.jungleCampsCleared !== null) {
    const expectedCamps = Math.max(4, Math.round(scenario.minute * 1.35));
    const paceLabel =
      scenario.jungleCampsCleared >= expectedCamps
        ? 'ritmo de selva sólido'
        : 'ritmo de selva abaixo do ideal';
    farmTempoNote = `Ritmo separado — Selva: ${scenario.jungleCampsCleared} campos (~${expectedCamps} esperado no min ${scenario.minute}, ${paceLabel}) | CS de lane: ${scenario.laneCs}. CS alto não autoriza objetivo sem pressão/visão, e CS baixo não manda ignorar uma jogada 100% livre.`;
    observedFacts.push(`Campos na selva: ${scenario.jungleCampsCleared}; CS de lane: ${scenario.laneCs}.`);
  } else if (scenario.jungleCampsCleared !== null) {
    farmTempoNote = `Campos na selva: ${scenario.jungleCampsCleared} (CS de lane não separado nesta leitura). Ritmo contextualiza tempo, nunca substitui prioridade e visão.`;
    observedFacts.push(`Campos na selva informados: ${scenario.jungleCampsCleared}.`);
    unknownFields.push('CS de lane não informado separadamente.');
  } else if (scenario.laneCs !== null) {
    farmTempoNote = `CS de lane informado (${scenario.laneCs}), mas contagem de campos da selva desconhecida — evite usar CS bruto sozinho para justificar dragão ou farm cego.`;
    unknownFields.push('Contagem separada de campos da jungle desconhecida.');
  } else {
    farmTempoNote = 'CS de lane e campos da jungle não informados; decisão prioriza recursos atuais, pressão e visão do mapa.';
    unknownFields.push('Ritmo de farm (CS de lane e campos da jungle) não informado.');
  }

  observedFacts.push(
    `Minuto ${scenario.minute}, nível ${scenario.level}, forma ${scenario.kaynFormState === 'base' ? 'Kayn Base' : scenario.kaynFormState === 'blue' ? 'Kayn Azul' : 'Rhaast'}, vida ${scenario.hpPercent}%, ouro na mão ${scenario.unspentGold}g.`,
  );

  // Classificação de prios e posição inimiga entre observado vs desconhecido
  if (scenario.botPrio === 'unknown') unknownFields.push('Prioridade da Bot Lane desconhecida.');
  else observedFacts.push(`Prioridade na Bot: ${scenario.botPrio}.`);

  if (scenario.midPrio === 'unknown') unknownFields.push('Prioridade do Mid desconhecida.');
  else observedFacts.push(`Prioridade no Mid: ${scenario.midPrio}.`);

  if (scenario.topPrio === 'unknown') unknownFields.push('Prioridade do Top desconhecida.');
  else observedFacts.push(`Prioridade no Top: ${scenario.topPrio}.`);

  if (scenario.enemyJunglerPosition === 'unknown') {
    unknownFields.push('Posição do jungler inimigo fora de visão (desconhecida).');
    workingHypotheses.push('Sem visão do jungler inimigo, assuma risco real de ele estar no mesmo lado ou próximo de responder ao seu avanço.');
  } else {
    observedFacts.push(`Jungler inimigo confirmado em: ${scenario.enemyJunglerPosition}.`);
  }

  if (scenario.botSupportHpLow === 'unknown') unknownFields.push('Vida do suporte aliado na Bot desconhecida.');
  if (scenario.alliesCanMoveBot === 'unknown') unknownFields.push('Capacidade de rotação imediata da Bot desconhecida.');
  if (scenario.alliesCanMoveMid === 'unknown') unknownFields.push('Capacidade de rotação imediata do Mid desconhecida.');
  if (scenario.botWaveState === 'unknown') unknownFields.push('Estado exato da wave na Bot desconhecido.');
  if (scenario.nearbyAlliesCount === null || scenario.nearbyEnemiesCount === null) {
    unknownFields.push('Contagem exata de aliados/inimigos em alcance de resposta incompleta.');
  }

  // Pontuação determinística das 5 opções
  const scores: Record<TrainingOptionId, number> = {
    start_objective: 0,
    gank_bot: 0,
    gank_other_lane: 0,
    farm_route: 3.0, // base estável de farm seguro
    reset_spend_gold: 1.5,
  };
  const reasons: Record<TrainingOptionId, string[]> = {
    start_objective: [],
    gank_bot: [],
    gank_other_lane: [],
    farm_route: [],
    reset_spend_gold: [],
  };
  const winConds: Record<TrainingOptionId, string[]> = {
    start_objective: [],
    gank_bot: [],
    gank_other_lane: [],
    farm_route: [],
    reset_spend_gold: [],
  };
  const abortConds: Record<TrainingOptionId, string[]> = {
    start_objective: [],
    gank_bot: [],
    gank_other_lane: [],
    farm_route: [],
    reset_spend_gold: [],
  };

  // === 1. AVALIAÇÃO DO OBJETIVO ===
  if (scenario.objectiveType === 'none') {
    scores.start_objective = -10;
    reasons.start_objective.push('Nenhum objetivo épico relevante disponível na janela atual.');
  } else {
    const objLabel =
      scenario.objectiveType === 'dragon'
        ? 'Dragão'
        : scenario.objectiveType === 'voidgrubs'
          ? 'Vastilarvas'
          : scenario.objectiveType === 'herald'
            ? 'Arauto'
            : 'Barão';
    const isBotSideObj = scenario.objectiveType === 'dragon';
    const prioOk = isBotSideObj
      ? (scenario.botPrio === 'ally' || scenario.alliesCanMoveBot === 'yes') &&
        (scenario.midPrio === 'ally' || scenario.alliesCanMoveMid === 'yes')
      : (scenario.topPrio === 'ally') && (scenario.midPrio === 'ally' || scenario.alliesCanMoveMid === 'yes');

    const enemyOppositeSide = isBotSideObj
      ? scenario.enemyJunglerPosition === 'top_side' || scenario.enemyJunglerPosition === 'base_or_dead'
      : scenario.enemyJunglerPosition === 'bot_side' || scenario.enemyJunglerPosition === 'base_or_dead';

    const enemySameSide = isBotSideObj
      ? scenario.enemyJunglerPosition === 'bot_side'
      : scenario.enemyJunglerPosition === 'top_side';

    if (scenario.objectiveSpawnInSeconds > 35) {
      scores.start_objective -= 3.5;
      reasons.start_objective.push(`${objLabel} ainda nasce em ${scenario.objectiveSpawnInSeconds}s — há tempo para gastar ouro ou limpar campo antes.`);
    } else if (scenario.objectiveSpawnInSeconds <= 15) {
      scores.start_objective += 1.5;
    }

    if (isBotSideObj && scenario.botPrio === 'enemy') {
      scores.start_objective -= 5.0;
      reasons.start_objective.push('Bot aliada sem prioridade: inimigos chegam primeiro para contestar ou prender você no covil.');
    }
    if (isBotSideObj && scenario.botSupportHpLow === 'yes') {
      scores.start_objective -= 3.0;
      reasons.start_objective.push('Suporte aliado com pouca vida não consegue defender o rio nem dar peel.');
    }
    if (scenario.midPrio === 'enemy') {
      scores.start_objective -= 3.0;
      reasons.start_objective.push('Mid sem prioridade abre rotação livre do mid inimigo.');
    }
    if (scenario.enemyJunglerPosition === 'unknown') {
      scores.start_objective -= 2.5;
      reasons.start_objective.push('Jungler inimigo fora de visão: começar objetivo sem prio arrisca entregar abate + objetivo.');
    } else if (enemyOppositeSide) {
      scores.start_objective += 4.2;
      reasons.start_objective.push(`Jungler inimigo confirmado longe (${scenario.enemyJunglerPosition}), criando janela numérica clara para ${objLabel}.`);
    } else if (enemySameSide) {
      scores.start_objective -= 2.5;
      reasons.start_objective.push('Jungler inimigo já está no mesmo lado e pode contestar.');
    }

    if (prioOk && scenario.hpPercent >= 60 && scenario.objectiveSpawnInSeconds <= 20) {
      scores.start_objective += 4.0;
      reasons.start_objective.push('Mid e rota adjacente têm capacidade de se mover e seus recursos estão saudáveis.');
    } else if (scenario.hpPercent < 55) {
      scores.start_objective -= 3.0;
      reasons.start_objective.push(`Vida atual (${scenario.hpPercent}%) baixa para absorver objetivo e eventual contestação.`);
    }

    if (scenario.laneCs !== null && scenario.laneCs >= 40 && scores.start_objective < 3) {
      reasons.start_objective.push('CS alto não compensa falta de prioridade das lanes ou ausência de visão do jungler inimigo.');
    }

    winConds.start_objective.push(
      'Confirme sentinela/lente limpa no covil e garanta que Mid/Bot realmente consigam acompanhar antes de puxar o objetivo.',
    );
    abortConds.start_objective.push(
      'Aborte e solte o objetivo se a wave do Mid/Bot quebrar para o inimigo ou se o jungler adversário aparecer com vantagem numérica.',
    );
  }

  // === 2. AVALIAÇÃO DE GANK NA BOT ===
  if (scenario.botWaveState === 'pushed_to_ally' || scenario.botWaveState === 'frozen_enemy') {
    if (scenario.botAllySetupReady === 'yes') {
      scores.gank_bot += 3.5;
      reasons.gank_bot.push('Inimigo avançado contra sua Bot e setup aliado pronto para travar o alvo.');
    } else if (scenario.botAllySetupReady === 'no') {
      scores.gank_bot -= 1.0;
      reasons.gank_bot.push('Mesmo com wave avançada, falta setup aliado confiável na Bot.');
    }
  } else if (scenario.botWaveState === 'pushed_to_enemy') {
    scores.gank_bot -= 2.5;
    reasons.gank_bot.push('Wave empurrada para a torre inimiga fecha ângulo limpo de gank (salvo dive claro com visão).');
  }

  if (scenario.botSupportHpLow === 'yes') {
    scores.gank_bot -= 2.8;
    reasons.gank_bot.push('Suporte aliado baixo pode morrer no contragank ou não conseguir acompanhar a entrada.');
  }
  if (scenario.timeAlreadyWaitingSeconds >= 10) {
    scores.gank_bot -= 3.2;
    reasons.gank_bot.push(`Você já perdeu ${scenario.timeAlreadyWaitingSeconds}s esperando: insistir na Bot agora aumenta o custo de tempo e expõe seus campos.`);
  }
  if (scenario.enemyJunglerPosition === 'bot_side' && scenario.nearbyEnemiesCount !== null && scenario.nearbyAlliesCount !== null && scenario.nearbyEnemiesCount >= scenario.nearbyAlliesCount) {
    scores.gank_bot -= 3.0;
    reasons.gank_bot.push('Risco direto de resposta/contragank inimigo na Bot.');
  }
  if (scenario.enemyJunglerPosition === 'unknown' && scenario.gameState === 'behind') {
    scores.gank_bot -= 2.5;
    reasons.gank_bot.push('Atrás no jogo e sem visão do jungler inimigo, forçar gank por orbes tem retorno esperado negativo.');
  }
  if (scenario.hpPercent < 55) {
    scores.gank_bot -= 2.5;
    reasons.gank_bot.push(`Vida baixa (${scenario.hpPercent}%) facilita virada dupla da Bot inimiga.`);
  }

  winConds.gank_bot.push('Entre pelo ângulo de parede apenas se os aliados tiverem vida/CDs prontos e você souber onde está o jungler inimigo (ou tiver vantagem numérica).');
  abortConds.gank_bot.push('Aborte imediatamente após 5-8s sem abertura, se o suporte aliado recuar por vida baixa ou se o Mid inimigo sumir da rota.');

  // === 3. OUTRA LANE ===
  if (scenario.otherLaneSetupReady === 'yes' && scenario.otherLaneEnemyOverextended === 'yes') {
    scores.gank_other_lane += 4.0;
    reasons.gank_other_lane.push(`O ${scenario.otherLaneTarget.toUpperCase()} está avançado e com setup aliado pronto.`);
  } else if (scenario.otherLaneSetupReady === 'yes' || scenario.otherLaneEnemyOverextended === 'yes') {
    scores.gank_other_lane += 1.2;
    reasons.gank_other_lane.push(`Há condição parcial no ${scenario.otherLaneTarget.toUpperCase()}, mas exige timing limpo de chegada.`);
  } else {
    scores.gank_other_lane -= 1.5;
    reasons.gank_other_lane.push(`Sem sinal forte de sobreextensão nem setup garantido no ${scenario.otherLaneTarget.toUpperCase()}.`);
  }
  if (scenario.hpPercent < 55) {
    scores.gank_other_lane -= 2.0;
  }
  winConds.gank_other_lane.push(`Convergir só se o ${scenario.otherLaneTarget.toUpperCase()} inimigo estiver fora de alcance da torre e você não queimar tempo parado.`);
  abortConds.gank_other_lane.push('Se o alvo recuar antes da sua aproximação, siga direto para o campo adjacente.');

  // === 4. ROTA DE FARM ===
  if (scenario.availableCampsCount >= 2) {
    scores.farm_route += 2.2;
    reasons.farm_route.push(`${scenario.availableCampsCount} campos prontos (${scenario.suggestedFarmRoute}) garantem ouro e XP sem depender de erro adversário.`);
  } else if (scenario.availableCampsCount === 0) {
    scores.farm_route -= 3.5;
    reasons.farm_route.push('Sem campos disponíveis agora na sua selva.');
  }

  if (scenario.gameState === 'behind') {
    scores.farm_route += 2.2;
    reasons.farm_route.push('Estando atrás, recuperar ouro/nível nos campos é mais confiável do que forçar orbes no escuro — orbes valem muito mais após os 8-12 min.');
  }
  if (scenario.timeAlreadyWaitingSeconds >= 10 && scenario.availableCampsCount >= 1) {
    scores.farm_route += 2.0;
    reasons.farm_route.push('Sair da espera para limpar campos evita perder outro ciclo inteiro de selva.');
  }
  if (scenario.unspentGold >= scenario.keyComponentCost && scenario.objectiveType !== 'none' && scenario.objectiveSpawnInSeconds >= 20 && scenario.objectiveSpawnInSeconds <= 55) {
    scores.farm_route -= 1.8;
    reasons.farm_route.push('Limpar mais campos agora pode atrasar o seu reset e fazer você chegar no objetivo sem gastar ouro ou sem tempo de setup.');
  }
  winConds.farm_route.push('Mantenha sequência limpa sem voltar para a mesma espera e acompanhe o minimapa caso um inimigo erre perto.');
  abortConds.farm_route.push('Só interrompa o campo se houver abate 100% garantido a 3 segundos de distância sem risco de morrer.');

  // === 5. RESET PARA GASTAR OURO ===
  const canBuySpike = scenario.unspentGold >= scenario.keyComponentCost;
  if (canBuySpike) {
    scores.reset_spend_gold += 2.8;
    reasons.reset_spend_gold.push(
      `Ouro suficiente (${scenario.unspentGold}g >= ${scenario.keyComponentCost}g) para fechar ${scenario.itemSpikeLabel}.`,
    );
  } else {
    scores.reset_spend_gold -= 1.0;
    reasons.reset_spend_gold.push(
      `Faltam ${Math.max(0, scenario.keyComponentCost - scenario.unspentGold)}g para ${scenario.itemSpikeLabel}.`,
    );
  }

  if (scenario.hpPercent < 55) {
    scores.reset_spend_gold += 2.8;
    reasons.reset_spend_gold.push(`Vida baixa (${scenario.hpPercent}%) aumenta risco de morrer em qualquer contestação.`);
  }

  if (scenario.objectiveType !== 'none' && scenario.objectiveSpawnInSeconds >= 25 && scenario.objectiveSpawnInSeconds <= 60 && canBuySpike) {
    scores.reset_spend_gold += 2.8;
    reasons.reset_spend_gold.push(
      `Objetivo nasce em ${scenario.objectiveSpawnInSeconds}s: resetar agora permite chegar com ${scenario.itemSpikeLabel}, vida cheia e sentinela a tempo da disputa.`,
    );
  } else if (scenario.objectiveType !== 'none' && scenario.objectiveSpawnInSeconds <= 10 && scenario.hpPercent >= 70) {
    scores.reset_spend_gold -= 2.0;
    reasons.reset_spend_gold.push('Objetivo já está vivo/nascendo em <= 10s — resetar agora entrega o covil se sua equipe puder contestar.');
  }
  winConds.reset_spend_gold.push('Volte à base imediatamente após finalizar o campo atual (ou direto da moita segura) para não perder o timing do objetivo.');
  abortConds.reset_spend_gold.push('Só adie o reset se faltar < 150g num campo a 3s e o objetivo ainda demorar > 45s.');

  // Ordenar e produzir vereditos
  const evaluations: TrainingOptionEvaluation[] = (Object.keys(scores) as TrainingOptionId[])
    .map((id) => ({
      optionId: id,
      label: OPTION_LABELS[id],
      score: round1(scores[id]),
      verdict: 'alternativa' as TrainingOptionEvaluation['verdict'],
      reasons: reasons[id],
      conditionsToWin: winConds[id],
      abortConditions: abortConds[id],
    }))
    .sort((a, b) => b.score - a.score);

  evaluations.forEach((ev, idx) => {
    if (idx === 0) ev.verdict = 'preferida';
    else if (idx === 1 && ev.score >= 1.5) ev.verdict = 'alternativa';
    else if (ev.score < 0) ev.verdict = 'evitar';
    else ev.verdict = 'arriscada';
  });

  const preferredOption = evaluations[0];
  const secondOption = evaluations[1];

  // Descobrir a informação que mais mudaria a análise
  let mostImpactfulUnknown = 'Confirmar em qual quadrante o jungler inimigo foi visto por último e quando reseta.';
  if (scenario.enemyJunglerPosition === 'unknown') {
    mostImpactfulUnknown =
      'Localização real do jungler inimigo: vê-lo no Top libera Bot/Dragão imediatamente; vê-lo perto da Bot transforma invasão/objetivo em armadilha.';
  } else if (scenario.botPrio === 'unknown' || scenario.midPrio === 'unknown') {
    mostImpactfulUnknown =
      'Estado real de prioridade e vida no Mid/Bot: saber quem consegue sair primeiro da wave define se o objetivo é seguro ou suicídio.';
  } else if (scenario.botAllySetupReady === 'unknown' || scenario.botSupportHpLow === 'unknown') {
    mostImpactfulUnknown =
      'Recursos reais do suporte aliado (vida, mana e cooldown de engage/CC): sem isso, o gank na Bot é puro chute.';
  }

  // Decisões condicionais explícitas quando faltam dados
  if (unknownFields.length > 0) {
    if (scenario.enemyJunglerPosition === 'unknown') {
      conditionalDecisions.push(
        'SE o jungler inimigo aparecer no lado oposto -> suba a prioridade de Objetivo ou gank no lado livre imediatamente.',
      );
      conditionalDecisions.push(
        'SE o jungler inimigo continuar fora de visão -> evite gastar E ofensivo sem visão profunda e prefira campos seguros / reset.',
      );
    }
    if (scenario.botPrio === 'unknown' || scenario.midPrio === 'unknown' || scenario.alliesCanMoveBot === 'unknown') {
      conditionalDecisions.push(
        'SE Mid e Bot empurrarem a wave e tiverem vida -> você ganha janela real para preparar visão no rio e iniciar objetivo.',
      );
      conditionalDecisions.push(
        'SE qualquer uma das duas rotas perder pressão ou ficar presa sob torre -> cancele o objetivo e troque pelo campo oposto ou reset.',
      );
    }
  }

  // Alerta de armadilha (ex: Bot tentadora ou Dragão com CS alto mas sem prio)
  let trapWarning: string | undefined;
  if (scenario.timeAlreadyWaitingSeconds >= 10 && scenario.availableCampsCount >= 1) {
    trapWarning = `Armadilha de tempo perdido: insistir na Bot após ${scenario.timeAlreadyWaitingSeconds}s de espera enquanto há ${scenario.availableCampsCount} campos prontos abre vantagem gratuita para o jungler inimigo.`;
  } else if (scenario.objectiveType === 'dragon' && (scenario.botPrio === 'enemy' || scenario.botSupportHpLow === 'yes') && scores.start_objective < 1) {
    trapWarning = 'Armadilha clássica de SoloQ: não comece Dragão sem prioridade na Bot/Mid ou com suporte baixo, mesmo que seu farm esteja adiantado.';
  } else if (scenario.gameState === 'behind' && scenario.needOrbsUrgently && scenario.enemyJunglerPosition === 'unknown') {
    trapWarning = 'Armadilha de orbes: forçar gank no escuro só para encher a barra enquanto está atrás costuma resultar em morte dupla e atraso ainda maior da forma.';
  }

  return {
    preferredOption,
    secondOption,
    rankedOptions: evaluations,
    mostImpactfulUnknown,
    farmTempoNote,
    observedFacts,
    workingHypotheses,
    unknownFields,
    conditionalDecisions,
    trapWarning,
  };
}
