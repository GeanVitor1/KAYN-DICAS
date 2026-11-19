import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  ExternalLink,
  EyeOff,
  Flame,
  Heart,
  HelpCircle,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Swords,
  Trees,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { DEMO_TRAINING_SCENARIOS } from '../../engine/demos';
import { buildTimestampedYouTubeUrl } from '../../engine/studyLibrary';
import { matchRulesForTrainingScenario } from '../../engine/tacticalMemory';
import { analyzeTrainingScenario } from '../../engine/trainingSimulator';
import type {
  LanePrioState,
  MapSide,
  TacticalRule,
  TrainingOptionId,
  TrainingScenario,
  TriStateBool,
} from '../../shared/types';
import { ExpandableSection } from '../components/ExpandableSection';
import { TacticalMapSvg } from '../components/TacticalMapSvg';

const SHORT_OPTION_HEADLINE: Record<TrainingOptionId, string> = {
  start_objective: 'Jogue pelo objetivo',
  gank_bot: 'Ganke a Bot Lane',
  gank_other_lane: 'Ganke a outra rota',
  farm_route: 'Limpe os campos',
  reset_spend_gold: 'Resete para gastar ouro',
};

function buildShortSignals(s: TrainingScenario): Array<{
  kind: 'warn' | 'good' | 'neutral';
  icon: 'bot' | 'mid' | 'jg' | 'hp' | 'gold' | 'wait';
  label: string;
}> {
  const out: Array<{
    kind: 'warn' | 'good' | 'neutral';
    icon: 'bot' | 'mid' | 'jg' | 'hp' | 'gold' | 'wait';
    label: string;
  }> = [];

  if (s.botWaveState === 'pushed_to_enemy') {
    out.push({ kind: 'warn', icon: 'bot', label: 'Bot sob torre inimiga' });
  } else if (s.botWaveState === 'pushed_to_ally' && s.botAllySetupReady === 'yes') {
    out.push({ kind: 'good', icon: 'bot', label: 'Bot avançada + setup' });
  } else if (s.botPrio === 'enemy') {
    out.push({ kind: 'warn', icon: 'bot', label: 'Bot sem prioridade' });
  } else if (s.botPrio === 'ally') {
    out.push({ kind: 'good', icon: 'bot', label: 'Bot com prioridade' });
  }

  if (s.midPrio === 'enemy') {
    out.push({ kind: 'warn', icon: 'mid', label: 'Mid sem prioridade' });
  } else if (s.midPrio === 'ally') {
    out.push({ kind: 'good', icon: 'mid', label: 'Mid com prioridade' });
  } else if (s.midPrio === 'unknown') {
    out.push({ kind: 'neutral', icon: 'mid', label: 'Prio Mid desconhecida' });
  }

  if (s.enemyJunglerPosition === 'unknown') {
    out.push({ kind: 'warn', icon: 'jg', label: 'JG inimigo sumido' });
  } else if (s.enemyJunglerPosition === 'top_side') {
    out.push({ kind: 'good', icon: 'jg', label: 'JG inimigo no Top' });
  } else if (s.enemyJunglerPosition === 'bot_side') {
    out.push({ kind: 'warn', icon: 'jg', label: 'JG inimigo na Bot' });
  }

  if (s.timeAlreadyWaitingSeconds >= 10) {
    out.push({ kind: 'warn', icon: 'wait', label: `${s.timeAlreadyWaitingSeconds}s esperando` });
  } else if (s.botSupportHpLow === 'yes') {
    out.push({ kind: 'warn', icon: 'hp', label: 'Suporte aliado baixo' });
  } else if (s.unspentGold >= s.keyComponentCost) {
    out.push({ kind: 'good', icon: 'gold', label: `${s.unspentGold}g para pico` });
  } else if (s.hpPercent < 60) {
    out.push({ kind: 'warn', icon: 'hp', label: `Vida baixa (${s.hpPercent}%)` });
  }

  return out.slice(0, 4);
}

