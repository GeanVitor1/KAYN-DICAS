import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  Clock,
  Coins,
  Compass,
  ExternalLink,
  Eye,
  Flame,
  Heart,
  History,
  Play,
  Plus,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Waves,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  MAX_FAVORITE_MICRO_CARDS,
  buildTimestampedYouTubeUrl,
  createManualPendingLesson,
  filterStudyLessons,
  formatSecondsToTimestamp,
  getAllStudyLessons,
  toggleFavoriteMicroId,
} from '../../engine/studyLibrary';
import { buildTacticalRulesFromLessons } from '../../engine/tacticalMemory';
import type {
  StudyCreator,
  StudyKaynForm,
  StudyLesson,
  StudyTopic,
  TacticalSignalIcon,
} from '../../shared/types';
import { ComboSequenceBadge } from '../components/ComboSequenceBadge';
import { ExpandableSection } from '../components/ExpandableSection';

function SignalIcon({ kind }: { kind: TacticalSignalIcon }) {
  switch (kind) {
    case 'wave':
      return <Waves size={13} color="var(--blue)" />;
    case 'prio':
      return <AlertTriangle size={13} color="var(--amber)" />;
    case 'vision':
      return <Eye size={13} color="#94a3b8" />;
    case 'hp':
      return <Heart size={13} color="var(--red)" />;
    case 'objective':
      return <Flame size={13} color="var(--amber)" />;
    case 'wall':
      return <Shield size={13} color="var(--blue)" />;
    case 'timer':
      return <Clock size={13} color="var(--blue)" />;
    case 'orbs':
      return <Sparkles size={13} color="var(--blue)" />;
    case 'gold':
      return <Coins size={13} color="var(--amber)" />;
    case 'dash':
      return <Zap size={13} color="var(--red)" />;
    default:
      return <Compass size={13} />;
  }
}

function formLabelPt(form: StudyKaynForm): string {
  if (form === 'blue') return 'Kayn Azul';
  if (form === 'red') return 'Rhaast';
  if (form === 'base') return 'Kayn Base';
  return 'Azul & Rhaast';
}

