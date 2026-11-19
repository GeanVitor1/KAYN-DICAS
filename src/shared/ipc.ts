import type {
  AppSettings,
  CardWindowOptions,
  CatalogStatus,
  CatalogSnapshot,
  DraftState,
  FrozenPreGameCard,
  PersistedAppState,
  ReviewMatch,
  StudyLesson,
  TrainingScenario,
} from './types';

export const IPC_CHANNELS = {
  GET_INITIAL_STATE: 'kayn:get-initial-state',
  SAVE_DRAFT: 'kayn:save-draft',
  DELETE_DRAFT: 'kayn:delete-draft',
  UPDATE_CURRENT_DRAFT: 'kayn:update-current-draft',
  FREEZE_PREGAME_CARD: 'kayn:freeze-pregame-card',
  OPEN_CARD_WINDOW: 'kayn:open-card-window',
  CLOSE_CARD_WINDOW: 'kayn:close-card-window',
  UPDATE_CARD_OPTIONS: 'kayn:update-card-options',
  UPDATE_SETTINGS: 'kayn:update-settings',
  SAVE_TRAINING_SCENARIO: 'kayn:save-training-scenario',
  SAVE_REVIEW: 'kayn:save-review',
  DELETE_REVIEW: 'kayn:delete-review',
  SET_ACTIVE_REVIEW: 'kayn:set-active-review',
  SAVE_CUSTOM_LESSON: 'kayn:save-custom-lesson',
  DELETE_CUSTOM_LESSON: 'kayn:delete-custom-lesson',
  SET_FAVORITE_MICRO_IDS: 'kayn:set-favorite-micro-ids',
  SET_PINNED_REMINDER_IDS: 'kayn:set-pinned-reminder-ids',
  SAVE_TACTICAL_RULE_NOTE: 'kayn:save-tactical-rule-note',
  OPEN_EXTERNAL_URL: 'kayn:open-external-url',
  RESET_DEMO_DATA: 'kayn:reset-demo-data',
  GET_CATALOG: 'kayn:get-catalog',
  REFRESH_DDRAGON: 'kayn:refresh-ddragon',
  EXPORT_REVIEW_JSON: 'kayn:export-review-json',
  IMPORT_REVIEW_JSON: 'kayn:import-review-json',
  FETCH_RIOT_MATCHES: 'kayn:fetch-riot-matches',
  IMPORT_RIOT_MATCH: 'kayn:import-riot-match',
  ON_STATE_SYNC: 'kayn:on-state-sync',
  ON_CARD_OPTIONS_SYNC: 'kayn:on-card-options-sync',
} as const;

export interface InitialHydrationPayload {
  state: PersistedAppState;
  catalog: CatalogSnapshot;
  catalogStatus: CatalogStatus;
  shortcutRegistered: boolean;
  cardWindowOpen: boolean;
  isExclusiveFullscreenCaveat: string;
}

export interface RiotMatchListEntry {
  matchId: string;
  gameCreation: number;
  gameDurationSeconds: number;
  queueId: number;
  championName: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
}

export interface KaynDesktopApi {
  getInitialState: () => Promise<InitialHydrationPayload>;
  updateCurrentDraft: (draft: DraftState) => Promise<PersistedAppState>;
  saveDraft: (draft: DraftState) => Promise<PersistedAppState>;
  deleteDraft: (draftId: string) => Promise<PersistedAppState>;
  freezePreGameCard: (card: FrozenPreGameCard) => Promise<PersistedAppState>;
  openCardWindow: () => Promise<{ ok: boolean; error?: string }>;
  closeCardWindow: () => Promise<{ ok: boolean }>;
  updateCardOptions: (partial: Partial<CardWindowOptions>) => Promise<{
    options: CardWindowOptions;
    shortcutRegistered: boolean;
    warning?: string;
  }>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<PersistedAppState>;
  saveTrainingScenario: (scenario: TrainingScenario) => Promise<PersistedAppState>;
  saveReview: (review: ReviewMatch) => Promise<PersistedAppState>;
  deleteReview: (reviewId: string) => Promise<PersistedAppState>;
  setActiveReview: (reviewId: string) => Promise<PersistedAppState>;
  saveCustomLesson: (lesson: StudyLesson) => Promise<PersistedAppState>;
  deleteCustomLesson: (lessonId: string) => Promise<PersistedAppState>;
  setFavoriteMicroIds: (ids: string[]) => Promise<PersistedAppState>;
  setPinnedReminderIds: (ids: string[]) => Promise<PersistedAppState>;
  saveTacticalRuleNote: (ruleId: string, note: string) => Promise<PersistedAppState>;
  openExternalUrl: (url: string) => Promise<{ ok: boolean; error?: string }>;
  resetDemoData: () => Promise<PersistedAppState>;
  refreshDdragon: () => Promise<{
    catalog: CatalogSnapshot;
    status: CatalogStatus;
  }>;
  exportReviewJson: (review: ReviewMatch) => Promise<{
    saved: boolean;
    filePath?: string;
    canceled?: boolean;
    error?: string;
  }>;
  importReviewJson: () => Promise<{
    imported: boolean;
    review?: ReviewMatch;
    error?: string;
    canceled?: boolean;
  }>;
  fetchRiotMatches: (params: {
    apiKey: string;
    gameName: string;
    tagLine: string;
    saveKeyEncrypted: boolean;
  }) => Promise<{
    ok: boolean;
    puuid?: string;
    matches?: RiotMatchListEntry[];
    error?: string;
  }>;
  importRiotMatch: (params: {
    apiKey: string;
    matchId: string;
    puuid: string;
  }) => Promise<{
    ok: boolean;
    review?: ReviewMatch;
    error?: string;
  }>;
  onStateSync: (cb: (state: PersistedAppState) => void) => () => void;
  onCardOptionsSync: (cb: (options: CardWindowOptions) => void) => () => void;
}
