export type LaneRole = 'top' | 'jungle' | 'mid' | 'bot' | 'support';
export type TargetLane = 'top' | 'mid' | 'bot';
export type KaynFormChoice = 'blue' | 'red' | 'open';
export type ConfidenceLevel = 'alta' | 'media' | 'baixa';
export type OrbType = 'melee' | 'ranged' | 'hybrid';
export type MapSide = 'blue_side' | 'red_side';
export type TriStateBool = 'yes' | 'no' | 'unknown';
export type LanePrioState = 'ally' | 'even' | 'enemy' | 'unknown';

export interface CatalogChampion {
  id: string;
  key: string;
  name: string;
  title: string;
  tags: string[];
  attackrange: number;
  imageFull?: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  plaintext: string;
  gold: number;
  tags: string[];
  maps11: boolean;
  purchasable: boolean;
  imageFull?: string;
}

export interface CatalogRune {
  id: number;
  key: string;
  name: string;
  shortDesc: string;
  icon?: string;
  treeId?: number;
  slotIndex?: number;
}

export interface CatalogRuneSlot {
  runes: CatalogRune[];
}

export interface CatalogRuneTree {
  id: number;
  key: string;
  name: string;
  icon?: string;
  slots: CatalogRuneSlot[];
}

export interface CatalogStatShard {
  id: number;
  key: string;
  name: string;
  shortLabel: string;
  row: 'offense' | 'flex' | 'defense';
  icon?: string;
}

export interface CatalogSnapshot {
  patch: string;
  realm?: string;
  cdnBase?: string;
  locale: 'pt_BR';
  mapId: 11;
  fetchedAt: string;
  source: string;
  championCount: number;
  itemCount: number;
  runeTreeCount: number;
  champions: Record<string, CatalogChampion>;
  items: Record<string, CatalogItem>;
  runeTrees: CatalogRuneTree[];
  statShards?: CatalogStatShard[];
}

export interface CatalogValidationReport {
  validSnapshot: boolean;
  validRecommendations: boolean;
  catalogPatch: string;
  tacticalVersion: string;
  tacticalValidatedPatch: string;
  buildVersion: string;
  buildValidatedPatch: string;
  patchMismatch: boolean;
  missingItemIds: string[];
  missingRuneIds: number[];
  invalidSlotRuneIds?: number[];
  missingShardIds?: number[];
  warnings: string[];
}

export interface CatalogStatus {
  sourceMode: 'bundled_offline' | 'local_cache' | 'live_updated';
  activePatch: string;
  realm?: string;
  fetchedAt: string;
  cachedAssetsCount?: number;
  lastError?: string;
  validation: CatalogValidationReport;
}

export type DraftSide = Record<LaneRole, string | null>;

export interface DraftState {
  id: string;
  name: string;
  allies: DraftSide;
  enemies: DraftSide;
  staticNotes: string;
  updatedAt: string;
}

export interface ChampionTacticalProfile {
  championId: string;
  orbType: OrbType;
  archetype: 'squishy_carry' | 'control_mage' | 'enchanter' | 'assassin' | 'skirmisher' | 'juggernaut' | 'tank' | 'engage_support';
  isSquishyTarget: boolean;
  isFrontline: boolean;
  /** Preferência do campeão adversário: troca curta/burst vs combate prolongado */
  fightStyle: 'short_burst' | 'extended_fight' | 'balanced';
  engageScore: number; // 0..3
  peelScore: number; // 0..3
  ccScore: number; // 0..3
  escapeScore: number; // 0..3
  early2v2Score: number; // 0..3
  gankSetupScore: number; // 0..3 (como aliado)
  heavyHealing: boolean;
  heavyShields: boolean;
  heavyArmorUser: boolean;
  priorityTargetWeight: number; // 0..3
  isFallbackProfile: boolean;
  summaryPt: string;
}

export interface RuneEntryRef {
  id: number;
  name: string;
  icon: string | null;
  slotIndex: number;
  validInCatalog: boolean;
  revisionStatus: 'valid' | 'needs_review';
}

export interface StatShardRef {
  id: number;
  name: string;
  shortLabel: string;
  row: 'offense' | 'flex' | 'defense';
  icon: string | null;
  validInCatalog: boolean;
}

