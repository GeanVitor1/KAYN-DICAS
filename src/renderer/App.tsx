import {
  BookOpen,
  ClipboardCheck,
  Compass,
  Settings,
  Swords,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { InitialHydrationPayload } from '../shared/ipc';
import type {
  AppSettings,
  CardWindowOptions,
  DraftState,
  FrozenPreGameCard,
  PersistedAppState,
  ReviewMatch,
  TrainingScenario,
} from '../shared/types';
import { getDesktopApi, isRunningInElectron } from './desktopBridge';
import { CardWindowPage } from './pages/CardWindowPage';
import { DraftPage } from './pages/DraftPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { TrainingPage } from './pages/TrainingPage';

type TabKey = 'draft' | 'training' | 'review' | 'settings';

export function App() {
  const isCardRoute = window.location.hash.startsWith('#/card');
  const api = getDesktopApi();

  const [hydration, setHydration] = useState<InitialHydrationPayload | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('draft');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .getInitialState()
      .then((payload) => {
        if (mounted) setHydration(payload);
      })
      .catch((err) => {
        if (mounted) {
          setLoadError(
            err instanceof Error ? err.message : 'Falha ao carregar estado inicial.',
          );
        }
      });

    const unsubState = api.onStateSync((nextState: PersistedAppState) => {
      setHydration((prev) => (prev ? { ...prev, state: nextState } : prev));
    });
    const unsubOpts = api.onCardOptionsSync((nextOpts: CardWindowOptions) => {
      setHydration((prev) =>
        prev
          ? {
              ...prev,
              state: {
                ...prev.state,
                settings: { ...prev.state.settings, cardWindow: nextOpts },
              },
            }
          : prev,
      );
    });

    return () => {
      mounted = false;
      unsubState();
      unsubOpts();
    };
  }, [api]);

  if (loadError) {
    return (
      <div className="page-content">
        <div className="banner banner-danger">
          <span>Erro ao iniciar KAYN-DICAS: {loadError}</span>
        </div>
      </div>
    );
  }

  if (!hydration) {
    return (
      <div className="page-content">
        <div className="panel">Carregando catálogo e preferências locais...</div>
      </div>
    );
  }

  const { state, catalog, catalogStatus } = hydration;

  const updateState = (nextState: PersistedAppState) => {
    setHydration((prev) => (prev ? { ...prev, state: nextState } : prev));
  };

  if (isCardRoute) {
    return (
      <CardWindowPage
        frozenCard={state.frozenCard}
        options={state.settings.cardWindow}
        exclusiveFullscreenNote={hydration.isExclusiveFullscreenCaveat}
        onUpdateOptions={async (partial) => {
          const res = await api.updateCardOptions(partial);
          setHydration((prev) =>
            prev
              ? {
                  ...prev,
                  shortcutRegistered: res.shortcutRegistered,
                  state: {
                    ...prev.state,
                    settings: { ...prev.state.settings, cardWindow: res.options },
                  },
                }
              : prev,
          );
        }}
        onCloseCard={async () => {
          await api.closeCardWindow();
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Swords size={20} color="#38bdf8" />
          <div>
            <div className="brand-title">KAYN-DICAS</div>
            <div className="brand-sub">
              Kayn Jungle • BR Solo/Duo • Patch {catalog.patch}
              {!isRunningInElectron() ? ' • Modo navegador' : ''}
            </div>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="Navegação principal">
          <button
            type="button"
            data-testid="nav-draft"
            className={`nav-tab ${activeTab === 'draft' ? 'active' : ''}`}
            onClick={() => setActiveTab('draft')}
          >
            <Compass size={15} /> Draft
          </button>
          <button
            type="button"
            data-testid="nav-training"
            className={`nav-tab ${activeTab === 'training' ? 'active' : ''}`}
            onClick={() => setActiveTab('training')}
          >
            <BookOpen size={15} /> Treino
          </button>
          <button
            type="button"
            data-testid="nav-review"
            className={`nav-tab ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            <ClipboardCheck size={15} /> Revisão
          </button>
          <button
            type="button"
            data-testid="nav-settings"
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={15} /> Configurações
          </button>
        </nav>
      </header>

      <main className="page-content">
        {activeTab === 'draft' ? (
          <DraftPage
            draft={state.currentDraft}
            savedDrafts={state.savedDrafts}
            frozenCard={state.frozenCard}
            catalog={catalog}
            catalogStatus={catalogStatus}
            preferBlueAsTiebreaker={state.settings.preferBlueAsTiebreaker}
            onChangeDraft={(next: DraftState) => {
              // Atualização imediata na UI + persistência local
              updateState({ ...state, currentDraft: next });
              void api.updateCurrentDraft(next);
            }}
            onSaveDraft={(d: DraftState) => {
              void api.saveDraft(d).then(updateState);
            }}
            onDeleteDraft={(id: string) => {
              void api.deleteDraft(id).then(updateState);
            }}
            onTogglePreferBlue={(val: boolean) => {
              const nextSettings: AppSettings = {
                ...state.settings,
                preferBlueAsTiebreaker: val,
              };
              updateState({ ...state, settings: nextSettings });
              void api.updateSettings({ preferBlueAsTiebreaker: val });
            }}
            onFreezeCard={async (card: FrozenPreGameCard) => {
              const next = await api.freezePreGameCard(card);
              updateState(next);
            }}
            onOpenCardWindow={async () => {
              await api.openCardWindow();
            }}
          />
        ) : null}

        {activeTab === 'training' ? (
          <TrainingPage
            scenarios={state.trainingScenarios}
            onSaveScenario={async (scenario: TrainingScenario) => {
              const next = await api.saveTrainingScenario(scenario);
              updateState(next);
            }}
          />
        ) : null}

        {activeTab === 'review' ? (
          <ReviewPage
            reviews={state.reviews}
            activeReviewId={state.activeReviewId}
            onSelectReview={async (id: string) => {
              const next = await api.setActiveReview(id);
              updateState(next);
            }}
            onSaveReview={async (review: ReviewMatch) => {
              const next = await api.saveReview(review);
              updateState(next);
            }}
            onDeleteReview={async (id: string) => {
              const next = await api.deleteReview(id);
              updateState(next);
            }}
            onExportJson={(review: ReviewMatch) => api.exportReviewJson(review)}
            onImportJson={async () => {
              const res = await api.importReviewJson();
              if (res.imported) {
                const refreshed = await api.getInitialState();
                setHydration(refreshed);
              }
              return res;
            }}
            onFetchRiotMatches={(params) => api.fetchRiotMatches(params)}
            onImportRiotMatch={async (params) => {
              const res = await api.importRiotMatch(params);
              if (res.ok) {
                const refreshed = await api.getInitialState();
                setHydration(refreshed);
              }
              return res;
            }}
          />
        ) : null}

        {activeTab === 'settings' ? (
          <SettingsPage
            settings={state.settings}
            catalogStatus={catalogStatus}
            shortcutRegistered={hydration.shortcutRegistered}
            exclusiveFullscreenNote={hydration.isExclusiveFullscreenCaveat}
            onUpdateSettings={async (partial) => {
              const next = await api.updateSettings(partial);
              updateState(next);
            }}
            onUpdateCardOptions={async (partial) => {
              const res = await api.updateCardOptions(partial);
              setHydration((prev) =>
                prev
                  ? {
                      ...prev,
                      shortcutRegistered: res.shortcutRegistered,
                      state: {
                        ...prev.state,
                        settings: { ...prev.state.settings, cardWindow: res.options },
                      },
                    }
                  : prev,
              );
              return { warning: res.warning };
            }}
            onRefreshDdragon={async () => {
              const res = await api.refreshDdragon();
              setHydration((prev) =>
                prev
                  ? { ...prev, catalog: res.catalog, catalogStatus: res.status }
                  : prev,
              );
            }}
            onResetDemos={async () => {
              const next = await api.resetDemoData();
              updateState(next);
            }}
          />
        ) : null}
      </main>
    </div>
  );
}
