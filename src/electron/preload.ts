import { contextBridge, ipcRenderer } from 'electron';
import type { KaynDesktopApi } from '../shared/ipc';
import type { CardWindowOptions, LiveLolStatus, PersistedAppState } from '../shared/types';

// Mantemos literais inline (sem require() relativo em runtime) para compatibilidade estrita com sandbox: true do Electron.
const CHANNELS = {
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
  REFRESH_DDRAGON: 'kayn:refresh-ddragon',
  EXPORT_REVIEW_JSON: 'kayn:export-review-json',
  IMPORT_REVIEW_JSON: 'kayn:import-review-json',
  FETCH_RIOT_MATCHES: 'kayn:fetch-riot-matches',
  IMPORT_RIOT_MATCH: 'kayn:import-riot-match',
  GET_LIVE_LOL_STATUS: 'kayn:get-live-lol-status',
  POLL_LIVE_LOL_NOW: 'kayn:poll-live-lol-now',
  ON_STATE_SYNC: 'kayn:on-state-sync',
  ON_CARD_OPTIONS_SYNC: 'kayn:on-card-options-sync',
  ON_LIVE_LOL_SYNC: 'kayn:on-live-lol-sync',
} as const;

const api: KaynDesktopApi = {
  getInitialState: () => ipcRenderer.invoke(CHANNELS.GET_INITIAL_STATE),
  updateCurrentDraft: (draft) => ipcRenderer.invoke(CHANNELS.UPDATE_CURRENT_DRAFT, draft),
  saveDraft: (draft) => ipcRenderer.invoke(CHANNELS.SAVE_DRAFT, draft),
  deleteDraft: (draftId) => ipcRenderer.invoke(CHANNELS.DELETE_DRAFT, draftId),
  freezePreGameCard: (card) => ipcRenderer.invoke(CHANNELS.FREEZE_PREGAME_CARD, card),
  openCardWindow: () => ipcRenderer.invoke(CHANNELS.OPEN_CARD_WINDOW),
  closeCardWindow: () => ipcRenderer.invoke(CHANNELS.CLOSE_CARD_WINDOW),
  updateCardOptions: (partial) => ipcRenderer.invoke(CHANNELS.UPDATE_CARD_OPTIONS, partial),
  updateSettings: (partial) => ipcRenderer.invoke(CHANNELS.UPDATE_SETTINGS, partial),
  saveTrainingScenario: (scenario) => ipcRenderer.invoke(CHANNELS.SAVE_TRAINING_SCENARIO, scenario),
  saveReview: (review) => ipcRenderer.invoke(CHANNELS.SAVE_REVIEW, review),
  deleteReview: (reviewId) => ipcRenderer.invoke(CHANNELS.DELETE_REVIEW, reviewId),
  setActiveReview: (reviewId) => ipcRenderer.invoke(CHANNELS.SET_ACTIVE_REVIEW, reviewId),
  saveCustomLesson: (lesson) => ipcRenderer.invoke(CHANNELS.SAVE_CUSTOM_LESSON, lesson),
  deleteCustomLesson: (lessonId) => ipcRenderer.invoke(CHANNELS.DELETE_CUSTOM_LESSON, lessonId),
  setFavoriteMicroIds: (ids) => ipcRenderer.invoke(CHANNELS.SET_FAVORITE_MICRO_IDS, ids),
  setPinnedReminderIds: (ids) => ipcRenderer.invoke(CHANNELS.SET_PINNED_REMINDER_IDS, ids),
  saveTacticalRuleNote: (ruleId, note) =>
    ipcRenderer.invoke(CHANNELS.SAVE_TACTICAL_RULE_NOTE, { ruleId, note }),
  openExternalUrl: (url) => ipcRenderer.invoke(CHANNELS.OPEN_EXTERNAL_URL, url),
  resetDemoData: () => ipcRenderer.invoke(CHANNELS.RESET_DEMO_DATA),
  refreshDdragon: () => ipcRenderer.invoke(CHANNELS.REFRESH_DDRAGON),
  exportReviewJson: (review) => ipcRenderer.invoke(CHANNELS.EXPORT_REVIEW_JSON, review),
  importReviewJson: () => ipcRenderer.invoke(CHANNELS.IMPORT_REVIEW_JSON),
  fetchRiotMatches: (params) => ipcRenderer.invoke(CHANNELS.FETCH_RIOT_MATCHES, params),
  importRiotMatch: (params) => ipcRenderer.invoke(CHANNELS.IMPORT_RIOT_MATCH, params),
  getLiveLolStatus: () => ipcRenderer.invoke(CHANNELS.GET_LIVE_LOL_STATUS),
  pollLiveLolNow: () => ipcRenderer.invoke(CHANNELS.POLL_LIVE_LOL_NOW),
  onStateSync: (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, state: PersistedAppState) => cb(state);
    ipcRenderer.on(CHANNELS.ON_STATE_SYNC, listener);
    return () => ipcRenderer.removeListener(CHANNELS.ON_STATE_SYNC, listener);
  },
  onCardOptionsSync: (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, options: CardWindowOptions) => cb(options);
    ipcRenderer.on(CHANNELS.ON_CARD_OPTIONS_SYNC, listener);
    return () => ipcRenderer.removeListener(CHANNELS.ON_CARD_OPTIONS_SYNC, listener);
  },
  onLiveLolSync: (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, status: LiveLolStatus) => cb(status);
    ipcRenderer.on(CHANNELS.ON_LIVE_LOL_SYNC, listener);
    return () => ipcRenderer.removeListener(CHANNELS.ON_LIVE_LOL_SYNC, listener);
  },
};

contextBridge.exposeInMainWorld('kaynApi', api);
