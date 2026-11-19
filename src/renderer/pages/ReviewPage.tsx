import {
  CheckCircle2,
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
import type { RiotMatchListEntry } from '../../shared/ipc';
import type {
  EnemyResponseCertainty,
  LanePrioState,
  ReviewEvent,
  ReviewEventType,
  ReviewLaneFocus,
  ReviewMatch,
  ReviewOutcome,
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

function decisionBadgeClass(q: string): string {
  if (q === 'boa') return 'badge-green';
  if (q === 'questionavel') return 'badge-amber';
  if (q === 'ruim') return 'badge-red';
  return 'badge-muted';
}

export function ReviewPage({
  reviews,
  activeReviewId,
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

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [draftEvent, setDraftEvent] = useState<ReviewEvent | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Estado para Match-V5 opcional
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
      sourceLabel: 'Preenchimento manual pelo jogador',
      patch: '16.23.1',
      rankContext: 'Diamante Solo/Duo BR',
      plannedForm: 'blue',
      actualFormMinute: null,
      actualFormChosen: null,
      events: [createBlankEvent(4)],
      playerSummaryNote: '',
    };
    await onSaveReview(created);
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
    if (res.saved) setStatusMsg(`Exportado com sucesso em: ${res.filePath}`);
    else if (res.error) setStatusMsg(`Erro ao exportar: ${res.error}`);
  };

  const handleImport = async () => {
    const res = await onImportJson();
    if (res.imported) setStatusMsg('Revisão JSON importada e selecionada!');
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
      else setStatusMsg(`Partida ${matchId} importada como revisão parcial (complete hipóteses manualmente).`);
    } finally {
      setRiotLoading(false);
    }
  };

  const sortedEvents = [...activeReview.events].sort((a, b) => a.minute - b.minute);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Barra superior */}
      <div className="toolbar">
        <div className="toolbar-group">
          <select
            className="select"
            aria-label="Selecionar revisão"
            style={{ minWidth: 320 }}
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
            <Plus size={12} /> Nova revisão manual
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
          <button type="button" className="btn btn-xs" onClick={() => void handleImport()}>
            <FileUp size={12} /> Importar JSON
          </button>
          <button type="button" className="btn btn-xs" onClick={() => void handleExport()}>
            <Download size={12} /> Exportar JSON
          </button>
        </div>
      </div>

      {statusMsg ? <div className="banner banner-success">{statusMsg}</div> : null}

      <div className="banner">
        <span>
          <strong>{activeReview.title}</strong> —{' '}
          <span className="muted-text">{activeReview.sourceLabel}</span> ({activeReview.rankContext})
        </span>
        {activeReview.isExampleDemo ? (
          <span className="badge badge-amber">DADO FICTÍCIO DE DEMONSTRAÇÃO</span>
        ) : null}
      </div>

      {/* Resumo Bot + Padrões Recorrentes + Foco */}
      <div className="grid-3">
        <section className="panel" data-testid="review-bot-summary">
          <h2 className="panel-title">Tentativas na Bot Lane</h2>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {analysis.botAttemptsSummary.totalAttempts} tentativa(s) registrada(s)
          </div>
          <div className="small-text">
            • Abates/Assists: <strong>{analysis.botAttemptsSummary.killsOrAssists}</strong>
            <br />• Sem kill, porém produtivos (feitiço/recall):{' '}
            <strong>{analysis.botAttemptsSummary.productiveSpellOrRecall}</strong>
            <br />• Desperdício de tempo ou morte:{' '}
            <strong style={{ color: 'var(--red)' }}>
              {analysis.botAttemptsSummary.wastedTempoOrDeaths}
            </strong>
            <br />• Tempo médio investido:{' '}
            <strong>
              {analysis.botAttemptsSummary.averageTimeSpentSeconds !== null
                ? `${analysis.botAttemptsSummary.averageTimeSpentSeconds}s`
                : 'Não informado'}
            </strong>
          </div>
          {analysis.botAttemptsSummary.attemptsDetail.map((d, i) => (
            <div key={i} className="panel-subtle small-text">
              <strong>Min {d.minute}</strong> — {d.outcomeLabel} (Decisão: {d.decisionQuality})
              <div className="muted-text">Custo potencial: {d.potentialCost}</div>
            </div>
          ))}
        </section>

        <section className="panel">
          <h2 className="panel-title">Padrões Recorrentes (até 3)</h2>
          {analysis.recurringPatterns.length === 0 ? (
            <div className="small-text muted-text">
              Nenhum padrão recorrente negativo detectado com os eventos atuais.
            </div>
          ) : (
            analysis.recurringPatterns.map((pat) => (
              <div key={pat.id} className="panel-subtle small-text">
                <strong>{pat.title}</strong>{' '}
                <span className="badge badge-muted">
                  Min {pat.exampleMinutes.join(', ')}
                </span>
                <div className="muted-text" style={{ marginTop: 3 }}>
                  {pat.description}
                </div>
              </div>
            ))
          )}
        </section>

        <section className="panel">
          <h2 className="panel-title">Foco para as Próximas Partidas</h2>
          <div className="panel-subtle small-text" style={{ borderColor: 'var(--blue-border)' }}>
            {analysis.nextGamesFocus}
          </div>
          {activeReview.playerSummaryNote ? (
            <div className="small-text muted-text">
              <strong>Nota da partida:</strong> {activeReview.playerSummaryNote}
            </div>
          ) : null}
        </section>
      </div>

      {/* Timeline interativa */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Timeline da Partida ({sortedEvents.length} eventos)</h2>
          <button type="button" className="btn btn-xs btn-blue" onClick={() => void addNewEvent()}>
            <Plus size={12} /> Adicionar evento na timeline
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sortedEvents.map((ev) => {
            const evAnalysis = analysis.perEvent.find((a) => a.eventId === ev.id);
            const isEditing = editingEventId === ev.id && draftEvent;

            return (
              <div key={ev.id} className="panel-subtle">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge badge-muted mono">Min {ev.minute}</span>
                    <strong>
                      {ev.type.toUpperCase()} — {ev.lane.toUpperCase()}
                    </strong>
                    {evAnalysis ? (
                      <>
                        <span className={`badge ${decisionBadgeClass(evAnalysis.decisionQuality)}`}>
                          Decisão: {evAnalysis.decisionQuality}
                        </span>
                        <span
                          className={`badge ${
                            evAnalysis.executionQuality === 'falha_execucao'
                              ? 'badge-red'
                              : evAnalysis.executionQuality === 'limpa'
                                ? 'badge-green'
                                : 'badge-muted'
                          }`}
                        >
                          Execução: {evAnalysis.executionQuality}
                        </span>
                      </>
                    ) : null}
                    {evAnalysis?.productiveWithoutKill ? (
                      <span className="badge badge-blue">Útil sem kill</span>
                    ) : null}
                    <span
                      className={`badge ${
                        ev.enemyResponseCertainty === 'confirmed' ? 'badge-green' : 'badge-amber'
                      }`}
                    >
                      {ev.enemyResponseCertainty === 'confirmed' ? (
                        <CheckCircle2 size={11} />
                      ) : (
                        <HelpCircle size={11} />
                      )}
                      {ev.enemyResponseCertainty === 'confirmed' ? 'CONFIRMADO' : 'HIPÓTESE'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn-xs"
                      onClick={() => {
                        setEditingEventId(ev.id);
                        setDraftEvent({ ...ev });
                      }}
                    >
                      <Edit3 size={11} /> Editar / Corrigir
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

                {evAnalysis ? (
                  <div className="small-text" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div>{evAnalysis.tempoAndCostNote}</div>
                    <div>
                      <strong>Análise da decisão (info do momento):</strong> {evAnalysis.decisionReason}
                    </div>
                    <div className="muted-text">
                      <strong>Análise da execução:</strong> {evAnalysis.executionReason}
                    </div>
                    <div>
                      <strong>Resposta adversária:</strong> {evAnalysis.enemyPunishCertaintyLabel}
                    </div>
                    <div style={{ color: '#bae6fd' }}>
                      <strong>Alternativa plausível:</strong> {evAnalysis.plausibleAlternative}{' '}
                      <span className="muted-text">(Trade-off: {evAnalysis.alternativeTradeoff})</span>
                    </div>
                  </div>
                ) : null}

                {isEditing ? (
                  <div className="panel" style={{ marginTop: 10 }}>
                    <strong>Editar evento (Min {draftEvent.minute})</strong>
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
                          <option value="river">Rio / Objetivo</option>
                          <option value="jungle">Selva</option>
                        </select>
                      </label>
                      <label className="field-label">
                        <span>Pressão aliada na hora</span>
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
                        <span>Tempo gasto (segundos)</span>
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
                        <span>Certeza da resposta inimiga</span>
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
                          <option value="hypothesis">Hipótese (não verificado)</option>
                          <option value="confirmed">Confirmado no replay/fonte</option>
                        </select>
                      </label>
                      <label className="field-label">
                        <span>Origem do contexto</span>
                        <select
                          className="select"
                          value={draftEvent.decisionContextSource}
                          onChange={(e) =>
                            setDraftEvent({
                              ...draftEvent,
                              decisionContextSource: e.target.value as ReviewEvent['decisionContextSource'],
                            })
                          }
                        >
                          <option value="manual_observed">Observado / Corrigido manualmente</option>
                          <option value="api_partial_hypothesis">Importado parcial (hipótese)</option>
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
                      <span>Resposta adversária (objetivo / campos)</span>
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
                        Salvar evento
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
      </div>

      {/* Integração OPCIONAL Match-V5 */}
      <ExpandableSection
        title="Importação opcional via Riot Match-V5 (fora de partida ativa, requer chave própria)"
        badge="Opcional — app funciona 100% sem chave"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="small-text muted-text">
            Usa o roteamento oficial <strong>americas.api.riotgames.com</strong> (BR1) apenas para buscar abates, mortes e objetivos épicos da Match-V5. Ganks sem abate, tempo no mato e pressão de wave continuam sendo preenchidos manualmente.
          </div>
          <div className="grid-3">
            <label className="field-label">
              <span>Riot API Key (não vai para o Git)</span>
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
                placeholder="Ex.: MeuNick"
                value={riotName}
                onChange={(e) => setRiotName(e.target.value)}
              />
            </label>
            <label className="field-label">
              <span>TAG (sem #)</span>
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
              <span>Guardar chave criptografada localmente (safeStorage do Windows)</span>
            </label>
            <button
              type="button"
              className="btn btn-xs btn-primary"
              disabled={riotLoading}
              onClick={() => void handleRiotSearch()}
            >
              <Search size={12} /> {riotLoading ? 'Buscando...' : 'Buscar últimas Solo/Duo'}
            </button>
          </div>
          {riotError ? <div className="banner banner-warning">{riotError}</div> : null}
          {riotMatches.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {riotMatches.map((m) => (
                <div key={m.matchId} className="panel-subtle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span className="small-text">
                    <strong>{m.championName}</strong> — {m.kills}/{m.deaths}/{m.assists} ({m.win ? 'Vitória' : 'Derrota'}, {Math.round(m.gameDurationSeconds / 60)} min) • <span className="mono">{m.matchId}</span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-xs btn-blue"
                    disabled={riotLoading}
                    onClick={() => void handleImportRiot(m.matchId)}
                  >
                    Importar esqueleto
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
