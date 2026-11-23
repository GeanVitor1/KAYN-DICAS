import type {
  CatalogSnapshot,
  ChampionTacticalProfile,
  ConfidenceLevel,
  DraftAnalysis,
  DraftState,
  FrozenMicroComboCard,
  FrozenPreGameCard,
  KaynFormChoice,
  LaneAnalysis,
  LaneRole,
  TargetLane,
  WeightFactorDetail,
} from '../shared/types';
import {
  BUILD_DATA_META,
  buildItemRecommendation,
  buildRuneRecommendation,
} from './buildProfiles';
import {
  TACTICAL_DATA_META,
  getChampionTacticalProfile,
} from './championTactics';
import { getOrbMechanicsExplanation } from './kaynMechanics';

export interface DraftAnalyzerOptions {
  preferBlueAsTiebreaker: boolean;
}

const COMMON_FLEX_PICKS = new Set([
  'Jayce',
  'Gragas',
  'Sylas',
  'Pantheon',
  'Karma',
  'Lux',
  'Taliyah',
  'Sett',
  'Yasuo',
  'Yone',
  'Hwei',
  'Aurora',
  'Brand',
  'Morgana',
  'Swain',
  'Poppy',
  'Maokai',
  'Mordekaiser',
  'Ambessa',
]);

const LANE_LABELS: Record<TargetLane, string> = {
  top: 'Top',
  mid: 'Mid',
  bot: 'Bot',
};

