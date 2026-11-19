import {
  BarChart3,
  BookOpen,
  Settings,
  Shield,
  Swords,
  Target,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { formatGameClock } from '../engine/liveLolParser';
import {
  buildFrozenMicroCards,
  getAllStudyLessons,
} from '../engine/studyLibrary';
import { buildTacticalRulesFromLessons } from '../engine/tacticalMemory';
import type { InitialHydrationPayload } from '../shared/ipc';
import type {
  AppSettings,
  CardWindowOptions,
  DraftState,
  FrozenPreGameCard,
  LiveLolStatus,
  PersistedAppState,
  ReviewMatch,
  StudyLesson,
  TrainingScenario,
} from '../shared/types';
import { getDesktopApi, isRunningInElectron } from './desktopBridge';
import { CardWindowPage } from './pages/CardWindowPage';
import { DraftPage } from './pages/DraftPage';
import { LearnPage } from './pages/LearnPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { TrainingPage } from './pages/TrainingPage';

type TabKey = 'draft' | 'learn' | 'training' | 'review' | 'settings';

export function App() {
  const isCardRoute = window.location.hash.startsWith('#/card');
  const api = getDesktopApi();

  const [hydration, setHydration] = useState<InitialHydrationPayload | null>(null);
  const [liveLolStatus, setLiveLolStatus] = useState<LiveLolStatus | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('draft');
  const [selectedTrainingScenarioId, setSelectedTrainingScenarioId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .getInitialState()
      .then((payload) => {
        if (mounted) {
          setHydration(payload);
          if (payload.liveLolStatus) {
            setLiveLolStatus(payload.liveLolStatus);
          }
        }
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
    const unsubLive = api.onLiveLolSync((nextLive: LiveLolStatus) => {
      setLiveLolStatus(nextLive);
    });

    return () => {
      mounted = false;
      unsubState();
      unsubOpts();
      unsubLive();
    };
  }, [api]);

  const customLessons = hydration?.state.customLessons;
  const allLessons = useMemo(
    () => getAllStudyLessons(customLessons ?? []),
    [customLessons],
  );
  const tacticalRules = useMemo(
    () => buildTacticalRulesFromLessons(allLessons),
    [allLessons],
  );

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

  const pinnedMicroCards = buildFrozenMicroCards(
    state.favoriteMicroIds ?? [],
    allLessons,
  );

  const updateState = (nextState: PersistedAppState) => {
    setHydration((prev) => (prev ? { ...prev, state: nextState } : prev));
  };

  if (isCardRoute) {
    return (
      <CardWindowPage
        frozenCard={state.frozenCard}
        liveLolStatus={liveLolStatus}
        tacticalRules={tacticalRules}
        pinnedReminderIds={state.pinnedReminderIds ?? []}
        tacticalRuleNotes={state.tacticalRuleNotes ?? {}}
        pinnedMicroCards={pinnedMicroCards}
        preferBlueAsTiebreaker={state.settings.preferBlueAsTiebreaker}
        catalog={catalog}
        options={state.settings.cardWindow}
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

  const hasPatchAlert =
    catalogStatus.validation.patchMismatch ||
    !catalogStatus.validation.validRecommendations ||
    Boolean(catalogStatus.lastError);
  const isOfflineSource = catalogStatus.sourceMode === 'bundled_offline';

  const livePhase = liveLolStatus?.phase ?? 'disconnected';
  const liveLabel =
    livePhase === 'in_game'
      ? `Em Partida · ${formatGameClock(liveLolStatus?.liveMatch?.gameTimeSeconds ?? 0)}`
      : livePhase === 'champ_select'
        ? 'Seleção ao vivo'
        : livePhase === 'client_idle'
          ? 'LoL aberto'
          : 'Aguardando LoL';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Swords size={16} />
          </span>
          <span className="brand-title">KAYN-DICAS</span>
        </div>

        <nav className="nav-tabs" aria-label="Navegação principal">
          <button
            type="button"
            data-testid="nav-draft"
            className={`nav-tab ${activeTab === 'draft' ? 'active' : ''}`}
            onClick={() => setActiveTab('draft')}
          >
            <Shield size={15} /> Draft
          </button>
          <button
            type="button"
            data-testid="nav-learn"
            className={`nav-tab ${activeTab === 'learn' ? 'active' : ''}`}
            onClick={() => setActiveTab('learn')}
          >
            <BookOpen size={15} /> Aprender
          </button>
          <button
            type="button"
            data-testid="nav-training"
            className={`nav-tab ${activeTab === 'training' ? 'active' : ''}`}
            onClick={() => setActiveTab('training')}
          >
            <Target size={15} /> Treino
          </button>
          <button
            type="button"
            data-testid="nav-review"
            className={`nav-tab ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            <BarChart3 size={15} /> Revisão
          </button>
        </nav>

        <div className="topbar-right">
          <button
            type="button"
            data-testid="live-lol-pill"
            className={`patch-pill ${
              livePhase === 'in_game'
                ? 'live-pill-game'
                : livePhase === 'champ_select'
                  ? 'live-pill-select'
                  : ''
            }`}
            title={liveLolStatus?.sourceLabel ?? 'Clique para verificar conexão com o League of Legends'}
            onClick={() => {
              void api.pollLiveLolNow().then(setLiveLolStatus);
              setActiveTab('draft');
            }}
          >
            <span
              className={`live-dot ${
                livePhase === 'in_game'
                  ? 'live-dot-green'
                  : livePhase === 'champ_select'
                    ? 'live-dot-blue'
                    : livePhase === 'client_idle'
                      ? 'live-dot-idle'
                      : 'live-dot-off'
              }`}
            />
            <span>{liveLabel}</span>
          </button>

          <button
            type="button"
            data-testid="patch-indicator"
            className={`patch-pill ${hasPatchAlert ? 'patch-pill-warn' : ''}`}
            title={
              hasPatchAlert
                ? 'Catálogo ou recomendações precisam de revisão — clique para ver detalhes em Configurações'
                : `Catálogo BR pt_BR ${catalog.patch} (${isOfflineSource ? 'offline' : 'cache local'})`
            }
            onClick={() => setActiveTab('settings')}
          >
            <span className="patch-dot" />
            <span className="mono">{catalog.patch}</span>
            {hasPatchAlert ? (
              <span>· revisar</span>
            ) : isOfflineSource ? (
              <span>· offline</span>
            ) : null}
            {!isRunningInElectron() ? <span>· web</span> : null}
          </button>

          <button
            type="button"
            data-testid="nav-settings"
            aria-label="Configurações"
            title="Configurações"
            className={`nav-tab icon-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      <main className="page-content">
        {activeTab === 'draft' ? (
          <DraftPage
            draft={state.currentDraft}
            savedDrafts={state.savedDrafts}
            frozenCard={state.frozenCard}
            liveLolStatus={liveLolStatus}
            pinnedMicroCards={pinnedMicroCards}
            tacticalRules={tacticalRules}
            pinnedReminderIds={state.pinnedReminderIds ?? []}
            tacticalRuleNotes={state.tacticalRuleNotes ?? {}}
            catalog={catalog}
            preferBlueAsTiebreaker={state.settings.preferBlueAsTiebreaker}
            onRefreshLiveLol={async () => {
              const next = await api.pollLiveLolNow();
              setLiveLolStatus(next);
            }}
            onChangeDraft={(next: DraftState) => {
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
            onTogglePinnedReminder={async (ruleId: string) => {
              const current = state.pinnedReminderIds ?? [];
              const nextIds = current.includes(ruleId)
                ? current.filter((id) => id !== ruleId)
                : [...current, ruleId].slice(0, 3);
              const next = await api.setPinnedReminderIds(nextIds);
              updateState(next);
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

        {activeTab === 'learn' ? (
          <LearnPage
            customLessons={state.customLessons ?? []}
            favoriteMicroIds={state.favoriteMicroIds ?? []}
            pinnedReminderIds={state.pinnedReminderIds ?? []}
            tacticalRuleNotes={state.tacticalRuleNotes ?? {}}
            onToggleFavoriteMicro={async (ids: string[]) => {
              const next = await api.setFavoriteMicroIds(ids);
              updateState(next);
            }}
            onTogglePinnedReminder={async (ruleId: string) => {
              const current = state.pinnedReminderIds ?? [];
              const nextIds = current.includes(ruleId)
                ? current.filter((id) => id !== ruleId)
                : [...current, ruleId].slice(0, 3);
              const next = await api.setPinnedReminderIds(nextIds);
              updateState(next);
            }}
            onSaveRuleNote={async (ruleId: string, note: string) => {
              const next = await api.saveTacticalRuleNote(ruleId, note);
              updateState(next);
            }}
            onSaveCustomLesson={async (lesson: StudyLesson) => {
              const next = await api.saveCustomLesson(lesson);
              updateState(next);
            }}
            onDeleteCustomLesson={async (lessonId: string) => {
              const next = await api.deleteCustomLesson(lessonId);
              updateState(next);
            }}
            onOpenExternalUrl={async (url: string) => {
              await api.openExternalUrl(url);
            }}
            onPracticeInTraining={(scenarioId: string) => {
              setSelectedTrainingScenarioId(scenarioId);
              setActiveTab('training');
            }}
            onOpenDraftTab={() => setActiveTab('draft')}
          />
        ) : null}

        {activeTab === 'training' ? (
          <TrainingPage
            key={selectedTrainingScenarioId ?? 'training-default'}
            scenarios={state.trainingScenarios}
            tacticalRules={tacticalRules}
            selectedScenarioId={selectedTrainingScenarioId}
            onSaveScenario={async (scenario: TrainingScenario) => {
              const next = await api.saveTrainingScenario(scenario);
              updateState(next);
            }}
            onOpenExternalUrl={async (url: string) => {
              await api.openExternalUrl(url);
            }}
          />
        ) : null}

        {activeTab === 'review' ? (
          <ReviewPage
            reviews={state.reviews}
            activeReviewId={state.activeReviewId}
            customLessons={state.customLessons ?? []}
            tacticalRules={tacticalRules}
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
            liveLolStatus={liveLolStatus}
            shortcutRegistered={hydration.shortcutRegistered}
            exclusiveFullscreenNote={hydration.isExclusiveFullscreenCaveat}
            onPollLiveLolNow={async () => {
              const next = await api.pollLiveLolNow();
              setLiveLolStatus(next);
            }}
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
