import bundledSnapshotJson from '../data/ddragon-snapshot.json';
import {
  DEMO_DRAFTS,
  DEMO_REVIEWS,
  DEMO_TRAINING_SCENARIOS,
} from '../engine/demos';
import { validateRecommendationsAgainstCatalog } from '../engine/catalogValidator';
import { parseAndValidateReviewJson, serializeReviewJson } from '../engine/reviewAnalyzer';
import type { InitialHydrationPayload, KaynDesktopApi } from '../shared/ipc';
import type {
  AppSettings,
  CardWindowOptions,
  CatalogSnapshot,
  DraftState,
  FrozenPreGameCard,
  PersistedAppState,
  ReviewMatch,
  TrainingScenario,
} from '../shared/types';

declare global {
  interface Window {
    kaynApi?: KaynDesktopApi;
  }
}

const LOCAL_STORAGE_KEY = 'kayn-dicas-browser-fallback-v1';
const bundledCatalog = bundledSnapshotJson as unknown as CatalogSnapshot;

function getBrowserFallbackState(): PersistedAppState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as PersistedAppState;
    }
  } catch {
    // Fallback para estado padrão
  }
  return {
    schemaVersion: 1,
    settings: {
      preferBlueAsTiebreaker: true,
      cardWindow: {
        alwaysOnTop: true,
        opacity: 0.92,
        clickThrough: false,
        toggleShortcut: 'CommandOrControl+Shift+K',
        showStaticMap: true,
      },
      riotApiKeyMode: 'none',
      riotRegionRouting: 'americas',
    },
    currentDraft: { ...DEMO_DRAFTS.balanced },
    savedDrafts: [{ ...DEMO_DRAFTS.blue }, { ...DEMO_DRAFTS.red }, { ...DEMO_DRAFTS.balanced }],
    frozenCard: null,
    trainingScenarios: [...DEMO_TRAINING_SCENARIOS],
    reviews: [...DEMO_REVIEWS],
    activeReviewId: DEMO_REVIEWS[0].id,
  };
}

function saveBrowserFallbackState(state: PersistedAppState): PersistedAppState {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignora limite de storage
  }
  return state;
}

const browserFallbackApi: KaynDesktopApi = {
  async getInitialState(): Promise<InitialHydrationPayload> {
    return {
      state: getBrowserFallbackState(),
      catalog: bundledCatalog,
      catalogStatus: {
        sourceMode: 'bundled_offline',
        activePatch: bundledCatalog.patch,
        fetchedAt: bundledCatalog.fetchedAt,
        validation: validateRecommendationsAgainstCatalog(bundledCatalog),
      },
      shortcutRegistered: false,
      cardWindowOpen: false,
      isExclusiveFullscreenCaveat:
        'Modo navegador: abra no Electron (npm start) para janela sempre no topo separada.',
    };
  },
  async updateCurrentDraft(draft: DraftState) {
    const next = { ...getBrowserFallbackState(), currentDraft: draft };
    return saveBrowserFallbackState(next);
  },
  async saveDraft(draft: DraftState) {
    const s = getBrowserFallbackState();
    const next = {
      ...s,
      currentDraft: draft,
      savedDrafts: [draft, ...s.savedDrafts.filter((d) => d.id !== draft.id)],
    };
    return saveBrowserFallbackState(next);
  },
  async deleteDraft(draftId: string) {
    const s = getBrowserFallbackState();
    return saveBrowserFallbackState({
      ...s,
      savedDrafts: s.savedDrafts.filter((d) => d.id !== draftId),
    });
  },
  async freezePreGameCard(card: FrozenPreGameCard) {
    const s = getBrowserFallbackState();
    return saveBrowserFallbackState({ ...s, frozenCard: card });
  },
  async openCardWindow() {
    window.open(`${window.location.pathname}#/card`, '_blank');
    return { ok: true };
  },
  async closeCardWindow() {
    return { ok: true };
  },
  async updateCardOptions(partial: Partial<CardWindowOptions>) {
    const s = getBrowserFallbackState();
    const options = { ...s.settings.cardWindow, ...partial };
    saveBrowserFallbackState({
      ...s,
      settings: { ...s.settings, cardWindow: options },
    });
    return { options, shortcutRegistered: false };
  },
  async updateSettings(partial: Partial<AppSettings>) {
    const s = getBrowserFallbackState();
    return saveBrowserFallbackState({
      ...s,
      settings: { ...s.settings, ...partial },
    });
  },
  async saveTrainingScenario(scenario: TrainingScenario) {
    const s = getBrowserFallbackState();
    return saveBrowserFallbackState({
      ...s,
      trainingScenarios: [...s.trainingScenarios.filter((x) => x.id !== scenario.id), scenario],
    });
  },
  async saveReview(review: ReviewMatch) {
    const s = getBrowserFallbackState();
    return saveBrowserFallbackState({
      ...s,
      reviews: [review, ...s.reviews.filter((r) => r.id !== review.id)],
      activeReviewId: review.id,
    });
  },
  async deleteReview(reviewId: string) {
    const s = getBrowserFallbackState();
    const reviews = s.reviews.filter((r) => r.id !== reviewId);
    return saveBrowserFallbackState({
      ...s,
      reviews,
      activeReviewId: reviews[0]?.id ?? '',
    });
  },
  async setActiveReview(reviewId: string) {
    const s = getBrowserFallbackState();
    return saveBrowserFallbackState({ ...s, activeReviewId: reviewId });
  },
  async resetDemoData() {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    return getBrowserFallbackState();
  },
  async refreshDdragon() {
    return {
      catalog: bundledCatalog,
      status: {
        sourceMode: 'bundled_offline',
        activePatch: bundledCatalog.patch,
        fetchedAt: bundledCatalog.fetchedAt,
        lastError: 'Atualização online via Data Dragon disponível no app Electron.',
        validation: validateRecommendationsAgainstCatalog(bundledCatalog),
      },
    };
  },
  async exportReviewJson(review: ReviewMatch) {
    const blob = new Blob([serializeReviewJson(review)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${review.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return { saved: true, filePath: `${review.id}.json` };
  },
  async importReviewJson() {
    const raw = window.prompt('Cole aqui o conteúdo JSON da revisão:');
    if (!raw) return { imported: false, canceled: true };
    const res = parseAndValidateReviewJson(raw);
    if (!res.ok || !res.review) return { imported: false, error: res.error };
    const s = getBrowserFallbackState();
    saveBrowserFallbackState({
      ...s,
      reviews: [res.review, ...s.reviews.filter((r) => r.id !== res.review!.id)],
      activeReviewId: res.review.id,
    });
    return { imported: true, review: res.review };
  },
  async fetchRiotMatches() {
    return {
      ok: false,
      error: 'Consulta Riot Match-V5 opcional requer execução no app desktop Electron.',
    };
  },
  async importRiotMatch() {
    return { ok: false, error: 'Disponível no app desktop Electron.' };
  },
  onStateSync() {
    return () => {};
  },
  onCardOptionsSync() {
    return () => {};
  },
};

export function getDesktopApi(): KaynDesktopApi {
  return window.kaynApi ?? browserFallbackApi;
}

export function isRunningInElectron(): boolean {
  return Boolean(window.kaynApi);
}
