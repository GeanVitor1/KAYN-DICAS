import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  FileUp,
  HelpCircle,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { analyzeReviewMatch } from '../../engine/reviewAnalyzer';
import { filterStudyLessons, getAllStudyLessons } from '../../engine/studyLibrary';
import { matchRulesForReviewEvent } from '../../engine/tacticalMemory';
import type { RiotMatchListEntry } from '../../shared/ipc';
import type {
  EnemyResponseCertainty,
  LanePrioState,
  ReviewEvent,
  ReviewEventType,
  ReviewLaneFocus,
  ReviewMatch,
  ReviewOutcome,
  StudyLesson,
  TacticalRule,
} from '../../shared/types';
import { ExpandableSection } from '../components/ExpandableSection';

function createBlankEvent(minute = 5): ReviewEvent {
  return {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    minute,
    type: 'gank',
    lane: 'bot',
    allyPrio: 'enemy',
    estimatedEnemyJungler: 'unknown',
    kaynHpPercent: 75,
    resourcesReady: true,
    timeSpentSeconds: 18,
    outcome: 'nothing_lost_tempo',
    whatHappenedAfter: '',
    enemyResponseText: '',
    enemyResponseCertainty: 'hypothesis',
    executionNote: '',
    decisionContextSource: 'manual_observed',
  };
}

const TYPE_PT: Record<ReviewEventType, string> = {
  gank: 'Gank',
  death: 'Morte',
  reset: 'Reset',
  farm: 'Farm',
  objective: 'Objetivo',
};

const LANE_PT: Record<ReviewLaneFocus, string> = {
  top: 'Top',
  mid: 'Mid',
  bot: 'Bot',
  jungle: 'Selva',
  river: 'Rio',
};

function decisionBadgeClass(q: string): string {
  if (q === 'boa') return 'badge-green';
  if (q === 'questionavel') return 'badge-amber';
  if (q === 'ruim') return 'badge-red';
  return 'badge-muted';
}

function shortTakeawayForEvent(
  ev: ReviewEvent,
  analysis: ReturnType<typeof analyzeReviewMatch>['perEvent'][number],
): string {
  if (analysis.productiveWithoutKill) {
    return 'Sem abate, mas útil — forçou feitiços sem perder tempo de selva.';
  }
  if (analysis.decisionQuality === 'boa' && analysis.executionQuality === 'falha_execucao') {
    return 'Boa leitura de mapa; o ajuste aqui é só na execução mecânica.';
  }
  if (analysis.decisionQuality === 'ruim') {
    return analysis.plausibleAlternative;
  }
  if (analysis.decisionQuality === 'questionavel') {
    return analysis.decisionReason;
  }
  if (ev.type === 'farm' || ev.type === 'reset') {
    return analysis.decisionReason;
  }
  return analysis.decisionReason;
}