const ROLE_LABELS: Record<LaneRole, string> = {
  top: 'Top',
  jungle: 'Jungle',
  mid: 'Mid',
  bot: 'ADC',
  support: 'Suporte',
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getProfileList(
  side: Record<LaneRole, string | null>,
  catalog: CatalogSnapshot,
  excludeChampionId?: string,
): Array<{ role: LaneRole; profile: ChampionTacticalProfile; name: string }> {
  const result: Array<{ role: LaneRole; profile: ChampionTacticalProfile; name: string }> = [];
  const roles: LaneRole[] = ['top', 'jungle', 'mid', 'bot', 'support'];
  for (const role of roles) {
    const id = side[role];
    if (!id || id === excludeChampionId) continue;
    const profile = getChampionTacticalProfile(id, catalog);
    if (!profile) continue;
    result.push({
      role,
      profile,
      name: catalog.champions[id]?.name ?? id,
    });
  }
  return result;
}

function analyzeTargetLane(
  lane: TargetLane,
  draft: DraftState,
  catalog: CatalogSnapshot,
  enemyJunglerProfile: ChampionTacticalProfile | null,
  preferredForm: KaynFormChoice,
): LaneAnalysis {
  const label = LANE_LABELS[lane];

  const allyRoles: LaneRole[] = lane === 'bot' ? ['bot', 'support'] : [lane];
  const enemyRoles: LaneRole[] = lane === 'bot' ? ['bot', 'support'] : [lane];

  const allyList = allyRoles
    .map((r) => {
      const id = draft.allies[r];
      return id ? { role: r, id, name: catalog.champions[id]?.name ?? id, p: getChampionTacticalProfile(id, catalog) } : null;
    })
    .filter((x): x is { role: LaneRole; id: string; name: string; p: ChampionTacticalProfile } => Boolean(x && x.p));

  const enemyList = enemyRoles
    .map((r) => {
      const id = draft.enemies[r];
      return id ? { role: r, id, name: catalog.champions[id]?.name ?? id, p: getChampionTacticalProfile(id, catalog) } : null;
    })
    .filter((x): x is { role: LaneRole; id: string; name: string; p: ChampionTacticalProfile } => Boolean(x && x.p));

  if (allyList.length === 0 || enemyList.length === 0) {
    return {
      lane,
      label,
      firstWindowScore: 0,
      playAroundScore: 0,
      countergankRisk: 'medio',
      conversionPotential: 'medio',
      allySetupSummary: allyList.length === 0 ? 'Aliado ainda não escolhido nesta rota.' : allyList.map((a) => a.name).join(' + '),
      enemyDefenseSummary: enemyList.length === 0 ? 'Adversário ainda não escolhido nesta rota.' : enemyList.map((e) => e.name).join(' + '),
      favorableConditionSentence: `Preencha aliado e inimigo no ${label} para avaliar ângulos de entrada sem chute.`,
      fallbackConditionSentence: `Com ${label} incompleta no draft, priorize clear limpo e só apareça se houver setup garantido ou sobreextensão clara.`,
      factorBreakdown: ['Rota com campeões pendentes no draft.'],
    };
  }

  // Na Bot (2v2), o setup/CC principal de quem abre a jogada (ex.: Nautilus + Kai'Sa) não cai pela metade por causa do ADC.
  const weightedDuo = (values: number[], primaryWeight: number): number => {
    if (values.length === 1) return values[0];
    const sorted = [...values].sort((a, b) => b - a);
    return sorted[0] * primaryWeight + sorted[1] * (1 - primaryWeight);
  };

  const allySetup =
    lane === 'bot'
      ? weightedDuo(allyList.map((a) => a.p.gankSetupScore), 0.78)
      : allyList.reduce((acc, a) => acc + a.p.gankSetupScore, 0) / allyList.length;
  const allyCc =
    lane === 'bot'
      ? weightedDuo(allyList.map((a) => a.p.ccScore), 0.78)
      : allyList.reduce((acc, a) => acc + a.p.ccScore, 0) / allyList.length;
  const ally2v2 = allyList.reduce((acc, a) => acc + a.p.early2v2Score, 0) / allyList.length;

  // Fuga na Bot usa média (um alvo imóvel como Jhin ainda é punível), mas Peel usa peso maior no protetor (ex.: Milio/Lulu)
  const enemyEscape = enemyList.reduce((acc, e) => acc + e.p.escapeScore, 0) / enemyList.length;
  const enemyPeel =
    lane === 'bot'
      ? weightedDuo(enemyList.map((e) => e.p.peelScore), 0.75)
      : enemyList.reduce((acc, e) => acc + e.p.peelScore, 0) / enemyList.length;
  const enemyCc =
    lane === 'bot'
      ? weightedDuo(enemyList.map((e) => e.p.ccScore), 0.72)
      : enemyList.reduce((acc, e) => acc + e.p.ccScore, 0) / enemyList.length;
  const enemy2v2 = enemyList.reduce((acc, e) => acc + e.p.early2v2Score, 0) / enemyList.length;
  const enemyPriority = Math.max(...enemyList.map((e) => e.p.priorityTargetWeight));

  // Risco de contragank considera força early do jungler inimigo + força 2v2/3v3 da lane inimiga
  const enemyJgEarly = enemyJunglerProfile ? enemyJunglerProfile.early2v2Score : 1.5;
  const skirmishEdge = ally2v2 + 0.8 - (enemy2v2 + enemyJgEarly * 0.55);
  const countergankRisk: LaneAnalysis['countergankRisk'] =
    enemyJgEarly >= 2.5 && skirmishEdge < 0.3
      ? 'alto'
      : skirmishEdge < -0.4 || enemyJgEarly >= 2
        ? 'medio'
        : 'baixo';

  // Potencial de conversão pós-gank (Dragão/2 alvos na Bot, Vastilarvas/lane longa no Top, rio no Mid)
  const conversionScore =
    lane === 'bot'
      ? (enemyPriority >= 2.5 ? 2.3 : 1.65) + (allySetup >= 1.9 ? 0.55 : 0)
      : lane === 'top'
        ? 2.1 + (ally2v2 >= 2 ? 0.65 : 0) // Lane longa + Vastilarvas/Arauto/placas
        : 1.85 + (ally2v2 >= 2 ? 0.45 : 0); // Mid é a rota mais curta — depende de setup real

  const conversionPotential: LaneAnalysis['conversionPotential'] =
    conversionScore >= 2.5 ? 'alto' : conversionScore >= 1.8 ? 'medio' : 'baixo';

  // Geometria real de Summoner's Rift: Mid é a rota mais curta (inimigo chega na torre em 2 passos, pior ainda contra mobilidade),
  // enquanto Top e Bot são rotas longas com paredes grossas ideais para o E do Kayn.
  const midShortLaneFirstPenalty = lane === 'mid' ? 0.8 + (enemyEscape >= 2 ? 0.65 : 0) : 0;
  const midShortLanePlayPenalty = lane === 'mid' ? 0.55 + (enemyEscape >= 2 ? 0.45 : 0) : 0;
  const sideLaneWallBonus = lane === 'mid' ? 0 : 0.35;

  // Bônus de orbe alinhado apenas como fator secundário (nunca sobrepõe setup/risco!)
  const targetMatchesBlue = enemyList.some((e) => e.p.orbType === 'ranged');
  const targetMatchesRed = enemyList.some((e) => e.p.orbType === 'melee');
  let orbAlignmentBonus = 0;
  if (preferredForm === 'blue' && targetMatchesBlue) orbAlignmentBonus = 0.55;
  if (preferredForm === 'red' && targetMatchesRed) orbAlignmentBonus = 0.55;

  // Sem bônus automático para Bot por ter 2 alvos!
  // Se aliado não tem setup (allySetup < 1.1) e inimigo tem fuga/peel alta, bot é fortemente penalizada.
  const noSetupPenalty = allySetup < 1.1 ? 1.5 : 0;
  const highEvasionPenalty = enemyEscape * 1.15 + enemyPeel * 0.9;

  const firstWindowScore = round2(
    allySetup * 1.45 +
      allyCc * 0.55 +
      skirmishEdge * 0.85 +
      sideLaneWallBonus -
      highEvasionPenalty -
      noSetupPenalty -
      midShortLaneFirstPenalty -
      (countergankRisk === 'alto' ? 1.0 : countergankRisk === 'medio' ? 0.35 : 0),
  );

  const playAroundScore = round2(
    allySetup * 1.15 +
      enemyPriority * 0.65 +
      conversionScore * 0.7 +
      skirmishEdge * 0.75 +
      orbAlignmentBonus +
      sideLaneWallBonus -
      enemyEscape * 0.75 -
      enemyPeel * 0.65 -
      noSetupPenalty * 0.8 -
      midShortLanePlayPenalty,
  );

  const allyNames = allyList.map((a) => a.name).join(' + ');
  const enemyNames = enemyList.map((e) => e.name).join(' + ');

  const allySetupSummary =
    allySetup >= 2.2
      ? `Setup forte com ${allyNames} (CC e abertura confiáveis).`
      : allySetup >= 1.2
        ? `Setup moderado com ${allyNames}; depende de acerto de skillshot ou avanço inimigo.`
        : `Setup fraco com ${allyNames}; pouca ferramenta para segurar alvo antes do seu W.`;

  const enemyDefenseSummary =
    enemyEscape + enemyPeel >= 3.2
      ? `${enemyNames} têm muita fuga/peel (${enemyEscape >= 2 ? 'dash/mobilidade' : 'desengaje'}); forçar sem CC aliado queima seu tempo.`
      : enemyEscape + enemyPeel >= 1.8
        ? `${enemyNames} têm resposta defensiva moderada (${enemyCc >= 2 ? 'CC para virar' : 'ferramenta de recuo'}).`
        : `${enemyNames} são vulneráveis a flanco pelo E se passarem da metade da rota.`;

  // Exatamente 2 frases curtas determinísticas por lane, sem chutar wave ou start inimigo
  let favorableConditionSentence: string;
  if (allySetup >= 2 && enemyEscape <= 1.2) {
    favorableConditionSentence = `Boa janela se ${enemyNames} avançarem além do meio da rota e ${allyNames} estiverem prontos para abrir o CC antes da sua saída da parede.`;
  } else if (allySetup < 1.2) {
    favorableConditionSentence = `Só vale passar se ${enemyNames} queimarem a fuga ou estiverem presos contra a torre aliada — ${allyNames} não garantem setup do zero.`;
  } else if (enemyEscape >= 2) {
    favorableConditionSentence = `Procure somente após ${enemyNames} gastarem a mobilidade principal e ${allyNames} conseguirem acertar o primeiro controle para não gastar seu E em vão.`;
  } else {
    favorableConditionSentence = `Janela viável quando o inimigo se expuser na troca e você tiver ângulo de parede para forçar feitiço ou abate sem perder tempo de campo.`;
  }

  let fallbackConditionSentence: string;
  if (countergankRisk === 'alto') {
    const jgName = enemyJunglerProfile
      ? (catalog.champions[enemyJunglerProfile.championId]?.name ?? 'o caçador inimigo')
      : 'o caçador inimigo';
    fallbackConditionSentence = `Se os aliados estiverem baixos ou sem informação de ${jgName}, evite forçar o 2v2/3v3 e siga sua rota de farm até ter vantagem de nível ou visão.`;
  } else if (lane === 'bot' && enemyPeel >= 2) {
    fallbackConditionSentence = `Se ${enemyNames} mantiverem escudo/peel e o suporte aliado estiver baixo ou recuado, não insista na bot — volte aos campos ou procure outra rota.`;
  } else {
    fallbackConditionSentence = `Se a rota estiver recuada para o lado inimigo sem ângulo limpo de entrada, não fique esperando no mato e conclua sua sequência de farm/reset.`;
  }

  const factorBreakdown = [
    `Setup aliado (${allyNames}): ${round2(allySetup)}/3 | CC aliado: ${round2(allyCc)}/3`,
    `Fuga + Peel inimigo (${enemyNames}): fuga ${round2(enemyEscape)}/3, peel ${round2(enemyPeel)}/3`,
    `Força de escaramuça 2v2/3v3: saldo ${round2(skirmishEdge)} (risco de contragank ${countergankRisk})`,
    `Conversão pós-gank: ${conversionPotential} | Pontuação 1ª janela: ${firstWindowScore} | Jogar em torno: ${playAroundScore}`,
  ];

  return {
    lane,
    label,
    firstWindowScore,
    playAroundScore,
    countergankRisk,
    conversionPotential,
    allySetupSummary,
    enemyDefenseSummary,
    favorableConditionSentence,
    fallbackConditionSentence,
    factorBreakdown,
  };
}

export function analyzeDraft(
  draft: DraftState,
  catalog: CatalogSnapshot,
  options: DraftAnalyzerOptions,
): DraftAnalysis {
  const allies = getProfileList(draft.allies, catalog, 'Kayn');
  const enemies = getProfileList(draft.enemies, catalog);
  const enemyJunglerEntry = enemies.find((e) => e.role === 'jungle');
  const enemyJunglerProfile = enemyJunglerEntry?.profile ?? null;

  // Contagem de lacunas e flex picks
  const missingDraftGaps: string[] = [];
  const allRoles: LaneRole[] = ['top', 'jungle', 'mid', 'bot', 'support'];
  const missingEnemyRoles = allRoles.filter((r) => !draft.enemies[r]);
  const missingAllyRoles = allRoles.filter((r) => r !== 'jungle' && !draft.allies[r]);

  if (missingEnemyRoles.length > 0) {
    missingDraftGaps.push(
      `Faltam ${missingEnemyRoles.length} campeão(ões) inimigo(s): ${missingEnemyRoles.map((r) => ROLE_LABELS[r]).join(', ')}.`,
    );
  }
  if (missingAllyRoles.length > 0) {
    missingDraftGaps.push(
      `Faltam ${missingAllyRoles.length} aliado(s): ${missingAllyRoles.map((r) => ROLE_LABELS[r]).join(', ')}.`,
    );
  }

  const flexAmbiguityNotes: string[] = [];
  for (const e of enemies) {
    if (COMMON_FLEX_PICKS.has(e.profile.championId)) {
      flexAmbiguityNotes.push(
        `${e.name} (marcado em ${ROLE_LABELS[e.role]}) costuma ser flex pick — se mudar de rota, recalcule o setup da lane.`,
      );
    }
  }

  // Análise de orbes e composição inimiga
  let meleeCount = 0;
  let rangedCount = 0;
  let hybridCount = 0;
  let totalSquishy = 0;
  let effectiveSquishyScore = 0;
  let enemyFrontlineCount = 0;
  let enemyCcTotal = 0;
  let enemyPeelTotal = 0;
  let enemyShortBurstCount = 0;
  let enemyExtendedCount = 0;
  let enemyHeavyArmorCount = 0;

  for (const e of enemies) {
    const p = e.profile;
    if (p.orbType === 'melee') meleeCount += 1;
    else if (p.orbType === 'ranged') rangedCount += 1;
    else hybridCount += 1;

    if (p.isSquishyTarget) {
      totalSquishy += 1;
      // Todo alvo papel valoriza Kayn Azul; mobilidade/peel apenas ajustam moderadamente o acesso (sem anular o alvo papel)
      const vulnerability =
        Math.max(0.65, 1.35 - p.escapeScore * 0.16 - p.peelScore * 0.1) *
        (0.75 + p.priorityTargetWeight * 0.18);
      effectiveSquishyScore += vulnerability;
    }
    if (p.isFrontline) enemyFrontlineCount += 1;
    enemyCcTotal += p.ccScore;
    enemyPeelTotal += p.peelScore;
    if (p.fightStyle === 'short_burst') enemyShortBurstCount += 1;
    // Apenas campeões não-frágeis (tanques/lutadores/esgrimistas) que prolongam briga melee favorecem Rhaast — ADCs/encantadores papéis NÃO contam para Rhaast!
    if (!p.isSquishyTarget && p.fightStyle === 'extended_fight') enemyExtendedCount += 1;
    if (p.heavyArmorUser) enemyHeavyArmorCount += 1;
  }

  const allyFrontlineCount = allies.filter((a) => a.profile.isFrontline).length;
  const allyEngageTotal = allies.reduce((acc, a) => acc + a.profile.engageScore, 0);

  // Cálculo dos pesos explicáveis
  const weights: WeightFactorDetail[] = [];
  let blueScore = 0;
  let redScore = 0;

  // 1. Alvos prioritários alcançáveis e vulneráveis
  const targetBluePts = round2(effectiveSquishyScore * 1.45 - enemyPeelTotal * 0.28);
  // Peel inimigo só puxa para Rhaast quando existe frontline/lutador inimigo para segurar a luta; contra 5 papéis, peel não torna Rhaast bom!
  const peelRedBonus = enemyFrontlineCount >= 1 ? enemyPeelTotal * 0.28 : 0;
  const targetRedPts = round2(enemyFrontlineCount * 0.9 + peelRedBonus);
  blueScore += targetBluePts;
  redScore += targetRedPts;
  weights.push({
    label: 'Alvos prioritários e vulnerabilidade',
    blueImpact: targetBluePts,
    redImpact: targetRedPts,
    explanation: `${totalSquishy} alvo(s) frágil(eis), com peel inimigo total ${enemyPeelTotal}${enemyFrontlineCount === 0 ? ' (sem frontline inimiga para sustentar Rhaast)' : ''}.`,
  });

  // 2. Frontline, CC duro e armadura inimiga
  const frontlineRedPts = round2(
    enemyFrontlineCount * 1.9 + Math.max(0, enemyCcTotal - 5) * 0.28 + enemyHeavyArmorCount * 0.65,
  );
  const frontlineBluePts = round2(
    enemyFrontlineCount === 0 ? 3.2 : enemyFrontlineCount === 1 ? 1.6 : 0,
  );
  blueScore += frontlineBluePts;
  redScore += frontlineRedPts;
  weights.push({
    label: 'Frontline, CC e resistência adversária',
    blueImpact: frontlineBluePts,
    redImpact: frontlineRedPts,
    explanation:
      enemyFrontlineCount === 0
        ? `Nenhuma frontline/tanque inimigo (${enemyCcTotal} pts de CC) — Rhaast fica sem alvos de vida alta para curar e Kayn Azul domina.`
        : `${enemyFrontlineCount} frontline(s) e ${enemyCcTotal} pts de CC inimigo. Quanto mais frontline/CC, mais Rhaast ganha valor por % de vida máxima e cura.`,
  });

  // 3. Necessidade do time aliado (iniciação / quem aguenta luta longa)
  // Regra real de Kayn: faltar frontline aliada só puxa forte para Rhaast se o time inimigo tiver frontline/lutadores;
  // contra 4–5 papéis sem tanque inimigo, fazer Rhaast só por falta de tanque aliado é armadilha!
  const allyMissingFrontline = allies.length >= 2 && allyFrontlineCount === 0 && allyEngageTotal <= 2;
  const enemyHasNoFrontlineAndSquishy = enemyFrontlineCount === 0 && totalSquishy >= 4;
  const allyNeedsRedPts = enemyHasNoFrontlineAndSquishy
    ? 0
    : enemyFrontlineCount >= 2
      ? allyMissingFrontline
        ? 2.8
        : allyFrontlineCount === 0
          ? 1.3
          : 0
      : allyMissingFrontline
        ? 1.2
        : allyFrontlineCount === 0
          ? 0.5
          : 0;
  const allyCoversBluePts = allyFrontlineCount >= 1 || allyEngageTotal >= 4 ? 1.2 : 0;
  blueScore += allyCoversBluePts;
  redScore += allyNeedsRedPts;
  weights.push({
    label: 'Necessidade da comp aliada (iniciação/frontline)',
    blueImpact: allyCoversBluePts,
    redImpact: allyNeedsRedPts,
    explanation: enemyHasNoFrontlineAndSquishy
      ? 'Mesmo sem tanque aliado, o inimigo tem 0 frontlines e 4+ papéis — forçar Rhaast aqui perde valor contra alvos frágeis.'
      : allyMissingFrontline
        ? 'Seu time não tem frontline nem iniciação clara; contra frontlines inimigas, Rhaast ajuda a sustentar a briga.'
        : `Time aliado soma ${allyFrontlineCount} frontline(s) e ${allyEngageTotal} pts de iniciação.`,
  });

  // 4. Ritmo de luta inimigo (burst curto vs lutadores/tanques de combate prolongado)
  const tempoBluePts = round2(enemyShortBurstCount * 0.4);
  const tempoRedPts = round2(enemyExtendedCount * 0.75);
  blueScore += tempoBluePts;
  redScore += tempoRedPts;
  weights.push({
    label: 'Padrão de combate inimigo (burst vs luta longa)',
    blueImpact: tempoBluePts,
    redImpact: tempoRedPts,
    explanation: `${enemyShortBurstCount} campeão(ões) de troca curta vs ${enemyExtendedCount} lutador(es)/tanque(s) de combate prolongado.`,
  });

  // 5. Acesso real a orbes (peso secundário e simétrico — assassinos melee móveis não empurram para Rhaast)
  const enemyLaneProfiles = enemies.filter((e) => e.role !== 'jungle');
  const accessibleRangedLanes = enemyLaneProfiles.filter(
    (e) => e.profile.orbType === 'ranged' && e.profile.escapeScore <= 2,
  ).length;
  const accessibleMeleeLanes = enemyLaneProfiles.filter(
    (e) => (e.profile.orbType === 'melee' || e.profile.orbType === 'hybrid') && e.profile.escapeScore <= 2,
  ).length;

  const orbBluePts = round2(accessibleRangedLanes * 0.25);
  const orbRedPts = round2(accessibleMeleeLanes * 0.25);
  blueScore += orbBluePts;
  redScore += orbRedPts;
  weights.push({
    label: 'Facilidade realista de orbes (peso secundário)',
    blueImpact: orbBluePts,
    redImpact: orbRedPts,
    explanation: `Lanes inimigas acessíveis: ${accessibleRangedLanes} ranged / ${accessibleMeleeLanes} melee. Peso limitado para não forçar gank ruim só por orbe.`,
  });

  blueScore = round2(blueScore);
  redScore = round2(redScore);
  const netBlueMinusRed = round2(blueScore - redScore);

  // Separação entre forma MAIS FORTE no draft e forma MAIS FÁCIL de desbloquear
  const strongestDiff = (blueScore - orbBluePts) - (redScore - orbRedPts);
  const strongestForm: 'blue' | 'red' | 'even' =
    strongestDiff >= 1.8 ? 'blue' : strongestDiff <= -1.5 ? 'red' : 'even';

  const easiestUnlockForm: 'blue' | 'red' | 'even' =
    rangedCount >= meleeCount + 2
      ? 'blue'
      : meleeCount >= rangedCount + 2
        ? 'red'
        : accessibleRangedLanes > accessibleMeleeLanes + 1
          ? 'blue'
          : accessibleMeleeLanes > accessibleRangedLanes + 1
            ? 'red'
            : 'even';

  const orbDivergenceNote =
    strongestForm !== 'even' && easiestUnlockForm !== 'even' && strongestForm !== easiestUnlockForm
      ? getOrbMechanicsExplanation(easiestUnlockForm, strongestForm)
      : undefined;

  // Decisão final simétrica com proteção rígida contra falso Rhaast em comps sem tanque e contra falso Azul em comps de Rhaast
  let recommendedForm: KaynFormChoice;
  let alternativeForm: 'blue' | 'red';
  let tiebreakerApplied = false;
  let tiebreakerBlockedReason: string | undefined;

  const isClearlyBlue =
    (enemyFrontlineCount === 0 && totalSquishy >= 4 && enemies.length >= 4) ||
    (netBlueMinusRed >= 2.4 && enemyFrontlineCount <= 1 && enemies.length >= 4);

  const isClearlyRed =
    !isClearlyBlue &&
    ((enemyFrontlineCount >= 3 && totalSquishy <= 2) ||
      (netBlueMinusRed <= -2.4 && (enemyFrontlineCount >= 2 || totalSquishy <= 2)) ||
      (enemyFrontlineCount >= 2 && enemyPeelTotal >= 5 && allyMissingFrontline));

  if (enemies.length < 3 && !isClearlyRed) {
    recommendedForm = 'open';
    alternativeForm = netBlueMinusRed >= 0 ? 'blue' : 'red';
    if (options.preferBlueAsTiebreaker) {
      tiebreakerBlockedReason =
        'Draft muito incompleto (< 3 inimigos): o desempate pelo Azul não decide com segurança sem ver os carregadores/frontline restantes.';
    }
  } else if (isClearlyRed) {
    recommendedForm = 'red';
    alternativeForm = 'blue';
    if (options.preferBlueAsTiebreaker) {
      tiebreakerBlockedReason =
        'Preferência pelo Azul ignorada: a composição inimiga tem frontline/peel ou falta frontline aliada, tornando Rhaast claramente superior.';
    }
  } else if (isClearlyBlue) {
    recommendedForm = 'blue';
    alternativeForm = 'red';
  } else {
    // Zona equilibrada
    if (options.preferBlueAsTiebreaker) {
      recommendedForm = 'blue';
      alternativeForm = 'red';
      tiebreakerApplied = true;
    } else {
      recommendedForm = 'open';
      alternativeForm = netBlueMinusRed >= 0 ? 'red' : 'blue';
    }
  }

  const formLabelMap: Record<KaynFormChoice, string> = {
    blue: 'Kayn Azul (Assassino das Sombras)',
    red: 'Rhaast (Darkin)',
    open: 'Decisão em aberto (definir no lobby / primeiros minutos)',
  };

  const flipCondition =
    recommendedForm === 'blue'
      ? 'Inverte para Rhaast se os últimos picks trouxerem mais 1-2 tanques/peel pesado, se o carry inimigo comprar defesa cedo ou se você ficar sem frontline para entrar.'
      : recommendedForm === 'red'
        ? 'Inverte para Kayn Azul apenas se o time aliado já segurar a frontline e 3+ alvos frágeis inimigos ficarem sem peel nem proteção direta.'
        : 'Fecha Azul se os últimos picks forem frágeis sem peel pesado e seu time tiver engage; fecha Rhaast se aparecer frontline/CC duro ou se o seu time precisar de alguém na frente.';

  // Confiança legível (sem percentual falso de vitória)
  let confidenceLevel: ConfidenceLevel;
  let confidenceReason: string;
  if (enemies.length <= 2) {
    confidenceLevel = 'baixa';
    confidenceReason = `Apenas ${enemies.length} campeão(ões) inimigo(s) informado(s); faltam peças principais do draft para travar a forma.`;
  } else if (enemies.length <= 3 || recommendedForm === 'open') {
    confidenceLevel = enemies.length <= 3 ? 'baixa' : 'media';
    confidenceReason =
      enemies.length <= 3
        ? `Draft parcial (${enemies.length}/5 inimigos). Os últimos picks podem virar a forma ideal.`
        : 'Cenário equilibrado entre Assassino e Darkin; execução do early game e preferências contam no desempate.';
  } else if (
    Math.abs(netBlueMinusRed) >= 4.0 &&
    allies.length >= 3 &&
    (flexAmbiguityNotes.length < 2 || Math.abs(netBlueMinusRed) >= 5.5)
  ) {
    confidenceLevel = 'alta';
    confidenceReason = `${enemies.length}/5 inimigos definidos e vantagem estrutural clara (${Math.abs(netBlueMinusRed).toFixed(1)} pts) nos critérios de composição.`;
  } else if (flexAmbiguityNotes.length >= 2) {
    confidenceLevel = 'media';
    confidenceReason = `Composição com margem moderada e flex picks possíveis (${flexAmbiguityNotes.length}); trocas de rota podem mudar a prioridade das lanes.`;
  } else {
    confidenceLevel = 'media';
    confidenceReason = `Boa base de draft (${enemies.length}/5 inimigos), mas com margem moderada que exige leitura de itens e postura adversária.`;
  }

  // Motivos curtos para o topo da UI
  const shortReasons: string[] = [];
  if (recommendedForm === 'blue') {
    shortReasons.push(
      `${totalSquishy} alvo(s) frágil(eis) e baixa barreira de frontline (${enemyFrontlineCount}) permitem abates em janela curta.`,
    );
    if (allyFrontlineCount >= 1) {
      shortReasons.push('Seu time já tem linha de frente/iniciação para você jogar no flanco depois.');
    }
    if (tiebreakerApplied) {
      shortReasons.push('Desempate configurado para Kayn Azul aplicado porque o draft está equilibrado.');
    }
  } else if (recommendedForm === 'red') {
    shortReasons.push(
      `${enemyFrontlineCount} frontline(s) e ${enemyCcTotal} pts de CC inimigo valorizam cura e dano em % de vida do Rhaast.`,
    );
    if (allyMissingFrontline) {
      shortReasons.push('Sua equipe não tem frontline/engage firme; Rhaast impede o time de colapsar em lutas de objetivo.');
    }
    if (tiebreakerBlockedReason) {
      shortReasons.push('Preferência pelo Azul não foi aplicada para evitar esconder um cenário claramente de Rhaast.');
    }
  } else {
    shortReasons.push(
      `Draft ${enemies.length < 3 ? 'ainda muito incompleto' : 'equilibrado'} (${totalSquishy} frágeis vs ${enemyFrontlineCount} frontlines).`,
    );
    shortReasons.push('Mantenha runa flexível ou aguarde os últimos picks antes de se comprometer com 100% da rota de orbes.');
  }

  if (orbDivergenceNote) {
    shortReasons.push(
      `Atenção aos orbes: forma mais fácil (${easiestUnlockForm === 'blue' ? 'Azul' : 'Rhaast'}) diverge da mais forte (${strongestForm === 'blue' ? 'Azul' : 'Rhaast'}).`,
    );
  }

  // Comparação das lanes (Top, Mid, Bot)
  const topAnalysis = analyzeTargetLane('top', draft, catalog, enemyJunglerProfile, recommendedForm);
  const midAnalysis = analyzeTargetLane('mid', draft, catalog, enemyJunglerProfile, recommendedForm);
  const botAnalysis = analyzeTargetLane('bot', draft, catalog, enemyJunglerProfile, recommendedForm);

  const laneList = [topAnalysis, midAnalysis, botAnalysis];
  const byFirstWindow = [...laneList].sort((a, b) => b.firstWindowScore - a.firstWindowScore);
  const byPlayAround = [...laneList].sort((a, b) => b.playAroundScore - a.playAroundScore);

  const topFirst = byFirstWindow[0];
  const firstGankWindow: TargetLane | 'farm_first' =
    topFirst.firstWindowScore < 0.4 ? 'farm_first' : topFirst.lane;

  const firstGankWindowReason =
    firstGankWindow === 'farm_first'
      ? 'Nenhuma lane tem janela limpa garantida no nível 3-4 (baixa confiabilidade de setup ou muita fuga/risco de contragank). Priorize full clear + Aronguejo/reset.'
      : `${LANE_LABELS[firstGankWindow]} tem a melhor combinação de setup aliado e vulnerabilidade inimiga na primeira rotação (sem assumir onde a wave estará).`;

  const bestPlayAround = byPlayAround[0];
  const bestPlayAroundReason = `${bestPlayAround.label} oferece o melhor retorno de investimento contínuo (setup + conversão pós-jogada + menor perda de tempo) para construir vantagem.`;

  const fallbackFarmPath =
    bestPlayAround.lane === 'top'
      ? 'Comece na parte de baixo para fechar o full clear em direção ao Top (campos Bot -> Top), garanta nível 4 e só olhe gank se houver janela clara; caso contrário, Aronguejo/reset.'
      : bestPlayAround.lane === 'bot'
        ? 'Comece na parte de cima para concluir o full clear em direção ao Bot (campos Top -> Bot). Se Bot não tiver setup nem wave favorável ao chegar, não force — pegue Aronguejo/reset e volte ao ciclo de farm.'
        : 'Rota limpa Top -> Bot ou Bot -> Top avaliando o Mid na transição sem quebrar a cadência de respawn dos campos; resete no pico de ouro antes de disputar o primeiro objetivo.';

  const enemyProfiles = enemies.map((e) => e.profile);
  const runes = buildRuneRecommendation(recommendedForm, catalog, enemyProfiles);
  const build = buildItemRecommendation(recommendedForm, enemyProfiles, catalog);

  return {
    recommendedForm,
    recommendedFormLabel: formLabelMap[recommendedForm],
    alternativeForm,
    alternativeFormLabel: formLabelMap[alternativeForm],
    tiebreakerApplied,
    tiebreakerBlockedReason,
    flipCondition,
    strongestForm,
    easiestUnlockForm,
    orbDivergenceNote,
    orbSummary: {
      meleeCount,
      rangedCount,
      hybridCount,
      earlyAccessNote: getOrbMechanicsExplanation(easiestUnlockForm, strongestForm),
    },
    shortReasons,
    missingDraftGaps,
    flexAmbiguityNotes,
    confidence: {
      level: confidenceLevel,
      reason: confidenceReason,
    },
    scores: {
      blueScore,
      redScore,
      netBlueMinusRed,
    },
    detailedWeights: weights,
    runes,
    build,
    lanes: {
      firstGankWindow,
      firstGankWindowReason,
      bestPlayAroundLane: bestPlayAround.lane,
      bestPlayAroundReason,
      fallbackFarmPath,
      perLane: {
        top: topAnalysis,
        mid: midAnalysis,
        bot: botAnalysis,
      },
    },
    meta: {
      catalogPatch: catalog.patch,
      tacticalVersion: TACTICAL_DATA_META.tacticalVersion,
      buildVersion: BUILD_DATA_META.buildVersion,
      patchMismatch: catalog.patch !== BUILD_DATA_META.validatedPatch,
    },
  };
}

export function getShortFormReason(analysis: DraftAnalysis): string {
  if (analysis.recommendedForm === 'red') {
    const frontlineFactor = analysis.detailedWeights.find((w) =>
      w.label.toLowerCase().includes('frontline'),
    );
    if (analysis.shortReasons.some((r) => r.toLowerCase().includes('sem frontline'))) {
      return 'Lutas longas · time precisa de frontline';
    }
    if (frontlineFactor && frontlineFactor.redImpact >= 3) {
      return 'Lutas longas · muita frontline inimiga';
    }
    return 'Lutas longas e sustentação';
  }
  if (analysis.recommendedForm === 'blue') {
    if (analysis.tiebreakerApplied) {
      return 'Draft equilibrado · desempate Azul';
    }
    return 'Alvos frágeis · burst e ritmo';
  }
  if (analysis.missingDraftGaps.length > 0) {
    return 'Draft incompleto · aguarde mais picks';
  }
  return 'Equilibrado · defina no lobby';
}

export function createFrozenCardFromAnalysis(
  draft: DraftState,
  analysis: DraftAnalysis,
  pinnedMicroCards: FrozenMicroComboCard[] = [],
  selectedTacticalReminders: Array<{ ruleId?: string; text: string; watchCondition?: string }> = [],
): FrozenPreGameCard {
  const activeSituational = analysis.build.situational
    .filter((s) => s.activeInDraft)
    .map((s) => ({
      label: s.label,
      items: s.items.map((i) => i.name),
    }));

  const userNotes = draft.staticNotes
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const defaultReminders =
    selectedTacticalReminders.length > 0
      ? selectedTacticalReminders.map((r) => r.text)
      : [
          'Sem janela limpa na Bot? Volte pros campos.',
          'Orbe early vale pouco — nunca troque clear ou vida antes dos 8 min.',
          ...userNotes,
        ];

  const primaryFocusSide: FrozenPreGameCard['schematicPlan']['primaryFocusSide'] =
    analysis.lanes.bestPlayAroundLane;

  const suggestedStart =
    primaryFocusSide === 'top'
      ? 'Full clear Bot → Top (avaliar Top ~3:25)'
      : primaryFocusSide === 'bot'
        ? 'Full clear Top → Bot (só entrar Bot com setup)'
        : 'Full clear avaliando Mid na travessia';

  const keystone = analysis.runes.primaryRunes[0];

  return {
    id: `card-${Date.now()}`,
    frozenAt: new Date().toISOString(),
    draftName: draft.name || 'Plano pré-jogo',
    patch: analysis.meta.catalogPatch,
    patchMismatch: analysis.meta.patchMismatch,
    recommendedForm: analysis.recommendedForm,
    recommendedFormLabel: analysis.recommendedFormLabel,
    shortFormReason: getShortFormReason(analysis),
    alternativeFormLabel: analysis.alternativeFormLabel,
    flipCondition: analysis.flipCondition,
    confidenceLabel: `${analysis.confidence.level.toUpperCase()} — ${analysis.confidence.reason}`,
    keyReasons: [...analysis.shortReasons],
    runesSummary: {
      primaryTree: analysis.runes.primaryTreeName,
      primaryRunes: analysis.runes.primaryRunes.map((r) => r.name),
      secondaryTree: analysis.runes.secondaryTreeName,
      secondaryRunes: analysis.runes.secondaryRunes.map((r) => r.name),
      statShards: [...analysis.runes.statShards],
    },
    summonerSpells: analysis.runes.summonerSpells ? [...analysis.runes.summonerSpells] : undefined,
    runesVisual: {
      variantLabel: analysis.runes.variantLabel,
      keystone,
      primaryTreeIcon: analysis.runes.primaryTreeIcon,
      primaryMinors: analysis.runes.primaryRunes.slice(1),
      secondaryTreeIcon: analysis.runes.secondaryTreeIcon,
      secondaryRunes: analysis.runes.secondaryRunes,
      statShards: analysis.runes.statShardRefs,
      hasInvalidRunes: analysis.runes.hasInvalidRunes,
    },
    buildSummary: {
      junglePet: analysis.build.junglePet.name,
      boots: analysis.build.fullBuildBootReplacement
        ? `${analysis.build.boots.map((b) => b.name).join(' / ')} (Tier 1 — vender no full build)`
        : analysis.build.boots.map((b) => b.name).join(' / '),
      coreItems: analysis.build.core.map((c) => c.name),
      activeSituational,
    },
    buildVisual: {
      variantLabel: analysis.build.variantLabel,
      junglePet: analysis.build.junglePet,
      boots: analysis.build.boots,
      bootsNote: analysis.build.bootsNote,
      fullBuildBootReplacement: analysis.build.fullBuildBootReplacement,
      core: analysis.build.core,
      hasInvalidItems: analysis.build.hasInvalidItems,
    },
    lanesToWatch: {
      firstGankWindow:
        analysis.lanes.firstGankWindow === 'farm_first'
          ? 'Farm primeiro'
          : LANE_LABELS[analysis.lanes.firstGankWindow],
      bestPlayAroundLane: LANE_LABELS[analysis.lanes.bestPlayAroundLane],
      perLaneNotes: (['top', 'mid', 'bot'] as TargetLane[]).map((lane) => ({
        laneLabel: LANE_LABELS[lane],
        favorable: analysis.lanes.perLane[lane].favorableConditionSentence,
        fallback: analysis.lanes.perLane[lane].fallbackConditionSentence,
      })),
    },
    farmPlan: analysis.lanes.fallbackFarmPath,
    staticReminders: defaultReminders,
    selectedTacticalReminders:
      selectedTacticalReminders.length > 0
        ? selectedTacticalReminders.slice(0, 2)
        : defaultReminders.slice(0, 2).map((text) => ({ text })),
    schematicPlan: {
      primaryFocusSide,
      suggestedStart,
      note: 'Diagrama estático congelado antes da partida — não lê eventos ao vivo nem minimapa.',
    },
    pinnedMicroCards: pinnedMicroCards.slice(0, 3),
  };
}