function formatScenarioFarmPill(s: TrainingScenario): string | null {
  if (s.laneCs !== null && s.jungleCampsCleared !== null) {
    return `${s.jungleCampsCleared} campos · ${s.laneCs} CS lane`;
  }
  if (s.jungleCampsCleared !== null) {
    return `${s.jungleCampsCleared} campos selva`;
  }
  if (s.totalCs !== null && s.totalCs !== undefined) {
    return `${s.totalCs} CS (HUD)`;
  }
  return null;
}

export function TrainingPage({
  scenarios,
  tacticalRules,
  selectedScenarioId,
  onSaveScenario,
  onOpenExternalUrl,
}: {
  scenarios: TrainingScenario[];
  tacticalRules: TacticalRule[];
  selectedScenarioId?: string | null;
  onSaveScenario: (scenario: TrainingScenario) => Promise<void>;
  onOpenExternalUrl: (url: string) => Promise<void>;
}) {
  const initialIndex = useMemo(() => {
    if (selectedScenarioId) {
      const idx = scenarios.findIndex((s) => s.id === selectedScenarioId);
      if (idx >= 0) return idx;
    }
    return 0;
  }, [scenarios, selectedScenarioId]);

  const [selectedId, setSelectedId] = useState<string>(
    scenarios[initialIndex]?.id || DEMO_TRAINING_SCENARIOS[0].id,
  );
  const [scenario, setScenario] = useState<TrainingScenario>(
    () => scenarios[initialIndex] ?? DEMO_TRAINING_SCENARIOS[0],
  );
  const [userPick, setUserPick] = useState<TrainingOptionId | null>(null);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const analysis = useMemo(() => analyzeTrainingScenario(scenario), [scenario]);
  const matchedRules = useMemo(
    () => matchRulesForTrainingScenario(scenario, analysis, tacticalRules),
    [scenario, analysis, tacticalRules],
  );
  const signals = useMemo(() => buildShortSignals(scenario), [scenario]);
  const farmPill = useMemo(() => formatScenarioFarmPill(scenario), [scenario]);

  const currentIdx = Math.max(
    0,
    scenarios.findIndex((s) => s.id === selectedId),
  );

  const loadScenario = (s: TrainingScenario) => {
    setSelectedId(s.id);
    setScenario({ ...s });
    setUserPick(null);
    setShowFullAnalysis(false);
    setSavedNotice(null);
  };

  const handleStep = (delta: number) => {
    if (scenarios.length === 0) return;
    const nextIdx = (currentIdx + delta + scenarios.length) % scenarios.length;
    loadScenario(scenarios[nextIdx]);
  };

  const handleSaveCopy = async () => {
    const custom: TrainingScenario = {
      ...scenario,
      id: scenario.isExampleDemo ? `train-custom-${Date.now()}` : scenario.id,
      title: scenario.isExampleDemo ? `${scenario.title} (Editado)` : scenario.title,
      isExampleDemo: false,
    };
    await onSaveScenario(custom);
    setSelectedId(custom.id);
    setScenario(custom);
    setSavedNotice('Variação salva localmente.');
  };

  const updateField = <K extends keyof TrainingScenario>(key: K, value: TrainingScenario[K]) => {
    setScenario((prev) => ({ ...prev, [key]: value }));
  };

  const pickedMatchedPreferred = userPick === analysis.preferredOption.optionId;
  const pickedMatchedSecond = userPick === analysis.secondOption.optionId;

  const actionButtons: Array<{
    id: TrainingOptionId;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: 'gank_bot', label: 'Gankar Bot', icon: <Swords size={15} /> },
    { id: 'farm_route', label: 'Farmar', icon: <Trees size={15} /> },
    { id: 'reset_spend_gold', label: 'Resetar', icon: <RotateCcw size={15} /> },
    ...(scenario.objectiveType !== 'none'
      ? [{ id: 'start_objective' as TrainingOptionId, label: 'Objetivo', icon: <Flame size={15} /> }]
      : []),
    ...(scenario.otherLaneSetupReady === 'yes' || scenario.otherLaneEnemyOverextended === 'yes'
      ? [
          {
            id: 'gank_other_lane' as TrainingOptionId,
            label: `Gankar ${scenario.otherLaneTarget === 'top' ? 'Top' : 'Mid'}`,
            icon: <Swords size={15} />,
          },
        ]
      : []),
  ];

  const primaryRule = matchedRules[0];
  const shortReason =
    analysis.trapWarning ??
    analysis.preferredOption.reasons[0] ??
    'Opção com melhor retorno esperado pelas informações disponíveis.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Seletor compacto de 1 cenário por vez */}
      <div className="toolbar">
        <div className="toolbar-group" style={{ flex: 1 }}>
          <button
            type="button"
            className="btn btn-xs"
            aria-label="Cenário anterior"
            onClick={() => handleStep(-1)}
          >
            <ChevronLeft size={14} />
          </button>
          <select
            className="select"
            aria-label="Selecionar cenário de treino"
            style={{ maxWidth: 460 }}
            value={selectedId}
            onChange={(e) => {
              const found = scenarios.find((s) => s.id === e.target.value);
              if (found) loadScenario(found);
            }}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-xs"
            aria-label="Próximo cenário"
            onClick={() => handleStep(1)}
          >
            <ChevronRight size={14} />
          </button>
          <span className="small-text muted-text">
            {currentIdx + 1}/{scenarios.length}
          </span>
        </div>

        <div className="toolbar-group">
          {savedNotice ? <span className="badge badge-green">{savedNotice}</span> : null}
          {userPick ? (
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => {
                setUserPick(null);
                setShowFullAnalysis(false);
              }}
            >
              Tentar de novo
            </button>
          ) : null}
        </div>
      </div>

      {/* PALCO VISUAL DO CENÁRIO (ESTILO MOCKUP) */}
      <section className="training-stage">
        <div className="training-title-bar">
          <div style={{ fontWeight: 700, fontSize: 15, color: '#ffffff' }}>
            {scenario.title}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="badge badge-muted">Min {scenario.minute}</span>
            <span className="badge badge-muted">Nv {scenario.level}</span>
            <span className="badge badge-muted">HP {scenario.hpPercent}%</span>
            <span className="badge badge-muted">{scenario.unspentGold}g</span>
            {farmPill ? <span className="badge badge-muted">{farmPill}</span> : null}
          </div>
        </div>

        <div className="training-stage-grid">
          {/* Mapa esquemático à esquerda */}
          <div>
            <TacticalMapSvg
              focusSide={
                scenario.objectiveType === 'dragon' || scenario.botWaveState !== 'even'
                  ? 'bot'
                  : scenario.otherLaneTarget
              }
              trainingOverlay={{
                topPrio: scenario.topPrio,
                midPrio: scenario.midPrio,
                botPrio: scenario.botPrio,
                enemyJg: scenario.enemyJunglerPosition,
                objectiveType: scenario.objectiveType,
              }}
            />
          </div>

          {/* Sinais curtos + Escolha + Resultado à direita */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Sinais curtos */}
            <div className="training-signals-grid">
              {signals.map((sig, idx) => (
                <div
                  key={idx}
                  className={`training-signal-box ${
                    sig.kind === 'warn'
                      ? 'signal-pill-warn'
                      : sig.kind === 'good'
                        ? 'signal-pill-good'
                        : ''
                  }`}
                >
                  {sig.icon === 'bot' ? <Users size={15} /> : null}
                  {sig.icon === 'mid' ? <AlertTriangle size={15} /> : null}
                  {sig.icon === 'jg' ? <EyeOff size={15} /> : null}
                  {sig.icon === 'hp' ? <Heart size={15} /> : null}
                  {sig.icon === 'gold' ? <Coins size={15} /> : null}
                  {sig.icon === 'wait' ? <Clock size={15} /> : null}
                  <span>{sig.label}</span>
                </div>
              ))}
            </div>

            {/* Botões de ação (escolha antes da resposta!) */}
            <div>
              <div className="small-text muted-text" style={{ marginBottom: 7, fontWeight: 600 }}>
                {userPick ? 'Sua escolha:' : 'Qual sua decisão agora?'}
              </div>
              <div className="training-actions-grid">
                {actionButtons.map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    data-testid={`train-choice-${btn.id}`}
                    className={`training-action-btn ${userPick === btn.id ? 'is-selected' : ''}`}
                    onClick={() => setUserPick(btn.id)}
                  >
                    {btn.icon}
                    <span>{btn.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Resposta revelada APÓS a escolha */}
            {userPick ? (
              <div
                data-testid="training-preferred-option"
                className={`training-verdict-box ${
                  pickedMatchedPreferred ? 'training-verdict-good' : 'training-verdict-warn'
                }`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {pickedMatchedPreferred ? (
                      <CheckCircle2 size={20} color="var(--green)" />
                    ) : (
                      <AlertTriangle size={20} color="var(--amber)" />
                    )}
                    <strong style={{ fontSize: 16.5, color: '#ffffff' }}>
                      {SHORT_OPTION_HEADLINE[analysis.preferredOption.optionId]}
                    </strong>
                  </div>
                  <span className={`badge ${pickedMatchedPreferred ? 'badge-green' : pickedMatchedSecond ? 'badge-blue' : 'badge-amber'}`}>
                    {pickedMatchedPreferred
                      ? 'Boa leitura'
                      : pickedMatchedSecond
                        ? 'Alternativa viável'
                        : 'Melhor outro plano'}
                  </span>
                </div>

                <div style={{ fontSize: 13.5, color: '#dbe6f7' }}>{shortReason}</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                  <button
                    type="button"
                    data-testid="train-toggle-analysis"
                    className="btn btn-xs"
                    onClick={() => setShowFullAnalysis((v) => !v)}
                  >
                    {showFullAnalysis ? 'Ocultar análise' : 'Ver análise'}
                  </button>

                  {primaryRule ? (
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      style={{ color: 'var(--blue)' }}
                      onClick={() =>
                        void onOpenExternalUrl(
                          buildTimestampedYouTubeUrl(
                            primaryRule.videoUrl,
                            primaryRule.contextStartSeconds,
                          ),
                        )
                      }
                    >
                      <ExternalLink size={12} /> Ver jogada ({primaryRule.creatorDisplayName})
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="panel-subtle small-text muted-text" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HelpCircle size={15} />
                <span>Escolha uma ação acima para revelar a resposta e o motivo.</span>
              </div>
            )}
          </div>
        </div>

        {/* ANÁLISE COMPLETA SOB DEMANDA ("Ver análise") */}
        {userPick && showFullAnalysis ? (
          <div className="grid-2" data-testid="training-full-analysis" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div className="panel-subtle small-text" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>
                <strong>1ª opção ({analysis.preferredOption.label}):</strong>
                <ul className="list-compact" style={{ marginTop: 4 }}>
                  {analysis.preferredOption.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>2ª opção ({analysis.secondOption.label}):</strong>{' '}
                <span className="muted-text">{analysis.secondOption.reasons[0]}</span>
              </div>
              <div>
                <strong>Quando abortar:</strong>{' '}
                <span className="muted-text">{analysis.preferredOption.abortConditions.join(' ')}</span>
              </div>
              {primaryRule ? (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                  <strong style={{ color: 'var(--blue)' }}>
                    Regra tática ({primaryRule.creatorDisplayName}):
                  </strong>{' '}
                  {primaryRule.oneLineTip}{' '}
                  <span className="muted-text">({primaryRule.changePlanCondition})</span>
                </div>
              ) : null}
            </div>

            <div className="panel-subtle small-text" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>
                <strong>O que mais mudaria a decisão:</strong>{' '}
                <span className="muted-text">{analysis.mostImpactfulUnknown}</span>
              </div>
              <div>
                <strong>Ritmo de farm:</strong>{' '}
                <span className="muted-text">{analysis.farmTempoNote}</span>
              </div>
              {analysis.unknownFields.length > 0 ? (
                <div>
                  <strong>Dados desconhecidos:</strong>{' '}
                  <span className="muted-text">{analysis.unknownFields.join(' ')}</span>
                </div>
              ) : null}
              {analysis.conditionalDecisions.length > 0 ? (
                <div>
                  <strong>Se o cenário mudar:</strong>
                  <ul className="list-compact" style={{ marginTop: 3 }}>
                    {analysis.conditionalDecisions.map((cd, i) => (
                      <li key={i}>{cd}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {/* Editar parâmetros (colapsado para não poluir a prática!) */}
      <ExpandableSection title="Editar parâmetros deste cenário">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span className="small-text muted-text">
              <SlidersHorizontal size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />
              {scenario.description}
            </span>
            <button type="button" className="btn btn-xs" onClick={() => void handleSaveCopy()}>
              <Save size={12} /> Salvar variação
            </button>
          </div>
          <div className="grid-3">
            <div className="panel-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <strong className="small-text">1. Meu Estado</strong>
              <div className="grid-2">
                <label className="field-label">
                  <span>Minuto</span>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={60}
                    value={scenario.minute}
                    onChange={(e) => updateField('minute', Number(e.target.value) || 1)}
                  />
                </label>
                <label className="field-label">
                  <span>Vida (%)</span>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={100}
                    value={scenario.hpPercent}
                    onChange={(e) => updateField('hpPercent', Number(e.target.value) || 50)}
                  />
                </label>
                <label className="field-label">
                  <span>Ouro na mão</span>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    step={50}
                    value={scenario.unspentGold}
                    onChange={(e) => updateField('unspentGold', Number(e.target.value) || 0)}
                  />
                </label>
                <label className="field-label">
                  <span>Segundos esperando</span>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    max={60}
                    value={scenario.timeAlreadyWaitingSeconds}
                    onChange={(e) =>
                      updateField('timeAlreadyWaitingSeconds', Number(e.target.value) || 0)
                    }
                  />
                </label>
                <label className="field-label">
                  <span>CS de Lane</span>
                  <input
                    type="number"
                    className="input"
                    placeholder="N/D"
                    value={scenario.laneCs ?? ''}
                    onChange={(e) =>
                      updateField('laneCs', e.target.value === '' ? null : Number(e.target.value))
                    }
                  />
                </label>
                <label className="field-label">
                  <span>Campos Jungle</span>
                  <input
                    type="number"
                    className="input"
                    placeholder="N/D"
                    value={scenario.jungleCampsCleared ?? ''}
                    onChange={(e) =>
                      updateField(
                        'jungleCampsCleared',
                        e.target.value === '' ? null : Number(e.target.value),
                      )
                    }
                  />
                </label>
              </div>
            </div>

            <div className="panel-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <strong className="small-text">2. Objetivo &amp; Pressão</strong>
              <div className="grid-2">
                <label className="field-label">
                  <span>Objetivo</span>
                  <select
                    className="select"
                    value={scenario.objectiveType}
                    onChange={(e) =>
                      updateField('objectiveType', e.target.value as TrainingScenario['objectiveType'])
                    }
                  >
                    <option value="dragon">Dragão</option>
                    <option value="voidgrubs">Vastilarvas</option>
                    <option value="herald">Arauto</option>
                    <option value="baron">Barão</option>
                    <option value="none">Nenhum</option>
                  </select>
                </label>
                <label className="field-label">
                  <span>Nasce em (s)</span>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    max={300}
                    value={scenario.objectiveSpawnInSeconds}
                    onChange={(e) =>
                      updateField('objectiveSpawnInSeconds', Number(e.target.value) || 0)
                    }
                  />
                </label>
                <label className="field-label">
                  <span>Prio Mid</span>
                  <select
                    className="select"
                    value={scenario.midPrio}
                    onChange={(e) => updateField('midPrio', e.target.value as LanePrioState)}
                  >
                    <option value="ally">Aliada</option>
                    <option value="even">Neutra</option>
                    <option value="enemy">Inimiga</option>
                    <option value="unknown">Desconhecida</option>
                  </select>
                </label>
                <label className="field-label">
                  <span>Prio Bot</span>
                  <select
                    className="select"
                    value={scenario.botPrio}
                    onChange={(e) => updateField('botPrio', e.target.value as LanePrioState)}
                  >
                    <option value="ally">Aliada</option>
                    <option value="even">Neutra</option>
                    <option value="enemy">Inimiga</option>
                    <option value="unknown">Desconhecida</option>
                  </select>
                </label>
                <label className="field-label">
                  <span>Lado</span>
                  <select
                    className="select"
                    value={scenario.mapSide}
                    onChange={(e) => updateField('mapSide', e.target.value as MapSide)}
                  >
                    <option value="blue_side">Azul</option>
                    <option value="red_side">Vermelho</option>
                  </select>
                </label>
                <label className="field-label">
                  <span>Campos prontos</span>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    max={6}
                    value={scenario.availableCampsCount}
                    onChange={(e) => updateField('availableCampsCount', Number(e.target.value) || 0)}
                  />
                </label>
              </div>
            </div>

            <div className="panel-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <strong className="small-text">3. Bot &amp; JG Inimigo</strong>
              <div className="grid-2">
                <label className="field-label">
                  <span>JG Inimigo</span>
                  <select
                    className="select"
                    value={scenario.enemyJunglerPosition}
                    onChange={(e) =>
                      updateField(
                        'enemyJunglerPosition',
                        e.target.value as TrainingScenario['enemyJunglerPosition'],
                      )
                    }
                  >
                    <option value="unknown">Fora de visão</option>
                    <option value="top_side">Top</option>
                    <option value="bot_side">Bot</option>
                    <option value="mid_area">Mid</option>
                    <option value="base_or_dead">Base / Morto</option>
                  </select>
                </label>
                <label className="field-label">
                  <span>Wave Bot</span>
                  <select
                    className="select"
                    value={scenario.botWaveState}
                    onChange={(e) =>
                      updateField('botWaveState', e.target.value as TrainingScenario['botWaveState'])
                    }
                  >
                    <option value="pushed_to_ally">Inimigo avançado</option>
                    <option value="even">Meio</option>
                    <option value="pushed_to_enemy">Sob torre inimiga</option>
                    <option value="frozen_enemy">Congelada inimiga</option>
                    <option value="unknown">Desconhecida</option>
                  </select>
                </label>
                <label className="field-label">
                  <span>Setup aliado Bot</span>
                  <select
                    className="select"
                    value={scenario.botAllySetupReady}
                    onChange={(e) => updateField('botAllySetupReady', e.target.value as TriStateBool)}
                  >
                    <option value="yes">Sim</option>
                    <option value="no">Não</option>
                    <option value="unknown">Desconhecido</option>
                  </select>
                </label>
                <label className="field-label">
                  <span>Suporte baixo?</span>
                  <select
                    className="select"
                    value={scenario.botSupportHpLow}
                    onChange={(e) => updateField('botSupportHpLow', e.target.value as TriStateBool)}
                  >
                    <option value="no">Não</option>
                    <option value="yes">Sim</option>
                    <option value="unknown">Desconhecido</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>
      </ExpandableSection>
    </div>
  );
}