export function ReviewPage({
  reviews,
  activeReviewId,
  customLessons = [],
  tacticalRules = [],
  onSelectReview,
  onSaveReview,
  onDeleteReview,
  onExportJson,
  onImportJson,
  onFetchRiotMatches,
  onImportRiotMatch,
}: {
  reviews: ReviewMatch[];
  activeReviewId: string;
  customLessons?: StudyLesson[];
  tacticalRules?: TacticalRule[];
  onSelectReview: (id: string) => Promise<void>;
  onSaveReview: (review: ReviewMatch) => Promise<void>;
  onDeleteReview: (id: string) => Promise<void>;
  onExportJson: (review: ReviewMatch) => Promise<{ saved: boolean; filePath?: string; error?: string }>;
  onImportJson: () => Promise<{ imported: boolean; error?: string }>;
  onFetchRiotMatches: (params: {
    apiKey: string;
    gameName: string;
    tagLine: string;
    saveKeyEncrypted: boolean;
  }) => Promise<{ ok: boolean; puuid?: string; matches?: RiotMatchListEntry[]; error?: string }>;
  onImportRiotMatch: (params: {
    apiKey: string;
    matchId: string;
    puuid: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const activeReview =
    reviews.find((r) => r.id === activeReviewId) ?? reviews[0];

  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [draftEvent, setDraftEvent] = useState<ReviewEvent | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Match-V5 opcional
  const [riotKey, setRiotKey] = useState('');
  const [riotName, setRiotName] = useState('');
  const [riotTag, setRiotTag] = useState('BR1');
  const [saveKeyEnc, setSaveKeyEnc] = useState(false);
  const [riotLoading, setRiotLoading] = useState(false);
  const [riotPuuid, setRiotPuuid] = useState<string | null>(null);
  const [riotMatches, setRiotMatches] = useState<RiotMatchListEntry[]>([]);
  const [riotError, setRiotError] = useState<string | null>(null);

  const analysis = useMemo(
    () => (activeReview ? analyzeReviewMatch(activeReview) : null),
    [activeReview],
  );

  const linkableLessons = useMemo(
    () =>
      filterStudyLessons(getAllStudyLessons(customLessons), {
        creator: 'all',
        topic: 'all',
        form: 'all',
        includePending: false,
      }),
    [customLessons],
  );

  if (!activeReview || !analysis) {
    return (
      <div className="panel">
        <p>Nenhuma revisão carregada.</p>
      </div>
    );
  }

  const startNewReview = async () => {
    const created: ReviewMatch = {
      id: `review-manual-${Date.now()}`,
      title: 'Nova Revisão Manual (Solo/Duo BR)',
      isExampleDemo: false,
      sourceLabel: 'Preenchimento manual',
      patch: '16.23.1',
      rankContext: 'Diamante Solo/Duo BR',
      plannedForm: 'blue',
      actualFormMinute: null,
      actualFormChosen: null,
      events: [createBlankEvent(4)],
      playerSummaryNote: '',
    };
    await onSaveReview(created);
    setExpandedEventId(created.events[0].id);
    setEditingEventId(created.events[0].id);
    setDraftEvent(created.events[0]);
    setStatusMsg('Nova revisão manual criada.');
  };

  const addNewEvent = async () => {
    const lastMinute =
      activeReview.events.length > 0
        ? Math.max(...activeReview.events.map((e) => e.minute))
        : 2;
    const ev = createBlankEvent(Math.min(45, Math.round(lastMinute + 2)));
    const next: ReviewMatch = {
      ...activeReview,
      events: [...activeReview.events, ev],
    };
    await onSaveReview(next);
    setExpandedEventId(ev.id);
    setEditingEventId(ev.id);
    setDraftEvent(ev);
  };

  const saveEditedEvent = async () => {
    if (!draftEvent) return;
    const next: ReviewMatch = {
      ...activeReview,
      events: activeReview.events.map((e) => (e.id === draftEvent.id ? draftEvent : e)),
    };
    await onSaveReview(next);
    setEditingEventId(null);
    setDraftEvent(null);
    setStatusMsg('Evento atualizado na timeline.');
  };

  const removeEvent = async (eventId: string) => {
    const next: ReviewMatch = {
      ...activeReview,
      events: activeReview.events.filter((e) => e.id !== eventId),
    };
    await onSaveReview(next);
    if (editingEventId === eventId) {
      setEditingEventId(null);
      setDraftEvent(null);
    }
  };

  const handleExport = async () => {
    const res = await onExportJson(activeReview);
    if (res.saved) setStatusMsg(`Exportado em: ${res.filePath}`);
    else if (res.error) setStatusMsg(`Erro ao exportar: ${res.error}`);
  };

  const handleImport = async () => {
    const res = await onImportJson();
    if (res.imported) setStatusMsg('Revisão JSON importada.');
    else if (res.error) setStatusMsg(`Erro ao importar JSON: ${res.error}`);
  };

  const handleRiotSearch = async () => {
    setRiotError(null);
    setRiotLoading(true);
    try {
      const res = await onFetchRiotMatches({
        apiKey: riotKey,
        gameName: riotName,
        tagLine: riotTag,
        saveKeyEncrypted: saveKeyEnc,
      });
      if (!res.ok || !res.matches || !res.puuid) {
        setRiotError(res.error ?? 'Falha ao consultar partidas.');
      } else {
        setRiotPuuid(res.puuid);
        setRiotMatches(res.matches);
      }
    } finally {
      setRiotLoading(false);
    }
  };

  const handleImportRiot = async (matchId: string) => {
    if (!riotPuuid) return;
    setRiotLoading(true);
    setRiotError(null);
    try {
      const res = await onImportRiotMatch({
        apiKey: riotKey,
        matchId,
        puuid: riotPuuid,
      });
      if (!res.ok) setRiotError(res.error ?? 'Falha ao importar timeline.');
      else setStatusMsg(`Partida ${matchId} importada (complete hipóteses manualmente).`);
    } finally {
      setRiotLoading(false);
    }
  };

  const sortedEvents = [...activeReview.events].sort((a, b) => a.minute - b.minute);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {/* Barra superior compacta */}
      <div className="toolbar">
        <div className="toolbar-group" style={{ flex: 1, minWidth: 0 }}>
          <select
            className="select"
            aria-label="Selecionar revisão"
            style={{ width: 'auto', minWidth: 260, maxWidth: 440 }}
            value={activeReview.id}
            onChange={(e) => void onSelectReview(e.target.value)}
          >
            {reviews.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary btn-xs" onClick={() => void startNewReview()}>
            <Plus size={12} /> Nova revisão
          </button>
          {reviews.length > 1 ? (
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              title="Excluir revisão atual"
              onClick={() => void onDeleteReview(activeReview.id)}
            >
              <Trash2 size={13} />
            </button>
          ) : null}
        </div>

        <div className="toolbar-group">
          {activeReview.isExampleDemo ? (
            <span className="badge badge-amber">Exemplo fictício</span>
          ) : null}
          <button type="button" className="btn btn-xs" onClick={() => void handleImport()}>
            <FileUp size={12} /> Importar
          </button>
          <button type="button" className="btn btn-xs" onClick={() => void handleExport()}>
            <Download size={12} /> Exportar
          </button>
        </div>
      </div>

      {statusMsg ? <div className="banner banner-success">{statusMsg}</div> : null}

      {/* Resumo enxuto no topo */}
      <div className="grid-3">
        <section className="panel" data-testid="review-bot-summary">
          <h2 className="panel-title">Tentativas na Bot</h2>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
            {analysis.botAttemptsSummary.totalAttempts} tentativa(s)
          </div>
          <div className="small-text muted-text">
            {analysis.botAttemptsSummary.killsOrAssists} abate/assist ·{' '}
            <strong style={{ color: 'var(--blue)' }}>
              {analysis.botAttemptsSummary.productiveSpellOrRecall} útil sem kill
            </strong>{' '}
            ·{' '}
            <strong style={{ color: 'var(--red)' }}>
              {analysis.botAttemptsSummary.wastedTempoOrDeaths} custo alto
            </strong>
            {analysis.botAttemptsSummary.averageTimeSpentSeconds !== null
              ? ` · média ${analysis.botAttemptsSummary.averageTimeSpentSeconds}s`
              : ''}
          </div>
        </section>

        <section className="panel">
          <h2 className="panel-title">Padrões recorrentes</h2>
          {analysis.recurringPatterns.length === 0 ? (
            <div className="small-text muted-text">Nenhum padrão negativo repetido.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {analysis.recurringPatterns.map((pat) => (
                <div key={pat.id} className="small-text" style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>{pat.title}</span>
                  <span className="badge badge-muted mono" style={{ flexShrink: 0 }}>
                    Min {pat.exampleMinutes.join(', ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2 className="panel-title">Foco próximo jogo</h2>
          <div className="small-text" style={{ color: '#dbe6f7', fontWeight: 600 }}>
            {analysis.nextGamesFocus}
          </div>
        </section>
      </div>

      {/* TIMELINE LIMPA: Evento + Minuto + Aprendizado curto de primeira; contexto sob expansão */}
      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Timeline ({sortedEvents.length} lances)</h2>
          <button type="button" className="btn btn-xs btn-blue" onClick={() => void addNewEvent()}>
            <Plus size={12} /> Adicionar lance
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedEvents.map((ev) => {
            const evAnalysis = analysis.perEvent.find((a) => a.eventId === ev.id);
            const isExpanded = expandedEventId === ev.id;
            const isEditing = editingEventId === ev.id && draftEvent;
            const matchedRule = evAnalysis
              ? matchRulesForReviewEvent(ev, evAnalysis, tacticalRules)
              : null;
            const linkedLesson = ev.linkedLessonId
              ? linkableLessons.find((l) => l.id === ev.linkedLessonId)
              : undefined;

            return (
              <div key={ev.id} className="panel-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Linha principal enxuta */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 260 }}>
                    <span className="badge badge-muted mono">Min {ev.minute}</span>
                    <strong style={{ fontSize: 13.5, color: '#ffffff' }}>
                      {TYPE_PT[ev.type]} {LANE_PT[ev.lane]}
                    </strong>
                    {evAnalysis ? (
                      <span className={`badge ${decisionBadgeClass(evAnalysis.decisionQuality)}`}>
                        Decisão {evAnalysis.decisionQuality}
                      </span>
                    ) : null}
                    {evAnalysis?.executionQuality === 'falha_execucao' ? (
                      <span className="badge badge-red">Falha mecânica</span>
                    ) : null}
                    <span
                      className={`badge ${
                        ev.enemyResponseCertainty === 'confirmed' ? 'badge-green' : 'badge-amber'
                      }`}
                    >
                      {ev.enemyResponseCertainty === 'confirmed' ? (
                        <CheckCircle2 size={10} />
                      ) : (
                        <HelpCircle size={10} />
                      )}
                      {ev.enemyResponseCertainty === 'confirmed' ? 'Confirmado' : 'Hipótese'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                    >
                      {isExpanded ? 'Fechar' : 'Detalhes'}
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      title="Editar evento"
                      onClick={() => {
                        setExpandedEventId(ev.id);
                        setEditingEventId(ev.id);
                        setDraftEvent({ ...ev });
                      }}
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      aria-label={`Remover evento min ${ev.minute}`}
                      onClick={() => void removeEvent(ev.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Aprendizado curto visível de primeira */}
                {evAnalysis ? (
                  <div className="small-text" style={{ color: '#dbe6f7' }}>
                    {shortTakeawayForEvent(ev, evAnalysis)}
                  </div>
                ) : null}

                {/* Contexto completo sob expansão */}
                {isExpanded && evAnalysis ? (
                  <div
                    className="small-text"
                    style={{
                      borderTop: '1px solid var(--border)',
                      paddingTop: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                    }}
                  >
                    <div className="muted-text">{evAnalysis.tempoAndCostNote}</div>
                    <div>
                      <strong>Decisão na hora:</strong> {evAnalysis.decisionReason}
                    </div>
                    <div className="muted-text">
                      <strong>Execução:</strong> {evAnalysis.executionReason}
                    </div>
                    <div>
                      <strong>Resposta adversária:</strong> {evAnalysis.enemyPunishCertaintyLabel}
                    </div>
                    <div style={{ color: '#bae6fd' }}>
                      <strong>Alternativa:</strong> {evAnalysis.plausibleAlternative}{' '}
                      <span className="muted-text">({evAnalysis.alternativeTradeoff})</span>
                    </div>

                    {matchedRule ? (
                      <div className="panel" style={{ padding: 8, borderColor: 'var(--blue-border)' }}>
                        <strong style={{ color: 'var(--blue)' }}>
                          Memória tática ({matchedRule.creatorDisplayName}): {matchedRule.actionTitle}
                        </strong>
                        <div>{matchedRule.oneLineTip}</div>
                        {linkedLesson?.macro?.beforePlayContext ? (
                          <div className="muted-text">{linkedLesson.macro.beforePlayContext}</div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Formulário de edição */}
                {isEditing ? (
                  <div className="panel" style={{ marginTop: 4 }}>
                    <strong className="small-text">Editar lance (Min {draftEvent.minute})</strong>
                    <div className="grid-3">
                      <label className="field-label">
                        <span>Minuto</span>
                        <input
                          type="number"
                          className="input"
                          value={draftEvent.minute}
                          onChange={(e) =>
                            setDraftEvent({ ...draftEvent, minute: Number(e.target.value) || 1 })
                          }
                        />
                      </label>
                      <label className="field-label">
                        <span>Tipo</span>
                        <select
                          className="select"
                          value={draftEvent.type}
                          onChange={(e) =>
                            setDraftEvent({ ...draftEvent, type: e.target.value as ReviewEventType })
                          }
                        >
                          <option value="gank">Gank</option>
                          <option value="death">Morte</option>
                          <option value="objective">Objetivo</option>
                          <option value="reset">Reset</option>
                          <option value="farm">Farm</option>
                        </select>
                      </label>
                      <label className="field-label">
                        <span>Rota</span>
                        <select
                          className="select"
                          value={draftEvent.lane}
                          onChange={(e) =>
                            setDraftEvent({ ...draftEvent, lane: e.target.value as ReviewLaneFocus })
                          }
                        >
                          <option value="bot">Bot</option>
                          <option value="mid">Mid</option>
                          <option value="top">Top</option>
                          <option value="river">Rio</option>
                          <option value="jungle">Selva</option>
                        </select>
                      </label>
                      <label className="field-label">
                        <span>Pressão aliada</span>
                        <select
                          className="select"
                          value={draftEvent.allyPrio}
                          onChange={(e) =>
                            setDraftEvent({ ...draftEvent, allyPrio: e.target.value as LanePrioState })
                          }
                        >
                          <option value="ally">Aliada</option>
                          <option value="even">Neutra</option>
                          <option value="enemy">Inimiga</option>
                          <option value="unknown">Desconhecida</option>
                        </select>
                      </label>
                      <label className="field-label">
                        <span>JG inimigo estimado</span>
                        <select
                          className="select"
                          value={draftEvent.estimatedEnemyJungler}
                          onChange={(e) =>
                            setDraftEvent({
                              ...draftEvent,
                              estimatedEnemyJungler: e.target.value as ReviewEvent['estimatedEnemyJungler'],
                            })
                          }
                        >
                          <option value="unknown">Desconhecido</option>
                          <option value="top_side">Lado Top</option>
                          <option value="bot_side">Lado Bot</option>
                          <option value="mid">Mid</option>
                          <option value="dead_or_base">Base/Morto</option>
                        </select>
                      </label>
                      <label className="field-label">
                        <span>Desfecho</span>
                        <select
                          className="select"
                          value={draftEvent.outcome}
                          onChange={(e) =>
                            setDraftEvent({ ...draftEvent, outcome: e.target.value as ReviewOutcome })
                          }
                        >
                          <option value="kill">Abate</option>
                          <option value="assist">Assistência</option>
                          <option value="forced_spell_or_recall">Forçou Feitiço/Recall</option>
                          <option value="nothing_lost_tempo">Nada / Perdeu tempo</option>
                          <option value="died">Morreu</option>
                          <option value="completed_objective">Objetivo feito</option>
                          <option value="clean_reset">Reset limpo</option>
                          <option value="efficient_clear">Farm eficiente</option>
                        </select>
                      </label>
                      <label className="field-label">
                        <span>Tempo gasto (s)</span>
                        <input
                          type="number"
                          className="input"
                          value={draftEvent.timeSpentSeconds ?? ''}
                          placeholder="Desconhecido"
                          onChange={(e) =>
                            setDraftEvent({
                              ...draftEvent,
                              timeSpentSeconds: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="field-label">
                        <span>Resposta inimiga</span>
                        <select
                          className="select"
                          value={draftEvent.enemyResponseCertainty}
                          onChange={(e) =>
                            setDraftEvent({
                              ...draftEvent,
                              enemyResponseCertainty: e.target.value as EnemyResponseCertainty,
                            })
                          }
                        >
                          <option value="hypothesis">Hipótese</option>
                          <option value="confirmed">Confirmado</option>
                        </select>
                      </label>
                      <label className="field-label">
                        <span>Lição vinculada</span>
                        <select
                          className="select"
                          value={draftEvent.linkedLessonId ?? ''}
                          onChange={(e) =>
                            setDraftEvent({
                              ...draftEvent,
                              linkedLessonId: e.target.value ? e.target.value : null,
                            })
                          }
                        >
                          <option value="">Automática / Nenhuma</option>
                          {linkableLessons.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.creatorDisplayName}: {l.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="field-label">
                      <span>O que aconteceu depois</span>
                      <input
                        type="text"
                        className="input"
                        value={draftEvent.whatHappenedAfter}
                        onChange={(e) =>
                          setDraftEvent({ ...draftEvent, whatHappenedAfter: e.target.value })
                        }
                      />
                    </label>
                    <label className="field-label">
                      <span>Resposta adversária</span>
                      <input
                        type="text"
                        className="input"
                        value={draftEvent.enemyResponseText}
                        onChange={(e) =>
                          setDraftEvent({ ...draftEvent, enemyResponseText: e.target.value })
                        }
                      />
                    </label>
                    <label className="field-label">
                      <span>Nota de execução mecânica</span>
                      <input
                        type="text"
                        className="input"
                        value={draftEvent.executionNote}
                        onChange={(e) =>
                          setDraftEvent({ ...draftEvent, executionNote: e.target.value })
                        }
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-xs"
                        onClick={() => void saveEditedEvent()}
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs"
                        onClick={() => {
                          setEditingEventId(null);
                          setDraftEvent(null);
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Integração OPCIONAL Match-V5 */}
      <ExpandableSection
        title="Importar partida via Riot Match-V5 (opcional)"
        badge="Requer chave própria"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="small-text muted-text">
            Busca abates, mortes e objetivos épicos na Match-V5 (BR1). Ganks sem abate, wave e tempo parado seguem manuais.
          </div>
          <div className="grid-3">
            <label className="field-label">
              <span>Riot API Key</span>
              <input
                type="password"
                className="input"
                placeholder="RGAPI-..."
                value={riotKey}
                onChange={(e) => setRiotKey(e.target.value)}
              />
            </label>
            <label className="field-label">
              <span>Nome Riot ID</span>
              <input
                type="text"
                className="input"
                placeholder="MeuNick"
                value={riotName}
                onChange={(e) => setRiotName(e.target.value)}
              />
            </label>
            <label className="field-label">
              <span>TAG</span>
              <input
                type="text"
                className="input"
                placeholder="BR1"
                value={riotTag}
                onChange={(e) => setRiotTag(e.target.value)}
              />
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label className="switch-row">
              <input
                type="checkbox"
                checked={saveKeyEnc}
                onChange={(e) => setSaveKeyEnc(e.target.checked)}
              />
              <span>Salvar chave criptografada (safeStorage)</span>
            </label>
            <button
              type="button"
              className="btn btn-xs btn-primary"
              disabled={riotLoading}
              onClick={() => void handleRiotSearch()}
            >
              <Search size={12} /> {riotLoading ? 'Buscando...' : 'Buscar partidas'}
            </button>
          </div>
          {riotError ? <div className="banner banner-warning">{riotError}</div> : null}
          {riotMatches.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {riotMatches.map((m) => (
                <div key={m.matchId} className="panel-subtle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span className="small-text">
                    <strong>{m.championName}</strong> {m.kills}/{m.deaths}/{m.assists} ({m.win ? 'Vitória' : 'Derrota'}, {Math.round(m.gameDurationSeconds / 60)}m)
                  </span>
                  <button
                    type="button"
                    className="btn btn-xs btn-blue"
                    disabled={riotLoading}
                    onClick={() => void handleImportRiot(m.matchId)}
                  >
                    Importar
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </ExpandableSection>
    </div>
  );
}