export function LearnPage({
  customLessons,
  favoriteMicroIds,
  pinnedReminderIds,
  tacticalRuleNotes,
  onToggleFavoriteMicro,
  onTogglePinnedReminder,
  onSaveRuleNote,
  onSaveCustomLesson,
  onDeleteCustomLesson,
  onOpenExternalUrl,
  onPracticeInTraining,
  onOpenDraftTab,
}: {
  customLessons: StudyLesson[];
  favoriteMicroIds: string[];
  pinnedReminderIds: string[];
  tacticalRuleNotes: Record<string, string>;
  onToggleFavoriteMicro: (ids: string[]) => Promise<void>;
  onTogglePinnedReminder: (ruleId: string) => Promise<void>;
  onSaveRuleNote: (ruleId: string, note: string) => Promise<void>;
  onSaveCustomLesson: (lesson: StudyLesson) => Promise<void>;
  onDeleteCustomLesson: (lessonId: string) => Promise<void>;
  onOpenExternalUrl: (url: string) => Promise<void>;
  onPracticeInTraining: (scenarioId: string) => void;
  onOpenDraftTab: () => void;
}) {
  const [creatorFilter, setCreatorFilter] = useState<'all' | StudyCreator>('all');
  const [topicFilter, setTopicFilter] = useState<'all' | StudyTopic>('all');
  const [formFilter, setFormFilter] = useState<'all' | StudyKaynForm>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [favWarning, setFavWarning] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  // Cadastro manual offline de vídeo + timestamp
  const [manualTitle, setManualTitle] = useState('');
  const [manualCreator, setManualCreator] = useState<StudyCreator>('caiozera');
  const [manualTopic, setManualTopic] = useState<StudyTopic>('macro');
  const [manualForm, setManualForm] = useState<StudyKaynForm>('blue');
  const [manualUrl, setManualUrl] = useState('');
  const [manualTs, setManualTs] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualFeedback, setManualFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const allLessons = useMemo(() => getAllStudyLessons(customLessons), [customLessons]);

  const readyLessons = useMemo(
    () =>
      filterStudyLessons(allLessons, {
        creator: creatorFilter,
        topic: topicFilter,
        form: formFilter,
        includePending: false,
      }),
    [allLessons, creatorFilter, topicFilter, formFilter],
  );

  const pendingLessons = useMemo(
    () =>
      filterStudyLessons(allLessons, {
        creator: creatorFilter,
        topic: topicFilter,
        form: formFilter,
        includePending: true,
      }),
    [allLessons, creatorFilter, topicFilter, formFilter],
  );

  const rulesByLessonId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildTacticalRulesFromLessons>[number]>();
    for (const r of buildTacticalRulesFromLessons(allLessons)) {
      map.set(r.lessonId, r);
    }
    return map;
  }, [allLessons]);

  const handleToggleFavorite = async (lessonId: string) => {
    setFavWarning(null);
    const res = toggleFavoriteMicroId(favoriteMicroIds, lessonId, allLessons);
    if (res.warning) {
      setFavWarning(res.warning);
      return;
    }
    await onToggleFavoriteMicro(res.ids);
  };

  const handleCreateManual = async () => {
    setManualFeedback(null);
    const created = createManualPendingLesson({
      title: manualTitle,
      creator: manualCreator,
      topic: manualTopic,
      form: manualForm,
      videoUrl: manualUrl,
      timestampInput: manualTs,
      note: manualNote,
    });
    if (!created.ok || !created.lesson) {
      setManualFeedback({ ok: false, text: created.error ?? 'Dados inválidos.' });
      return;
    }
    await onSaveCustomLesson(created.lesson);
    setManualTitle('');
    setManualUrl('');
    setManualTs('');
    setManualNote('');
    setManualFeedback({
      ok: true,
      text: 'Fonte cadastrada na lista de pendentes (salva localmente).',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Filtros compactos */}
      <div className="toolbar" data-testid="learn-filters">
        <div className="toolbar-group">
          <select
            className="select"
            aria-label="Filtrar por criador"
            data-testid="filter-creator"
            style={{ width: 'auto' }}
            value={creatorFilter}
            onChange={(e) => setCreatorFilter(e.target.value as 'all' | StudyCreator)}
          >
            <option value="all">Criador: Todos (Caiozera primeiro)</option>
            <option value="caiozera">CaiozeraLoL</option>
            <option value="karasmai">Karasmai (PT-BR)</option>
            <option value="training_drill">Modo Treino</option>
          </select>

          <select
            className="select"
            aria-label="Filtrar por assunto"
            data-testid="filter-topic"
            style={{ width: 'auto' }}
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value as 'all' | StudyTopic)}
          >
            <option value="all">Assunto: Macro &amp; Micro</option>
            <option value="macro">Macro (mapa e tempo)</option>
            <option value="micro">Micro (combos)</option>
          </select>

          <select
            className="select"
            aria-label="Filtrar por forma"
            data-testid="filter-form"
            style={{ width: 'auto' }}
            value={formFilter}
            onChange={(e) => setFormFilter(e.target.value as 'all' | StudyKaynForm)}
          >
            <option value="all">Forma: Todas</option>
            <option value="base">Kayn Base</option>
            <option value="blue">Kayn Azul</option>
            <option value="red">Rhaast</option>
            <option value="both">Ambas</option>
          </select>
        </div>

        <div className="toolbar-group">
          <span className="badge badge-muted" data-testid="favorite-micro-counter">
            <Star size={11} color="var(--amber)" /> Combos no cartão: {favoriteMicroIds.length}/{MAX_FAVORITE_MICRO_CARDS}
          </span>
          <button type="button" className="btn btn-xs" onClick={onOpenDraftTab}>
            Ir para Draft
          </button>
        </div>
      </div>

      {favWarning ? <div className="banner banner-warning">{favWarning}</div> : null}

      {/* Grade de Cartões Táticos Curtos (sem mural de transcrições) */}
      <div className="learn-card-grid" data-testid="learn-ready-list">
        {readyLessons.length === 0 ? (
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <strong>Nenhuma regra tática encontrada com os filtros atuais.</strong>
            <span className="small-text muted-text">
              Ajuste os filtros acima ou consulte as fontes pendentes abaixo.
            </span>
          </div>
        ) : (
          readyLessons.map((lesson) => {
            const rule = rulesByLessonId.get(lesson.id);
            const ruleId = rule?.id ?? `rule-${lesson.id}`;
            const isExpanded = expandedId === lesson.id;
            const isFavMicro = favoriteMicroIds.includes(lesson.id);
            const isPinnedReminder = pinnedReminderIds.includes(ruleId);
            const userNote = tacticalRuleNotes[ruleId] ?? '';
            const tipText = userNote || rule?.oneLineTip || lesson.shortSummaryPt;
            const linkSeconds = lesson.contextStartSeconds ?? lesson.playMomentSeconds;
            const timestampUrl = buildTimestampedYouTubeUrl(lesson.videoUrl, linkSeconds);

            return (
              <article
                key={lesson.id}
                data-testid={`lesson-card-${lesson.id}`}
                className="tactical-card"
              >
                {/* Cabeçalho enxuto */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: '#ffffff' }}>
                      {rule?.actionTitle ?? lesson.title}
                    </h3>
                    <div className="small-text muted-text" style={{ marginTop: 2 }}>
                      {lesson.creatorDisplayName} · {formLabelPt(lesson.form)}
                      {lesson.isHistoricalReference ? ' · Referência S13' : ''}
                    </div>
                  </div>
                  <span className="badge badge-muted" style={{ textTransform: 'uppercase', fontSize: 10 }}>
                    {lesson.topic}
                  </span>
                </div>

                {/* Dica de 1 linha em destaque */}
                <div
                  className={`tactical-card-tip ${lesson.form === 'red' ? 'tactical-card-tip-red' : ''}`}
                >
                  {tipText}
                </div>

                {/* Até 3 sinais com ícone e rótulo */}
                {rule && rule.signals.length > 0 ? (
                  <div className="signal-row">
                    {rule.signals.slice(0, 3).map((sig, idx) => (
                      <span key={idx} className="signal-pill">
                        <SignalIcon kind={sig.icon} />
                        <span>{sig.label}</span>
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Sequência de teclas para Micro */}
                {lesson.micro ? (
                  <ComboSequenceBadge compact steps={lesson.micro.steps} form={lesson.form} />
                ) : null}

                {/* Ações do cartão: Praticar / Fixar / Ver exemplo */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginTop: 'auto',
                    paddingTop: 4,
                    borderTop: '1px solid rgba(35, 51, 78, 0.65)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {lesson.linkedTrainingScenarioId ? (
                      <button
                        type="button"
                        data-testid={`practice-btn-${lesson.id}`}
                        className="btn btn-xs btn-blue"
                        onClick={() => onPracticeInTraining(lesson.linkedTrainingScenarioId!)}
                      >
                        <Play size={12} /> Praticar
                      </button>
                    ) : null}

                    {lesson.topic === 'micro' && lesson.micro ? (
                      <button
                        type="button"
                        data-testid={`fav-btn-${lesson.id}`}
                        className={`btn btn-xs ${isFavMicro ? 'btn-amber' : ''}`}
                        onClick={() => void handleToggleFavorite(lesson.id)}
                      >
                        <Star size={12} fill={isFavMicro ? '#fbbf24' : 'none'} />
                        {isFavMicro ? 'No cartão' : 'Fixar combo'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`btn btn-xs ${isPinnedReminder ? 'btn-blue' : ''}`}
                        title="Fixar como lembrete pré-jogo e no cartão flutuante"
                        onClick={() => void onTogglePinnedReminder(ruleId)}
                      >
                        <Bookmark size={12} fill={isPinnedReminder ? '#38bdf8' : 'none'} />
                        {isPinnedReminder ? 'Lembrete fixado' : 'Fixar lembrete'}
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    data-testid={`example-btn-${lesson.id}`}
                    className="btn btn-xs btn-ghost"
                    style={{ color: 'var(--blue)' }}
                    onClick={() => setExpandedId(isExpanded ? null : lesson.id)}
                  >
                    {isExpanded ? 'Fechar exemplo' : 'Ver exemplo'}
                  </button>
                </div>

                {/* DETALHES SOB DEMANDA ("Ver exemplo") */}
                {isExpanded ? (
                  <div
                    className="panel-subtle small-text"
                    data-testid={`lesson-detail-${lesson.id}`}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <span className="muted-text">
                        <strong>Fonte:</strong> {lesson.channelName} · {lesson.timestampDisplay}
                      </span>
                      <button
                        type="button"
                        data-testid={`open-video-${lesson.id}`}
                        className="btn btn-xs"
                        onClick={() => void onOpenExternalUrl(timestampUrl)}
                      >
                        <ExternalLink size={12} /> Abrir vídeo ({formatSecondsToTimestamp(linkSeconds)})
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className={`badge ${lesson.verificationStatus === 'verified_transcript_and_visual' ? 'badge-green' : 'badge-muted'}`}>
                        {lesson.verificationStatus === 'verified_transcript_and_visual' ? (
                          <CheckCircle2 size={11} />
                        ) : (
                          <Eye size={11} />
                        )}
                        {lesson.verificationStatus === 'verified_transcript_and_visual'
                          ? 'Verificado (legenda + visual)'
                          : lesson.verificationStatus === 'visual_only'
                            ? 'Análise visual (fala não verificada)'
                            : 'Exercício de treino'}
                      </span>
                      {rule ? (
                        <span className="badge badge-muted">
                          {lesson.isHistoricalReference ? <History size={11} /> : null}
                          {rule.patchValidity}
                        </span>
                      ) : null}
                    </div>

                    {rule?.changePlanCondition ? (
                      <div>
                        <strong>Quando mudar de plano:</strong> {rule.changePlanCondition}
                      </div>
                    ) : null}

                    {rule?.uncertaintyNote ? (
                      <div className="muted-text">
                        <strong>Limite da leitura:</strong> {rule.uncertaintyNote}
                      </div>
                    ) : null}

                    {lesson.macro ? (
                      <>
                        <div>
                          <strong>Contexto no VOD ({lesson.gameClockDisplay}):</strong>{' '}
                          {lesson.macro.beforePlayContext}
                        </div>
                        <div className="muted-text">
                          <strong>O que fez e alternativa:</strong> {lesson.macro.actionAndAlternative}
                        </div>
                      </>
                    ) : null}

                    {lesson.micro ? (
                      <>
                        <div>
                          <strong>Guardar:</strong> {lesson.micro.heldAbility} —{' '}
                          <span className="muted-text">{lesson.micro.heldAbilityReason}</span>
                        </div>
                        <div className="muted-text">
                          <strong>Se o alvo usar dash:</strong> {lesson.micro.targetDodgesOrDashes}
                        </div>
                        <div style={{ color: '#a7f3d0' }}>
                          <strong>Modo Treino:</strong> {lesson.micro.practiceModeDrill}
                        </div>
                        {lesson.micro.sequenceUncertaintyNote ? (
                          <div style={{ color: '#fde68a' }}>{lesson.micro.sequenceUncertaintyNote}</div>
                        ) : null}
                      </>
                    ) : null}

                    {lesson.karasmaiPt ? (
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                        <div>
                          <strong>Resumo em PT-BR (Karasmai):</strong> {lesson.karasmaiPt.whatHeExplained}
                        </div>
                        {lesson.karasmaiPt.englishTerms.length > 0 ? (
                          <div className="muted-text" style={{ marginTop: 3 }}>
                            <strong>Termos:</strong>{' '}
                            {lesson.karasmaiPt.englishTerms
                              .map((t) => `${t.term} (${t.meaningPt})`)
                              .join(' · ')}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Personalização local da dica */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 7, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="text"
                        className="input"
                        style={{ fontSize: 12, padding: '4px 8px' }}
                        placeholder="Personalizar sua frase de lembrete (salva localmente)..."
                        value={noteDrafts[ruleId] ?? userNote}
                        onChange={(e) =>
                          setNoteDrafts((prev) => ({ ...prev, [ruleId]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-xs btn-primary"
                        onClick={() => void onSaveRuleNote(ruleId, noteDrafts[ruleId] ?? userNote)}
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      {/* Fontes pendentes e cadastro manual offline (colapsado) */}
      <ExpandableSection
        title={`Fontes pendentes de curadoria (${pendingLessons.length}) & Cadastrar vídeo`}
        badge="Fora das regras prontas"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="pending-lessons-list">
            {pendingLessons.map((pl) => {
              const sec = pl.contextStartSeconds ?? pl.playMomentSeconds;
              return (
                <div
                  key={pl.id}
                  className="panel-subtle"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                >
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <strong>{pl.title}</strong>{' '}
                    <span className="small-text muted-text">({pl.creatorDisplayName} · {pl.timestampDisplay})</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-xs"
                      onClick={() =>
                        void onOpenExternalUrl(buildTimestampedYouTubeUrl(pl.videoUrl, sec))
                      }
                    >
                      <ExternalLink size={12} /> Assistir
                    </button>
                    {pl.isCustom ? (
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        aria-label={`Excluir fonte ${pl.title}`}
                        onClick={() => void onDeleteCustomLesson(pl.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="panel">
            <strong className="small-text">Cadastrar vídeo e timestamp manualmente (offline)</strong>
            <div className="grid-3">
              <label className="field-label">
                <span>Título curto</span>
                <input
                  type="text"
                  data-testid="manual-lesson-title"
                  className="input"
                  placeholder="Ex.: Caiozera aborta Bot aos 04:10"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                />
              </label>
              <label className="field-label">
                <span>URL (https://...)</span>
                <input
                  type="url"
                  data-testid="manual-lesson-url"
                  className="input"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                />
              </label>
              <label className="field-label">
                <span>Timestamp (MM:SS)</span>
                <input
                  type="text"
                  data-testid="manual-lesson-timestamp"
                  className="input"
                  placeholder="04:10"
                  value={manualTs}
                  onChange={(e) => setManualTs(e.target.value)}
                />
              </label>
              <label className="field-label">
                <span>Criador</span>
                <select
                  className="select"
                  value={manualCreator}
                  onChange={(e) => setManualCreator(e.target.value as StudyCreator)}
                >
                  <option value="caiozera">CaiozeraLoL</option>
                  <option value="karasmai">Karasmai</option>
                  <option value="training_drill">Exercício próprio</option>
                </select>
              </label>
              <label className="field-label">
                <span>Assunto</span>
                <select
                  className="select"
                  value={manualTopic}
                  onChange={(e) => setManualTopic(e.target.value as StudyTopic)}
                >
                  <option value="macro">Macro</option>
                  <option value="micro">Micro</option>
                </select>
              </label>
              <label className="field-label">
                <span>Forma</span>
                <select
                  className="select"
                  value={manualForm}
                  onChange={(e) => setManualForm(e.target.value as StudyKaynForm)}
                >
                  <option value="base">Kayn Base</option>
                  <option value="blue">Kayn Azul</option>
                  <option value="red">Rhaast</option>
                  <option value="both">Ambas</option>
                </select>
              </label>
            </div>
            <label className="field-label">
              <span>O que observar nesse trecho</span>
              <input
                type="text"
                className="input"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
              />
            </label>
            {manualFeedback ? (
              <div className={`banner ${manualFeedback.ok ? 'banner-success' : 'banner-warning'}`}>
                {manualFeedback.text}
              </div>
            ) : null}
            <div>
              <button
                type="button"
                data-testid="manual-lesson-submit"
                className="btn btn-xs btn-primary"
                onClick={() => void handleCreateManual()}
              >
                <Plus size={12} /> Salvar fonte pendente
              </button>
            </div>
          </div>
        </div>
      </ExpandableSection>
    </div>
  );
}
