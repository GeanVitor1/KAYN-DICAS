import {
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  GraduationCap,
  History,
  Play,
  Plus,
  Star,
  Trash2,
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
import type {
  StudyCreator,
  StudyKaynForm,
  StudyLesson,
  StudyTopic,
  StudyVerificationStatus,
} from '../../shared/types';
import { ComboSequenceBadge } from '../components/ComboSequenceBadge';
import { ExpandableSection } from '../components/ExpandableSection';
import { FormBadge } from '../components/FormBadge';

function VerificationBadge({
  status,
  speechVerified,
}: {
  status: StudyVerificationStatus;
  speechVerified: boolean;
}) {
  if (status === 'verified_transcript_and_visual') {
    return (
      <span className="badge badge-green">
        <CheckCircle2 size={11} /> Verificado (legenda + visual)
      </span>
    );
  }
  if (status === 'visual_only') {
    return (
      <span className="badge badge-blue">
        <Eye size={11} /> Análise visual {speechVerified ? '' : '(fala não verificada)'}
      </span>
    );
  }
  if (status === 'generic_drill') {
    return (
      <span className="badge badge-muted">
        <GraduationCap size={11} /> Exercício de treino
      </span>
    );
  }
  return (
    <span className="badge badge-amber">
      <Clock size={11} /> Pendente de curadoria
    </span>
  );
}

function toKaynBadgeProps(form: StudyKaynForm): { form: 'blue' | 'red' | 'open'; label: string } {
  if (form === 'blue') return { form: 'blue', label: 'Kayn Azul' };
  if (form === 'red') return { form: 'red', label: 'Rhaast' };
  if (form === 'base') return { form: 'open', label: 'Kayn Base' };
  return { form: 'open', label: 'Azul & Rhaast' };
}

export function LearnPage({
  customLessons,
  favoriteMicroIds,
  onToggleFavoriteMicro,
  onSaveCustomLesson,
  onDeleteCustomLesson,
  onOpenExternalUrl,
  onPracticeInTraining,
  onOpenDraftTab,
}: {
  customLessons: StudyLesson[];
  favoriteMicroIds: string[];
  onToggleFavoriteMicro: (ids: string[]) => Promise<void>;
  onSaveCustomLesson: (lesson: StudyLesson) => Promise<void>;
  onDeleteCustomLesson: (lessonId: string) => Promise<void>;
  onOpenExternalUrl: (url: string) => Promise<void>;
  onPracticeInTraining: (scenarioId: string) => void;
  onOpenDraftTab: () => void;
}) {
  const [creatorFilter, setCreatorFilter] = useState<'all' | StudyCreator>('all');
  const [topicFilter, setTopicFilter] = useState<'all' | StudyTopic>('all');
  const [formFilter, setFormFilter] = useState<'all' | StudyKaynForm>('all');
  const [highlightId, setHighlightId] = useState<string | null>('caiozera-macro-bot-abort-river');
  const [favWarning, setFavWarning] = useState<string | null>(null);

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
      text: 'Fonte cadastrada na seção de pendentes (salva localmente para abrir offline).',
    });
  };

  const focusQuickGuide = (targetTopic: StudyTopic, targetId: string) => {
    setCreatorFilter('all');
    setTopicFilter(targetTopic);
    setFormFilter('all');
    setHighlightId(targetId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Guia rápido das duas perguntas principais do jogador */}
      <div className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <span className="badge badge-blue">Prioridade 1 · Parar de forçar Bot</span>
            <button
              type="button"
              data-testid="quick-bot-lesson"
              className="btn btn-xs btn-blue"
              onClick={() => focusQuickGuide('macro', 'caiozera-macro-bot-abort-river')}
            >
              Focar lição do CaiozeraLoL
            </button>
          </div>
          <strong>O que eu preciso ver antes de gastar tempo tentando gankar Bot?</strong>
          <div className="small-text muted-text">
            Wave empurrada vs espaço de gank, prioridade real de Bot/Mid para jogar rio e vida/setup do suporte — veja na 1ª lição abaixo como Caiozera pula a Bot empurrada para virar 3v3 no rio.
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="badge badge-green">Prioridade 2 · Modo Treino &amp; Cartão</span>
            <button
              type="button"
              data-testid="quick-micro-lesson"
              className="btn btn-xs btn-primary"
              onClick={() => focusQuickGuide('micro', 'caiozera-micro-rhaast-e-wall-pivot')}
            >
              Ver mecânica para hoje
            </button>
          </div>
          <strong>Qual mecânica posso praticar hoje e fixar no cartão pré-jogo?</strong>
          <div className="small-text muted-text">
            Entrar pelo terreno com <span className="mono">E</span> segurando <span className="mono">Q/W</span> (Rhaast) e treinar <span className="mono">W</span> andando dentro da parede (Azul). Você tem <strong>{favoriteMicroIds.length}/{MAX_FAVORITE_MICRO_CARDS}</strong> combos fixados.
          </div>
        </div>
      </div>

      {/* Barra de filtros + Status de favoritos */}
      <div className="toolbar" data-testid="learn-filters">
        <div className="toolbar-group">
          <label className="small-text" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="muted-text">Criador:</span>
            <select
              className="select"
              data-testid="filter-creator"
              style={{ width: 'auto' }}
              value={creatorFilter}
              onChange={(e) => setCreatorFilter(e.target.value as 'all' | StudyCreator)}
            >
              <option value="all">Todos (Caiozera no topo)</option>
              <option value="caiozera">CaiozeraLoL (@caiozerinha)</option>
              <option value="karasmai">Karasmai (explicado em PT-BR)</option>
              <option value="training_drill">Exercícios de Modo Treino</option>
            </select>
          </label>

          <label className="small-text" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="muted-text">Assunto:</span>
            <select
              className="select"
              data-testid="filter-topic"
              style={{ width: 'auto' }}
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value as 'all' | StudyTopic)}
            >
              <option value="all">Macro &amp; Micro</option>
              <option value="macro">Macro (decisão de mapa)</option>
              <option value="micro">Micro (combos &amp; execução)</option>
            </select>
          </label>

          <label className="small-text" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="muted-text">Forma:</span>
            <select
              className="select"
              data-testid="filter-form"
              style={{ width: 'auto' }}
              value={formFilter}
              onChange={(e) => setFormFilter(e.target.value as 'all' | StudyKaynForm)}
            >
              <option value="all">Todas as formas</option>
              <option value="base">Kayn Base</option>
              <option value="blue">Kayn Azul</option>
              <option value="red">Rhaast</option>
              <option value="both">Ambas</option>
            </select>
          </label>
        </div>

        <div className="toolbar-group">
          <span className="badge badge-amber" data-testid="favorite-micro-counter">
            <Star size={12} /> Favoritos p/ Cartão: {favoriteMicroIds.length}/{MAX_FAVORITE_MICRO_CARDS}
          </span>
          <button type="button" className="btn btn-xs" onClick={onOpenDraftTab}>
            Congelar no Draft/Cartão
          </button>
        </div>
      </div>

      {favWarning ? <div className="banner banner-warning">{favWarning}</div> : null}

      {/* Lista de lições prontas (Caiozera no topo por padrão) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-testid="learn-ready-list">
        {readyLessons.length === 0 ? (
          <div className="panel">
            <strong>Nenhuma lição pronta encontrada com os filtros atuais.</strong>
            <span className="small-text muted-text">
              Altere os filtros acima ou veja os links pendentes de curadoria abaixo.
            </span>
          </div>
        ) : (
          readyLessons.map((lesson) => {
            const formBadge = toKaynBadgeProps(lesson.form);
            const isHighlighted = highlightId === lesson.id;
            const isFav = favoriteMicroIds.includes(lesson.id);
            const linkSeconds = lesson.contextStartSeconds ?? lesson.playMomentSeconds;
            const timestampUrl = buildTimestampedYouTubeUrl(lesson.videoUrl, linkSeconds);

            return (
              <article
                key={lesson.id}
                data-testid={`lesson-card-${lesson.id}`}
                className="panel"
                style={{
                  borderColor: isHighlighted ? 'var(--blue-border)' : undefined,
                }}
              >
                {/* Cabeçalho da lição */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className="badge badge-muted" style={{ fontWeight: 800 }}>
                        {lesson.topic.toUpperCase()}
                      </span>
                      <span className="badge badge-muted">{lesson.attributionLabel}</span>
                      <FormBadge form={formBadge.form} label={formBadge.label} />
                      <VerificationBadge
                        status={lesson.verificationStatus}
                        speechVerified={lesson.speechVerified}
                      />
                      {lesson.isHistoricalReference ? (
                        <span className="badge badge-amber">
                          <History size={11} /> Referência histórica (não aplicar build/itens ao patch atual)
                        </span>
                      ) : null}
                    </div>
                    <h3 style={{ margin: '4px 0 0', fontSize: 15.5 }}>{lesson.title}</h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {lesson.topic === 'micro' && lesson.micro ? (
                      <button
                        type="button"
                        data-testid={`fav-btn-${lesson.id}`}
                        className={`btn btn-xs ${isFav ? 'btn-amber' : ''}`}
                        onClick={() => void handleToggleFavorite(lesson.id)}
                      >
                        <Star size={12} fill={isFav ? '#fbbf24' : 'none'} />
                        {isFav ? 'Fixado no cartão' : 'Fixar no cartão'}
                      </button>
                    ) : null}

                    {lesson.linkedTrainingScenarioId ? (
                      <button
                        type="button"
                        data-testid={`practice-btn-${lesson.id}`}
                        className="btn btn-xs btn-blue"
                        onClick={() => onPracticeInTraining(lesson.linkedTrainingScenarioId!)}
                      >
                        <Play size={12} /> Praticar no Treino
                      </button>
                    ) : null}

                    <button
                      type="button"
                      data-testid={`open-video-${lesson.id}`}
                      className="btn btn-xs"
                      onClick={() => void onOpenExternalUrl(timestampUrl)}
                    >
                      <ExternalLink size={12} /> Abrir vídeo ({formatSecondsToTimestamp(linkSeconds)})
                    </button>
                  </div>
                </div>

                {/* Metadados da fonte */}
                <div className="small-text muted-text">
                  <strong>Fonte:</strong> {lesson.channelName} — &ldquo;{lesson.videoTitle}&rdquo; •{' '}
                  <strong>Trecho:</strong> {lesson.timestampDisplay} ({lesson.gameClockDisplay}) •{' '}
                  <strong>Patch:</strong> {lesson.patch}
                </div>

                <div className="small-text">{lesson.shortSummaryPt}</div>
                <div className="small-text muted-text">
                  <strong>Evidência:</strong> {lesson.evidenceNote}
                </div>

                {/* Conteúdo específico de MACRO (5 pontos estruturados) */}
                {lesson.macro ? (
                  <div className="panel-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="small-text">
                      <strong>1. O que estava acontecendo (20–40s antes):</strong> {lesson.macro.beforePlayContext}
                    </div>
                    <div className="small-text">
                      <strong>2. Oportunidade ou risco visível na hora:</strong> {lesson.macro.visibleRiskOrOpportunity}
                    </div>
                    <div className="small-text">
                      <strong>3. O que fez e alternativa:</strong> {lesson.macro.actionAndAlternative}
                    </div>
                    <div className="small-text">
                      <strong>4. O que mudaria a decisão:</strong> {lesson.macro.whatWouldChangeDecision}
                    </div>
                    <div className="small-text" style={{ color: '#bae6fd' }}>
                      <strong>5. Como aplicar nas suas partidas:</strong> {lesson.macro.howToApply}
                    </div>
                    <div className="grid-2 small-text" style={{ marginTop: 4 }}>
                      <div className="panel" style={{ padding: 8 }}>
                        <strong style={{ color: 'var(--green)' }}>Funciona quando:</strong>
                        <div>{lesson.macro.worksWhen}</div>
                      </div>
                      <div className="panel" style={{ padding: 8 }}>
                        <strong style={{ color: 'var(--amber)' }}>Decisão diferente quando:</strong>
                        <div>{lesson.macro.chooseDifferentWhen}</div>
                      </div>
                    </div>
                    <div className="small-text muted-text">
                      <strong>Pergunta / exercício para a próxima sessão:</strong> {lesson.macro.sessionDrillOrQuestion}
                    </div>
                  </div>
                ) : null}

                {/* Conteúdo específico de MICRO (teclas grandes + detalhes práticos) */}
                {lesson.micro ? (
                  <div className="panel-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <span className="small-text">
                        <strong>{lesson.attributionLabel}</strong> ·{' '}
                        {lesson.micro.patchCompatibility === 'verified_16_23_1'
                          ? 'Compatível com patch 16.23.1'
                          : lesson.micro.patchCompatibility === 'historical_reference'
                            ? 'Referência histórica (conferir build atual no Draft)'
                            : 'Compatibilidade exata com patch atual não verificada'}
                      </span>
                    </div>

                    <ComboSequenceBadge steps={lesson.micro.steps} form={lesson.form} />

                    {lesson.micro.sequenceUncertaintyNote ? (
                      <div className="small-text" style={{ color: '#fde68a' }}>
                        <strong>Observação (* tecla incerta):</strong> {lesson.micro.sequenceUncertaintyNote}
                      </div>
                    ) : null}

                    <div className="grid-2 small-text">
                      <div>
                        <strong>Situação de uso:</strong> {lesson.micro.situation}
                      </div>
                      <div>
                        <strong>Pré-requisito:</strong> {lesson.micro.prerequisite}
                      </div>
                      <div>
                        <strong>Habilidade guardada:</strong> {lesson.micro.heldAbility} —{' '}
                        <span className="muted-text">{lesson.micro.heldAbilityReason}</span>
                      </div>
                      <div>
                        <strong>Se o alvo desviar / usar dash:</strong> {lesson.micro.targetDodgesOrDashes}
                      </div>
                      <div>
                        <strong>Erro comum:</strong> {lesson.micro.commonMistake}
                      </div>
                      <div style={{ color: '#a7f3d0' }}>
                        <strong>Exercício curto no Modo Treino:</strong> {lesson.micro.practiceModeDrill}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Bloco Karasmai em PT-BR */}
                {lesson.karasmaiPt ? (
                  <div className="panel" style={{ padding: 10, background: 'rgba(29, 78, 216, 0.08)', borderColor: 'var(--blue-border)' }}>
                    <div className="small-text" style={{ fontWeight: 700, color: 'var(--blue)' }}>
                      <BookOpen size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                      Karasmai explicado em português
                    </div>
                    <div className="small-text">
                      <strong>O que ele fez:</strong> {lesson.karasmaiPt.whatHeDid}
                    </div>
                    <div className="small-text">
                      <strong>O que ele explicou:</strong> {lesson.karasmaiPt.whatHeExplained}
                    </div>
                    <div className="small-text">
                      <strong>Como treinar:</strong> {lesson.karasmaiPt.howToTrain}
                    </div>
                    {lesson.karasmaiPt.englishTerms.length > 0 ? (
                      <div className="small-text muted-text">
                        <strong>Termos em inglês citados:</strong>{' '}
                        {lesson.karasmaiPt.englishTerms
                          .map((t) => `${t.term} (${t.meaningPt})`)
                          .join(' • ')}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      {/* Seção separada para fontes pendentes e cadastro manual offline */}
      <ExpandableSection
        title={`Fontes pendentes de curadoria (${pendingLessons.length}) & Cadastro manual de vídeo`}
        badge="Fora das recomendações prontas"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="small-text muted-text">
            Vídeos ou trechos em que só o título, cortes editados ou timestamp inicial foram confirmados ficam isolados aqui — nunca são tratados como lição validada nem fixados no cartão pré-jogo.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="pending-lessons-list">
            {pendingLessons.map((pl) => {
              const sec = pl.contextStartSeconds ?? pl.playMomentSeconds;
              return (
                <div key={pl.id} className="panel-subtle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className="badge badge-amber">Pendente</span>
                      <strong>{pl.title}</strong>
                      <span className="badge badge-muted">{pl.creatorDisplayName}</span>
                    </div>
                    <div className="small-text muted-text" style={{ marginTop: 3 }}>
                      {pl.shortSummaryPt} ({pl.timestampDisplay})
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-xs"
                      onClick={() =>
                        void onOpenExternalUrl(buildTimestampedYouTubeUrl(pl.videoUrl, sec))
                      }
                    >
                      <ExternalLink size={12} /> Assistir trecho
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

          {/* Cadastro manual */}
          <div className="panel">
            <strong>Cadastrar vídeo e timestamp manualmente (100% offline)</strong>
            <div className="grid-3">
              <label className="field-label">
                <span>Título curto da lição</span>
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
                <span>URL do vídeo (https://...)</span>
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
                <span>Timestamp (MM:SS ou segundos)</span>
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
              <span>Anotação do que você quer observar nesse trecho</span>
              <input
                type="text"
                className="input"
                placeholder="Ex.: Conferir onde o caçador inimigo apareceu no minimapa antes do reset"
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
                <Plus size={12} /> Cadastrar como fonte pendente
              </button>
            </div>
          </div>
        </div>
      </ExpandableSection>
    </div>
  );
}