export interface RuneRecommendation {
  formLabel: string;
  primaryTreeId: number;
  primaryTreeName: string;
  primaryTreeIcon: string | null;
  primaryRunes: RuneEntryRef[];
  secondaryTreeId: number;
  secondaryTreeName: string;
  secondaryTreeIcon: string | null;
  secondaryRunes: RuneEntryRef[];
  statShards: string[];
  statShardRefs: StatShardRef[];
  statShardsNote: string;
  whyFormDiffers: string;
  alternativeNote: string;
  validatedPatch: string;
  hasInvalidRunes: boolean;
  revisionNotice?: string;
}

export interface BuildItemRef {
  id: string;
  name: string;
  gold: number;
  reason: string;
  availableInCatalog: boolean;
  icon: string | null;
  revisionStatus: 'valid' | 'needs_review';
}

export type SituationalCategoryKey =
  | 'alvo_fragil'
  | 'frontline_inimiga'
  | 'sobrevivencia'
  | 'armadura_adversaria'
  | 'excesso_cura'
  | 'excesso_escudos';

export interface SituationalBuildCategory {
  key: SituationalCategoryKey;
  label: string;
  shortCondition?: string;
  activeInDraft: boolean;
  triggerReason: string;
  items: BuildItemRef[];
}

export interface BuildRecommendation {
  form: KaynFormChoice;
  junglePet: BuildItemRef;
  boots: BuildItemRef[];
  core: BuildItemRef[];
  situational: SituationalBuildCategory[];
  validatedPatch: string;
  hasInvalidItems: boolean;
  patchWarning?: string;
}

export interface LaneAnalysis {
  lane: TargetLane;
  label: string;
  firstWindowScore: number;
  playAroundScore: number;
  countergankRisk: 'baixo' | 'medio' | 'alto';
  conversionPotential: 'alto' | 'medio' | 'baixo';
  allySetupSummary: string;
  enemyDefenseSummary: string;
  favorableConditionSentence: string;
  fallbackConditionSentence: string;
  factorBreakdown: string[];
}

export interface WeightFactorDetail {
  label: string;
  blueImpact: number;
  redImpact: number;
  explanation: string;
}

export interface DraftAnalysis {
  recommendedForm: KaynFormChoice;
  recommendedFormLabel: string;
  alternativeForm: 'blue' | 'red';
  alternativeFormLabel: string;
  tiebreakerApplied: boolean;
  tiebreakerBlockedReason?: string;
  flipCondition: string;
  strongestForm: 'blue' | 'red' | 'even';
  easiestUnlockForm: 'blue' | 'red' | 'even';
  orbDivergenceNote?: string;
  orbSummary: {
    meleeCount: number;
    rangedCount: number;
    hybridCount: number;
    earlyAccessNote: string;
  };
  shortReasons: string[];
  missingDraftGaps: string[];
  flexAmbiguityNotes: string[];
  confidence: {
    level: ConfidenceLevel;
    reason: string;
  };
  scores: {
    blueScore: number;
    redScore: number;
    netBlueMinusRed: number;
  };
  detailedWeights: WeightFactorDetail[];
  runes: RuneRecommendation;
  build: BuildRecommendation;
  lanes: {
    firstGankWindow: TargetLane | 'farm_first';
    firstGankWindowReason: string;
    bestPlayAroundLane: TargetLane;
    bestPlayAroundReason: string;
    fallbackFarmPath: string;
    perLane: Record<TargetLane, LaneAnalysis>;
  };
  meta: {
    catalogPatch: string;
    tacticalVersion: string;
    buildVersion: string;
    patchMismatch: boolean;
  };
}

export interface FrozenPreGameCard {
  id: string;
  frozenAt: string;
  draftName: string;
  patch: string;
  patchMismatch: boolean;
  recommendedForm: KaynFormChoice;
  recommendedFormLabel: string;
  shortFormReason?: string;
  alternativeFormLabel: string;
  flipCondition: string;
  confidenceLabel: string;
  keyReasons: string[];
  runesSummary: {
    primaryTree: string;
    primaryRunes: string[];
    secondaryTree: string;
    secondaryRunes: string[];
    statShards: string[];
  };
  runesVisual?: {
    keystone: RuneEntryRef;
    primaryTreeIcon: string | null;
    primaryMinors: RuneEntryRef[];
    secondaryTreeIcon: string | null;
    secondaryRunes: RuneEntryRef[];
    statShards: StatShardRef[];
    hasInvalidRunes: boolean;
  };
  buildSummary: {
    junglePet: string;
    boots: string;
    coreItems: string[];
    activeSituational: Array<{ label: string; items: string[] }>;
  };
  buildVisual?: {
    junglePet: BuildItemRef;
    boots: BuildItemRef[];
    core: BuildItemRef[];
    hasInvalidItems: boolean;
  };
  lanesToWatch: {
    firstGankWindow: string;
    bestPlayAroundLane: string;
    perLaneNotes: Array<{
      laneLabel: string;
      favorable: string;
      fallback: string;
    }>;
  };
  farmPlan: string;
  staticReminders: string[];
  selectedTacticalReminders?: Array<{
    ruleId?: string;
    text: string;
    watchCondition?: string;
  }>;
  schematicPlan: {
    primaryFocusSide: 'top' | 'mid' | 'bot' | 'balanced';
    suggestedStart: string;
    note: string;
  };
  pinnedMicroCards?: FrozenMicroComboCard[];
}

