import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  FileUp,
  HelpCircle,
  History,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Skull,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { analyzeReviewMatch } from '../../engine/reviewAnalyzer';
import { filterStudyLessons, getAllStudyLessons } from '../../engine/studyLibrary';
import { matchRulesForReviewEvent } from '../../engine/tacticalMemory';
import type { LcuMatchListEntry, RiotMatchListEntry } from '../../shared/ipc';
import type {
  CatalogSnapshot,
  EnemyResponseCertainty,
  LanePrioState,
  LiveLolStatus,
  ReviewEvent,
  ReviewEventType,
  ReviewLaneFocus,
  ReviewMatch,
  ReviewOutcome,
  StudyLesson,
  TacticalRule,
} from '../../shared/types';
import { ExpandableSection } from '../components/ExpandableSection';
import { ChampionPortrait, ItemIconTile } from '../components/GameIcon';

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
  gank: 'Gank / Luta',
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
    if (ev.decisionContextSource === 'live_captured' || ev.decisionContextSource === 'lcu_captured') {
      return `${analysis.decisionReason} ${ev.enemyResponseCertainty === 'confirmed' ? ev.enemyResponseText : ''}`.trim();
    }
    return analysis.plausibleAlternative;
  }
  if (ev.decisionContextSource === 'live_captured' || ev.decisionContextSource === 'lcu_captured') {
    return ev.whatHappenedAfter || analysis.decisionReason;
  }
  if (analysis.decisionQuality === 'questionavel') {
    return analysis.decisionReason;
  }
  if (ev.type === 'farm' || ev.type === 'reset') {
    return analysis.decisionReason;
  }
  return analysis.decisionReason;
}

type TimelineFilter = 'all' | 'death' | 'gank' | 'objective';

