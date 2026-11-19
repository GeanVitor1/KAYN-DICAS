import { contextBridge, ipcRenderer } from 'electron';
import type { KaynDesktopApi } from '../shared/ipc';
import type { CardWindowOptions, PersistedAppState } from '../shared/types';

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
  RESET_DEMO_DATA: 'kayn:reset-demo-data',
  REFRESH_DDRAGON: 'kayn:refresh-ddragon',
  EXPORT_REVIEW_JSON: 'kayn:export-review-json',
  IMPORT_REVIEW_JSON: 'kayn:import-review-json',
  FETCH_RIOT_MATCHES: 'kayn:fetch-riot-matches',
  IMPORT_RIOT_MATCH: 'kayn:import-riot-match',
  ON_STATE_SYNC: 'kayn:on-state-sync',
  ON_CARD_OPTIONS_SYNC: 'kayn:on-card-options-sync',
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
  resetDemoData: () => ipcRenderer.invoke(CHANNELS.RESET_DEMO_DATA),
  refreshDdragon: () => ipcRenderer.invoke(CHANNELS.REFRESH_DDRAGON),
  exportReviewJson: (review) => ipcRenderer.invoke(CHANNELS.EXPORT_REVIEW_JSON, review),
  importReviewJson: () => ipcRenderer.invoke(CHANNELS.IMPORT_REVIEW_JSON),
  fetchRiotMatches: (params) => ipcRenderer.invoke(CHANNELS.FETCH_RIOT_MATCHES, params),
  importRiotMatch: (params) => ipcRenderer.invoke(CHANNELS.IMPORT_RIOT_MATCH, params),
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
};

contextBridge.exposeInMainWorld('kaynApi', api);