export type TacticalSignalIcon =
  | 'wave'
  | 'prio'
  | 'vision'
  | 'hp'
  | 'objective'
  | 'wall'
  | 'timer'
  | 'orbs'
  | 'gold'
  | 'dash';

export interface TacticalRuleSignal {
  icon: TacticalSignalIcon;
  label: string;
}

export type TacticalRuleDraftTag =
  | 'bot_risk'
  | 'bot_push'
  | 'blue'
  | 'red'
  | 'objective'
  | 'orbs'
  | 'wall_micro'
  | 'farm_first';

export interface TacticalRule {
  id: string;
  version: string;
  lessonId: string;
  creator: StudyCreator;
  creatorDisplayName: string;
  attributionLabel: StudyAttributionLabel;
  topic: StudyTopic;
  form: StudyKaynForm;
  actionTitle: string;
  oneLineTip: string;
  preGameWatchReminder: string;
  signals: TacticalRuleSignal[];
  changePlanCondition: string;
  uncertaintyNote?: string;
  sourceLabel: string;
  timestampDisplay: string;
  gameClockDisplay: string;
  videoUrl: string;
  contextStartSeconds: number | null;
  verificationStatus: StudyVerificationStatus;
  speechVerified: boolean;
  isHistoricalReference: boolean;
  patchValidity: string;
  draftTags: TacticalRuleDraftTag[];
  linkedTrainingScenarioId?: string;
}

export type StudyCreator = 'caiozera' | 'karasmai' | 'training_drill';
export type StudyTopic = 'macro' | 'micro';
export type StudyKaynForm = 'base' | 'blue' | 'red' | 'both';
export type StudyVerificationStatus =
  | 'verified_transcript_and_visual'
  | 'visual_only'
  | 'generic_drill'
  | 'pending_curation';

export type StudyAttributionLabel =
  | 'Observado no CaiozeraLoL'
  | 'Observado no Karasmai'
  | 'Exercício de treino'
  | 'Fonte pendente';

export interface ComboStep {
  key: string;
  label?: string;
  uncertain?: boolean;
  note?: string;
}

export interface MacroLessonDetail {
  beforePlayContext: string;
  visibleRiskOrOpportunity: string;
  actionAndAlternative: string;
  whatWouldChangeDecision: string;
  howToApply: string;
  worksWhen: string;
  chooseDifferentWhen: string;
  sessionDrillOrQuestion: string;
}

export interface MicroCardDetail {
  situation: string;
  steps: ComboStep[];
  sequenceUncertaintyNote?: string;
  prerequisite: string;
  heldAbility: string;
  heldAbilityReason: string;
  targetDodgesOrDashes: string;
  commonMistake: string;
  practiceModeDrill: string;
  patchCompatibility: 'verified_16_23_1' | 'not_verified' | 'historical_reference';
}

export interface KarasmaiPtExplanation {
  whatHeDid: string;
  whatHeExplained: string;
  howToTrain: string;
  englishTerms: Array<{ term: string; meaningPt: string }>;
}

export interface StudyLesson {
  id: string;
  title: string;
  creator: StudyCreator;
  creatorDisplayName: string;
  attributionLabel: StudyAttributionLabel;
  topic: StudyTopic;
  form: StudyKaynForm;
  verificationStatus: StudyVerificationStatus;
  speechVerified: boolean;
  isHistoricalReference: boolean;
  patch: string;
  videoUrl: string;
  videoTitle: string;
  channelName: string;
  channelUrl: string;
  contextStartSeconds: number | null;
  playMomentSeconds: number | null;
  timestampDisplay: string;
  gameClockDisplay: string;
  shortSummaryPt: string;
  evidenceNote: string;
  macro?: MacroLessonDetail;
  micro?: MicroCardDetail;
  karasmaiPt?: KarasmaiPtExplanation;
  linkedTrainingScenarioId?: string;
  isCustom?: boolean;
}