export function ReviewPage({
  reviews,
  activeReviewId,
  catalog,
  liveLolStatus,
  autoRecordEnabled = true,
  customLessons = [],
  tacticalRules = [],
  onSelectReview,
  onSaveReview,
  onDeleteReview,
  onExportJson,
  onImportJson,
  onFetchLcuMatches,
  onImportLcuMatch,
  onImportLatestLcuMatch,
  onFetchRiotMatches,
  onImportRiotMatch,
}: {
  reviews: ReviewMatch[];
  activeReviewId: string;
  catalog: CatalogSnapshot;
  liveLolStatus?: LiveLolStatus | null;
  autoRecordEnabled?: boolean;
  customLessons?: StudyLesson[];
  tacticalRules?: TacticalRule[];
  onSelectReview: (id: string) => Promise<void>;
  onSaveReview: (review: ReviewMatch) => Promise<void>;
  onDeleteReview: (id: string) => Promise<void>;
  onExportJson: (review: ReviewMatch) => Promise<{ saved: boolean; filePath?: string; error?: string }>;
  onImportJson: () => Promise<{ imported: boolean; error?: string }>;
  onFetchLcuMatches: () => Promise<{
    ok: boolean;
    matches?: LcuMatchListEntry[];
    error?: string;
  }>;
  onImportLcuMatch: (gameId: string) => Promise<{ ok: boolean; review?: ReviewMatch; error?: string }>;
  onImportLatestLcuMatch: () => Promise<{ ok: boolean; review?: ReviewMatch; error?: string }>;
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
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('all');

  // Histórico direto do cliente LoL (LCU local — zero chave Riot)
  const [lcuLoading, setLcuLoading] = useState(false);
  const [lcuError, setLcuError] = useState<string | null>(null);
  const [lcuMatches, setLcuMatches] = useState<LcuMatchListEntry[]>([]);
  const [showLcuHistory, setShowLcuHistory] = useState(false);

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
      patch: catalog.patch,
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

  const handleImportLatestLcu = async () => {
    setLcuError(null);
    setStatusMsg(null);
    setLcuLoading(true);
    try {
      const res = await onImportLatestLcuMatch();
      if (!res.ok) {
        setLcuError(res.error ?? 'Não foi possível importar a última partida do cliente do LoL.');
      } else {
        setShowLcuHistory(false);
        setStatusMsg(
          `Última partida importada do LoL com timeline completa: ${res.review?.title ?? 'Pronta para análise'}.`,
        );
      }
    } finally {
      setLcuLoading(false);
    }
  };

  const handleFetchLcuHistory = async () => {
    setLcuError(null);
    setLcuLoading(true);
    try {
      const res = await onFetchLcuMatches();
      if (!res.ok || !res.matches) {
        setLcuError(res.error ?? 'Falha ao consultar histórico do cliente do LoL.');
      } else {
        setLcuMatches(res.matches);
        setShowLcuHistory(true);
      }
    } finally {
      setLcuLoading(false);
    }
  };

  const handleImportLcuGame = async (gameId: string) => {
    setLcuError(null);
    setLcuLoading(true);
    try {
      const res = await onImportLcuMatch(gameId);
      if (!res.ok) {
        setLcuError(res.error ?? 'Falha ao importar partida do LoL.');
      } else {
        setShowLcuHistory(false);
        setStatusMsg(`Partida importada e analisada: ${res.review?.title ?? `#${gameId}`}.`);
      }
    } finally {
      setLcuLoading(false);
    }
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
  const filteredEvents = sortedEvents.filter((ev) => {
    if (timelineFilter === 'all') return true;
    if (timelineFilter === 'death') return ev.type === 'death' || ev.outcome === 'died';
    if (timelineFilter === 'gank') return ev.type === 'gank' && ev.outcome !== 'died';
    if (timelineFilter === 'objective') return ev.type === 'objective';
    return true;
  });

  const stats = activeReview.matchStats;
  const diagnostic = analysis.diagnostic;
  const lolConnected = liveLolStatus && liveLolStatus.phase !== 'disconnected';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {/* Barra superior: seleção de revisão + importação direta do cliente LoL (zero chave API) */}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="toolbar-group" style={{ flex: 1, minWidth: 260 }}>
          <select
            className="select"
            aria-label="Selecionar revisão"
            style={{ width: 'auto', minWidth: 250, maxWidth: 420 }}
            value={activeReview.id}
            onChange={(e) => void onSelectReview(e.target.value)}
          >
            {reviews.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            data-testid="lcu-import-latest-btn"
            className="btn btn-blue btn-xs"
            disabled={lcuLoading}
            onClick={() => void handleImportLatestLcu()}
            title="Puxa automaticamente sua última partida jogada direto do cliente do LoL (sem chave Riot)"
          >
            <RefreshCw size={12} /> {lcuLoading ? 'Lendo LoL...' : 'Importar última do LoL'}
          </button>

          <button
            type="button"
            data-testid="lcu-fetch-history-btn"
            className="btn btn-xs"
            disabled={lcuLoading}
            onClick={() =>
              showLcuHistory && lcuMatches.length > 0
                ? setShowLcuHistory(false)
                : void handleFetchLcuHistory()
            }
          >
            <History size={12} /> {showLcuHistory ? 'Ocultar histórico' : 'Histórico do LoL'}
          </button>

          <button type="button" className="btn btn-xs" onClick={() => void startNewReview()}>
            <Plus size={12} /> Manual
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
          {autoRecordEnabled ? (
            <span
              className={`badge ${lolConnected ? 'badge-green' : 'badge-muted'}`}
              title="Ao terminar uma partida com o app aberto, a revisão é gravada automaticamente"
            >
              <Radio size={10} /> {lolConnected ? 'Auto-gravação ativa' : 'Auto-gravação pronta'}
            </span>
          ) : null}
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
      {lcuError ? <div className="banner banner-warning">{lcuError}</div> : null}

      {/* Aviso amigável quando ainda está vendo o exemplo fictício */}
      {activeReview.isExampleDemo ? (
        <div
          className="banner banner-info"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}
        >
          <span>
            Você está vendo o <strong>exemplo fictício</strong>. Com o cliente do LoL aberto, clique em{' '}
            <strong>Importar última do LoL</strong> para puxar sua partida real (sem chave API), ou deixe o app aberto ao jogar para gravar automaticamente ao fim da partida.
          </span>
          <button
            type="button"
            className="btn btn-blue btn-xs"
            disabled={lcuLoading}
            onClick={() => void handleImportLatestLcu()}
          >
            <RefreshCw size={12} /> Puxar minha última partida agora
          </button>
        </div>
      ) : null}

      {/* Painel expansível com histórico recente direto do cliente local do LoL */}
      {showLcuHistory && lcuMatches.length > 0 ? (
        <section className="panel" data-testid="lcu-history-panel">
          <div className="panel-header">
            <h2 className="panel-title">
              Últimas partidas no cliente do LoL ({lcuMatches.length}) — sem chave API
            </h2>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => void handleFetchLcuHistory()}
              disabled={lcuLoading}
            >
              <RefreshCw size={12} /> Atualizar lista
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
            {lcuMatches.map((m) => {
              const champ = catalog.champions[m.championId];
              const isKayn = m.championId === 'Kayn';
              return (
                <div
                  key={m.gameId}
                  className="lcu-match-row"
                  style={isKayn ? { borderColor: 'rgba(56, 189, 248, 0.35)' } : undefined}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <ChampionPortrait
                      patch={catalog.patch}
                      imageFull={champ?.imageFull}
                      name={m.championName}
                      size={34}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 13 }}>{m.championName}</strong>
                        <span className={`badge ${m.win ? 'badge-green' : 'badge-red'}`}>
                          {m.win ? 'Vitória' : 'Derrota'}
                        </span>
                        <span className="badge badge-muted">{m.queueLabel}</span>
                        {m.alreadyImported ? (
                          <span className="badge badge-blue">Já importada</span>
                        ) : null}
                      </div>
                      <div className="small-text muted-text mono">
                        {m.kills}/{m.deaths}/{m.assists} · {m.totalCs} CS ({m.csPerMin}/min) ·{' '}
                        {Math.round(m.gameDurationSeconds / 60)} min
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-xs btn-blue"
                    disabled={lcuLoading}
                    onClick={() => void handleImportLcuGame(m.gameId)}
                  >
                    {m.alreadyImported ? 'Reimportar e analisar' : 'Analisar partida'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* PAINEL DE DIAGNÓSTICO AUTOMÁTICO REAL (quando há matchStats da partida) */}
      {stats && diagnostic ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }} data-testid="review-diagnostic-panel">
          {/* Hero da Partida + KPIs */}
          <section
            className={`review-hero ${
              stats.result === 'win'
                ? 'review-hero-win'
                : stats.result === 'loss'
                  ? 'review-hero-loss'
                  : ''
            }`}
          >
            <div className="review-hero-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <ChampionPortrait
                  patch={catalog.patch}
                  imageFull={catalog.champions[stats.championId]?.imageFull}
                  name={stats.championName}
                  size={52}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      className={`badge ${
                        stats.result === 'win'
                          ? 'badge-green'
                          : stats.result === 'loss'
                            ? 'badge-red'
                            : 'badge-muted'
                      }`}
                    >
                      {stats.result === 'win'
                        ? 'VITÓRIA'
                        : stats.result === 'loss'
                          ? 'DERROTA'
                          : 'PARTIDA'}
                    </span>
                    <strong style={{ fontSize: 16, color: '#ffffff' }}>
                      {stats.championName} · {stats.kills}/{stats.deaths}/{stats.assists}
                    </strong>
                    <span className="small-text muted-text mono">
                      {Math.round(stats.durationSeconds / 60)} min · Nv {stats.level} ·{' '}
                      {stats.queueLabel ?? activeReview.rankContext}
                    </span>
                  </div>
                  <div className="small-text" style={{ color: '#e2ecfb', fontWeight: 600 }}>
                    {diagnostic.headline}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Itens usados na partida */}
                {stats.itemsBuilt.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {stats.itemsBuilt.slice(0, 6).map((it, idx) => (
                      <ItemIconTile
                        key={`${it.itemId}-${idx}`}
                        patch={catalog.patch}
                        iconFile={catalog.items[it.itemId]?.imageFull ?? `${it.itemId}.png`}
                        name={it.name}
                        size={32}
                      />
                    ))}
                  </div>
                ) : null}

                {/* Nota geral */}
                <div
                  className={`review-grade-pill review-grade-${diagnostic.grade}`}
                  title={`Pontuação factual de desempenho Kayn Jungle: ${diagnostic.overallScore}/100`}
                >
                  <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>
                    {diagnostic.grade}
                  </span>
                  <span className="mono" style={{ fontSize: 10, opacity: 0.85 }}>
                    {diagnostic.overallScore}/100
                  </span>
                </div>
              </div>
            </div>

            {/* Faixa de KPIs */}
            <div className="review-kpi-strip">
              {diagnostic.kpiCards.map((kpi) => (
                <div key={kpi.label} className={`review-kpi-card review-kpi-${kpi.status}`}>
                  <span className="small-text muted-text" style={{ fontSize: 11 }}>
                    {kpi.label}
                  </span>
                  <strong style={{ fontSize: 16, color: '#ffffff' }} className="mono">
                    {kpi.value}
                  </strong>
                  <span className="small-text muted-text" style={{ fontSize: 11 }}>
                    {kpi.target}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Diagnóstico detalhado: Principais Erros vs Raio-X das Mortes & Pontos Positivos */}
          <div className="grid-2">
            <section className="panel" data-testid="review-top-mistakes">
              <div className="panel-header">
                <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} color="var(--red)" /> Onde você errou / o que mais custou
                </h2>
                <span className="badge badge-muted">
                  {diagnostic.topMistakes.length} ponto(s)
                </span>
              </div>

              {diagnostic.topMistakes.length === 0 ? (
                <div className="small-text muted-text">
                  Nenhum erro estatístico grave detectado nos números da partida. Revise os lances da timeline abaixo (especialmente wave, posicionamento em lutas e chamadas de objetivo no mid/late).
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {diagnostic.topMistakes.map((finding) => (
                    <div
                      key={finding.id}
                      className={`review-finding-card review-finding-${finding.severity}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <strong style={{ fontSize: 13, color: '#ffffff' }}>{finding.title}</strong>
                        <span
                          className={`badge ${
                            finding.severity === 'critico' ? 'badge-red' : 'badge-amber'
                          }`}
                        >
                          {finding.severity === 'critico' ? 'Crítico' : 'Atenção'}
                        </span>
                      </div>
                      <div className="small-text mono" style={{ color: '#cbd5e1' }}>
                        {finding.evidence}
                      </div>
                      <div className="small-text muted-text">{finding.whyItCostGame}</div>
                      <div className="small-text" style={{ color: '#bae6fd' }}>
                        <strong>Próximo jogo:</strong> {finding.actionNextGame}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {/* Raio-X das Mortes */}
              <section className="panel">
                <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Skull size={14} color="var(--amber)" /> Raio-X das Mortes ({diagnostic.deathBreakdown.total})
                </h2>
                <div className="grid-3 small-text">
                  <div className="panel-subtle">
                    <div className="muted-text">Early (≤14m)</div>
                    <strong
                      className="mono"
                      style={{
                        fontSize: 16,
                        color: diagnostic.deathBreakdown.earlyDeaths >= 2 ? 'var(--red)' : '#ffffff',
                      }}
                    >
                      {diagnostic.deathBreakdown.earlyDeaths}
                    </strong>
                  </div>
                  <div className="panel-subtle">
                    <div className="muted-text">Mid / Late</div>
                    <strong className="mono" style={{ fontSize: 16, color: '#ffffff' }}>
                      {diagnostic.deathBreakdown.midLateDeaths}
                    </strong>
                  </div>
                  <div className="panel-subtle">
                    <div className="muted-text">Antes de obj.</div>
                    <strong
                      className="mono"
                      style={{
                        fontSize: 16,
                        color:
                          diagnostic.deathBreakdown.deathsBeforeObjective > 0
                            ? 'var(--red)'
                            : 'var(--green)',
                      }}
                    >
                      {diagnostic.deathBreakdown.deathsBeforeObjective}
                    </strong>
                  </div>
                </div>

                {/* Distribuição por região do mapa (quando capturado via LCU com X/Y) */}
                {stats.captureSource === 'lcu_history' ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {(Object.entries(diagnostic.deathBreakdown.deathsByLane) as Array<
                      [ReviewLaneFocus, number]
                    >).map(([lane, count]) => (
                      <span
                        key={lane}
                        className={`badge ${count >= 2 ? 'badge-red' : 'badge-muted'}`}
                      >
                        {LANE_PT[lane]}: {count}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="small-text muted-text" style={{ marginTop: 4 }}>
                    Dica: clique em <strong>Importar última do LoL</strong> para enriquecer com a região exata (Bot/Mid/Top/Selva) de cada morte e a comparação vs JG inimigo.
                  </div>
                )}

                {diagnostic.deathBreakdown.deathStreaks.length > 0 ? (
                  <div className="small-text" style={{ color: '#fca5a5', marginTop: 4 }}>
                    <strong>Sequência crítica:</strong>{' '}
                    {diagnostic.deathBreakdown.deathStreaks.join(' · ')}
                  </div>
                ) : null}

                {stats.planComparison ? (
                  <div
                    className="small-text muted-text"
                    style={{ borderTop: '1px solid var(--border)', paddingTop: 7, marginTop: 4 }}
                  >
                    <strong>Plano do Draft:</strong> {stats.planComparison.expectedFormLabel} · Inimigos: {stats.planComparison.enemyArmorCount} frontline/armadura, {stats.planComparison.enemyHealingCount} cura, {stats.planComparison.enemyShieldCount} escudo.
                  </div>
                ) : null}
              </section>

              {/* Pontos Positivos */}
              <section className="panel">
                <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} color="var(--green)" /> O que você fez bem (manter)
                </h2>
                {diagnostic.strengths.length === 0 ? (
                  <div className="small-text muted-text">
                    Partida difícil estatisticamente — foque primeiro em estabilizar o erro #1 ao lado no próximo jogo.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {diagnostic.strengths.map((s) => (
                      <div key={s.id} className="review-finding-card review-finding-positivo">
                        <strong style={{ fontSize: 12.5, color: '#a7f3d0' }}>{s.title}</strong>
                        <div className="small-text muted-text">{s.evidence}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {/* Resumo enxuto no topo (Bot / Padrões / Foco) */}
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
            <div className="small-text muted-text">Nenhum padrão negativo repetido na timeline.</div>
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

      {/* TIMELINE LIMPA: Evento + Minuto + Filtros + Aprendizado curto de primeira; contexto sob expansão */}
      <section className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 className="panel-title">Timeline ({filteredEvents.length} de {sortedEvents.length} lances)</h2>
            <div style={{ display: 'flex', gap: 4 }}>
              {(
                [
                  ['all', 'Todos'],
                  ['death', 'Só Mortes'],
                  ['gank', 'Abates / Assists'],
                  ['objective', 'Objetivos'],
                ] as Array<[TimelineFilter, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`btn btn-xs ${timelineFilter === key ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setTimelineFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="btn btn-xs btn-blue" onClick={() => void addNewEvent()}>
            <Plus size={12} /> Adicionar lance
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredEvents.length === 0 ? (
            <div className="small-text muted-text">Nenhum lance encontrado para este filtro.</div>
          ) : null}
          {filteredEvents.map((ev) => {
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
                          <option value="gank">Gank / Luta</option>
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
            Alternativa caso o cliente do LoL não esteja aberto. Busca abates, mortes e objetivos épicos na Match-V5 (BR1).
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