export interface FrozenMicroComboCard {
  lessonId: string;
  title: string;
  attributionLabel: StudyAttributionLabel;
  form: StudyKaynForm;
  steps: ComboStep[];
  conditionToUse: string;
  heldAbilityHint: string;
  patchCompatibility: MicroCardDetail['patchCompatibility'];
}

export interface CardWindowOptions {
  alwaysOnTop: boolean;
  opacity: number;
  clickThrough: boolean;
  toggleShortcut: string;
  showStaticMap: boolean;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export type TrainingOptionId =
  | 'start_objective'
  | 'gank_bot'
  | 'gank_other_lane'
  | 'farm_route'
  | 'reset_spend_gold';

export interface TrainingScenario {
  id: string;
  title: string;
  isExampleDemo: boolean;
  description: string;
  minute: number;
  level: number;
  kaynFormState: 'base' | 'blue' | 'red';
  hpPercent: number;
  unspentGold: number;
  keyComponentCost: number;
  itemSpikeLabel: string;
  mapSide: MapSide;
  /** CS total exibido no HUD quando a fonte não separa lane vs campos de selva. */
  totalCs?: number | null;
  /** CS apenas de minions de lane (quando a fonte separa os dois valores). */
  laneCs: number | null;
  /** Quantidade de campos de selva abatidos (1 campo = 4 CS; separado de CS de lane). */
  jungleCampsCleared: number | null;
  availableCampsCount: number;
  availableCampsLocation: 'top_side' | 'bot_side' | 'both' | 'none' | 'unknown';
  suggestedFarmRoute: string;
  timeAlreadyWaitingSeconds: number;
  objectiveType: 'dragon' | 'voidgrubs' | 'herald' | 'baron' | 'none';
  objectiveSpawnInSeconds: number; // 0 = já vivo
  topPrio: LanePrioState;
  midPrio: LanePrioState;
  botPrio: LanePrioState;
  botWaveState: 'pushed_to_enemy' | 'even' | 'pushed_to_ally' | 'frozen_enemy' | 'unknown';
  botAllySetupReady: TriStateBool;
  botSupportHpLow: TriStateBool;
  alliesCanMoveMid: TriStateBool;
  alliesCanMoveBot: TriStateBool;
  otherLaneTarget: 'top' | 'mid';
  otherLaneSetupReady: TriStateBool;
  otherLaneEnemyOverextended: TriStateBool;
  enemyJunglerPosition: 'bot_side' | 'top_side' | 'mid_area' | 'base_or_dead' | 'unknown';
  nearbyAlliesCount: number | null;
  nearbyEnemiesCount: number | null;
  gameState: 'ahead' | 'even' | 'behind';
  needOrbsUrgently: boolean;
}

export interface TrainingOptionEvaluation {
  optionId: TrainingOptionId;
  label: string;
  score: number;
  verdict: 'preferida' | 'alternativa' | 'arriscada' | 'evitar';
  reasons: string[];
  conditionsToWin: string[];
  abortConditions: string[];
}

export interface TrainingAnalysis {
  preferredOption: TrainingOptionEvaluation;
  secondOption: TrainingOptionEvaluation;
  rankedOptions: TrainingOptionEvaluation[];
  mostImpactfulUnknown: string;
  farmTempoNote: string;
  observedFacts: string[];
  workingHypotheses: string[];
  unknownFields: string[];
  conditionalDecisions: string[];
  trapWarning?: string;
}

export type ReviewEventType = 'gank' | 'death' | 'reset' | 'farm' | 'objective';
export type ReviewLaneFocus = 'top' | 'mid' | 'bot' | 'jungle' | 'river';
export type EnemyResponseCertainty = 'confirmed' | 'hypothesis';
export type ReviewOutcome =
  | 'kill'
  | 'assist'
  | 'forced_spell_or_recall'
  | 'nothing_lost_tempo'
  | 'died'
  | 'completed_objective'
  | 'clean_reset'
  | 'efficient_clear';

export interface ReviewEvent {
  id: string;
  minute: number;
  type: ReviewEventType;
  lane: ReviewLaneFocus;
  allyPrio: LanePrioState;
  estimatedEnemyJungler: 'bot_side' | 'top_side' | 'mid' | 'dead_or_base' | 'unknown';
  kaynHpPercent: number | null;
  resourcesReady: boolean | null; // ult/smite/itens prontos
  timeSpentSeconds: number | null;
  outcome: ReviewOutcome;
  whatHappenedAfter: string;
  enemyResponseText: string;
  enemyResponseCertainty: EnemyResponseCertainty;
  executionNote: string;
  decisionContextSource: 'manual_observed' | 'api_partial_hypothesis';
  linkedLessonId?: string | null;
}

export interface ReviewMatch {
  id: string;
  title: string;
  isExampleDemo: boolean;
  sourceLabel: string;
  patch: string;
  rankContext: string;
  matchId?: string;
  plannedForm: 'blue' | 'red';
  actualFormMinute: number | null;
  actualFormChosen: 'blue' | 'red' | null;
  events: ReviewEvent[];
  playerSummaryNote: string;
}

export interface ReviewEventAnalysis {
  eventId: string;
  minute: number;
  isBotAttempt: boolean;
  decisionQuality: 'boa' | 'questionavel' | 'ruim' | 'indeterminada';
  decisionReason: string;
  executionQuality: 'limpa' | 'falha_execucao' | 'nao_aplicavel' | 'indeterminada';
  executionReason: string;
  tempoAndCostNote: string;
  enemyPunishCertaintyLabel: string;
  plausibleAlternative: string;
  alternativeTradeoff: string;
  productiveWithoutKill: boolean;
}

export interface RecurringPattern {
  id: string;
  title: string;
  description: string;
  exampleMinutes: number[];
}

export interface ReviewAnalysis {
  matchId: string;
  botAttemptsSummary: {
    totalAttempts: number;
    killsOrAssists: number;
    productiveSpellOrRecall: number;
    wastedTempoOrDeaths: number;
    averageTimeSpentSeconds: number | null;
    attemptsDetail: Array<{
      minute: number;
      outcomeLabel: string;
      potentialCost: string;
      decisionQuality: ReviewEventAnalysis['decisionQuality'];
    }>;
  };
  perEvent: ReviewEventAnalysis[];
  recurringPatterns: RecurringPattern[];
  nextGamesFocus: string;
  missingContextWarnings: string[];
}

export interface AppSettings {
  preferBlueAsTiebreaker: boolean;
  liveLolSyncEnabled?: boolean;
  cardWindow: CardWindowOptions;
  riotApiKeyMode: 'none' | 'session_only' | 'saved_encrypted';
  riotRegionRouting: 'americas';
}

export type LiveLolPhase =
  | 'disconnected'
  | 'client_idle'
  | 'champ_select'
  | 'in_game';

export interface LiveItemSummary {
  itemId: string;
  name: string;
  count: number;
  slot: number;
}

export interface LiveEnemyThreatItem {
  championId: string;
  championName: string;
  itemId: string;
  itemName: string;
  threat: 'armor' | 'healing' | 'shields' | 'defensive';
}

export interface LiveMatchTelemetry {
  gameTimeSeconds: number;
  gameMode: string;
  mapNumber: number;
  playerChampionId: string | null;
  playerChampionName: string;
  playerTeam: 'ORDER' | 'CHAOS';
  level: number;
  currentGold: number;
  currentHealth: number;
  maxHealth: number;
  kills: number;
  deaths: number;
  assists: number;
  /** CS total oficial do HUD da Live Client Data API (a API não separa minions de lane vs campos da selva). */
  totalCreepScore: number;
  ownedItemIds: string[];
  ownedItems: LiveItemSummary[];
  enemyItemThreats: LiveEnemyThreatItem[];
  objectivesTaken: {
    allyDragons: number;
    enemyDragons: number;
    allyBarons: number;
    enemyBarons: number;
    allyHeralds: number;
    enemyHeralds: number;
    allyGrubs: number;
    enemyGrubs: number;
  };
}

export interface LiveLolStatus {
  phase: LiveLolPhase;
  enabled: boolean;
  lastUpdatedAt: string | null;
  sourceLabel: string;
  liveDraft: {
    allies: DraftSide;
    enemies: DraftSide;
    isMyTeamComplete: boolean;
    revealedEnemiesCount: number;
    localPlayerPosition: LaneRole | null;
    localPlayerChampionId: string | null;
  } | null;
  liveMatch: LiveMatchTelemetry | null;
  error?: string;
}

export interface PersistedAppState {
  schemaVersion: number;
  settings: AppSettings;
  currentDraft: DraftState;
  savedDrafts: DraftState[];
  frozenCard: FrozenPreGameCard | null;
  trainingScenarios: TrainingScenario[];
  reviews: ReviewMatch[];
  activeReviewId: string;
  customLessons: StudyLesson[];
  favoriteMicroIds: string[];
  pinnedReminderIds?: string[];
  tacticalRuleNotes?: Record<string, string>;
}
