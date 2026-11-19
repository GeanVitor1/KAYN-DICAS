import { AlertTriangle, CheckCircle2, HelpCircle, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DEMO_TRAINING_SCENARIOS } from '../../engine/demos';
import { analyzeTrainingScenario } from '../../engine/trainingSimulator';
import type {
  LanePrioState,
  MapSide,
  TrainingOptionId,
  TrainingScenario,
  TriStateBool,
} from '../../shared/types';
import { ExpandableSection } from '../components/ExpandableSection';

export function TrainingPage({
  scenarios,
  selectedScenarioId,
  onSaveScenario,
}: {
  scenarios: TrainingScenario[];
  selectedScenarioId?: string | null;
  onSaveScenario: (scenario: TrainingScenario) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<string>(
    selectedScenarioId || scenarios[0]?.id || DEMO_TRAINING_SCENARIOS[0].id,
  );
  const [scenario, setScenario] = useState<TrainingScenario>(() => {
    const found = selectedScenarioId
      ? scenarios.find((s) => s.id === selectedScenarioId)
      : undefined;
    return found ?? scenarios[0] ?? DEMO_TRAINING_SCENARIOS[0];
  });
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [quizHideAnswer, setQuizHideAnswer] = useState(false);
  const [userPick, setUserPick] = useState<TrainingOptionId | null>(null);

  const analysis = useMemo(() => analyzeTrainingScenario(scenario), [scenario]);

  const loadScenario = (s: TrainingScenario) => {
    setSelectedId(s.id);
    setScenario({ ...s });
    setSavedNotice(null);
    setUserPick(null);
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
    setSavedNotice('Cenário salvo localmente para treinos futuros.');
  };

  const updateField = <K extends keyof TrainingScenario>(key: K, value: TrainingScenario[K]) => {
    setScenario((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="banner">
        <span>
          <strong>Treino de decisões (fora de partida ativa):</strong> teste cenários padronizados para aprender quando forçar Dragão, gankar Bot, resetar ou farmar.
        </span>
        <span className="badge badge-muted">100% offline e determinístico</span>
      </div>

      {/* Seletor dos 6 cenários Diamante */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Cenários Diamante prontos para treinar</h2>
          <button type="button" className="btn btn-xs" onClick={() => void handleSaveCopy()}>
            <Save size={12} /> Salvar variação
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`btn btn-xs ${selectedId === s.id ? 'btn-primary' : ''}`}
              onClick={() => loadScenario(s)}
            >
              {s.title}
            </button>
          ))}
        </div>
        <div className="small-text muted-text">{scenario.description}</div>
        {savedNotice ? (
          <div className="small-text" style={{ color: 'var(--green)' }}>
            {savedNotice}
          </div>
        ) : null}
      </div>

      {/* Desafio rápido: escolher antes de revelar */}
      <div className="panel">
        <div className="panel-header">
          <strong className="small-text">Teste seu reflexo antes de ler a resposta:</strong>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={quizHideAnswer}
              onChange={(e) => {
                setQuizHideAnswer(e.target.checked);
                if (e.target.checked) setUserPick(null);
              }}
            />
            <span>Ocultar análise até eu escolher</span>
          </label>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(
            [
              ['gank_bot', 'Gankar Bot'],
              ['gank_other_lane', 'Gankar Mid/Top'],
              ['start_objective', 'Jogar pelo Objetivo'],
              ['farm_route', 'Farmar campos'],
              ['reset_spend_gold', 'Resetar (Base)'],
            ] as Array<[TrainingOptionId, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn btn-xs ${userPick === id ? 'btn-blue' : ''}`}
              onClick={() => setUserPick(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {userPick ? (
          <div className="panel-subtle small-text">
            <strong>
              {userPick === analysis.preferredOption.optionId
                ? 'Sua escolha bateu com a 1ª opção!'
                : userPick === analysis.secondOption.optionId
                  ? 'Sua escolha é a 2ª opção viável — compare os trade-offs abaixo.'
                  : 'Atenção ao trade-off: essa escolha ficou atrás das opções principais neste cenário.'}
            </strong>{' '}
            {analysis.rankedOptions
              .find((o) => o.optionId === userPick)
              ?.reasons.join(' ')}
          </div>
        ) : null}
      </div>

      {/* Resultado Principal */}
      {!quizHideAnswer || userPick !== null ? (
      <div className="grid-2">
        <section className="panel">
          <h2 className="panel-title">Decisão Recomendada</h2>
          {analysis.trapWarning ? (
            <div className="banner banner-danger">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} />
                <span>{analysis.trapWarning}</span>
              </span>
            </div>
          ) : null}

          <div className="panel-subtle" data-testid="training-preferred-option">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-green">1ª Opção (Preferida)</span>
              <span className="mono small-text">Score {analysis.preferredOption.score}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 6 }}>
              {analysis.preferredOption.label}
            </div>
            <ul className="list-compact small-text" style={{ marginTop: 6 }}>
              {analysis.preferredOption.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            {analysis.preferredOption.conditionsToWin.length > 0 ? (
              <div className="small-text" style={{ marginTop: 6 }}>
                <strong>Condições para funcionar:</strong>{' '}
                {analysis.preferredOption.conditionsToWin.join(' ')}
              </div>
            ) : null}
            {analysis.preferredOption.abortConditions.length > 0 ? (
              <div className="small-text muted-text" style={{ marginTop: 4 }}>
                <strong>Quando abortar:</strong> {analysis.preferredOption.abortConditions.join(' ')}
              </div>
            ) : null}
          </div>

          <div className="panel-subtle">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-blue">2ª Opção</span>
              <span className="mono small-text">Score {analysis.secondOption.score}</span>
            </div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{analysis.secondOption.label}</div>
            <ul className="list-compact small-text" style={{ marginTop: 4 }}>
              {analysis.secondOption.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* Observado vs Hipótese vs Desconhecido */}
        <section className="panel">
          <h2 className="panel-title">O que muda a análise &amp; Separação de Evidências</h2>
          <div className="panel-subtle small-text">
            <strong>Informação que mais mudaria a decisão:</strong>
            <div style={{ marginTop: 3 }}>{analysis.mostImpactfulUnknown}</div>
          </div>

          <div className="small-text">
            <strong>Ritmo de farm (CS vs Selva):</strong>{' '}
            <span className="muted-text">{analysis.farmTempoNote}</span>
          </div>

          <div className="panel-subtle small-text">
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, color: 'var(--green)' }}>
              <CheckCircle2 size={13} /> Estado Observado
            </div>
            <ul className="list-compact" style={{ marginTop: 4 }}>
              {analysis.observedFacts.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>

          {analysis.workingHypotheses.length > 0 ? (
            <div className="panel-subtle small-text">
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, color: 'var(--amber)' }}>
                <AlertTriangle size={13} /> Hipóteses de Trabalho
              </div>
              <ul className="list-compact" style={{ marginTop: 4 }}>
                {analysis.workingHypotheses.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.unknownFields.length > 0 ? (
            <div className="panel-subtle small-text">
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, color: 'var(--muted)' }}>
                <HelpCircle size={13} /> Dados Desconhecidos + Decisões Condicionais
              </div>
              <ul className="list-compact" style={{ marginTop: 4 }}>
                {analysis.unknownFields.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
              {analysis.conditionalDecisions.map((cd, i) => (
                <div key={i} style={{ marginTop: 4, color: '#bfdbfe' }}>
                  • {cd}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
      ) : (
        <div className="banner banner-warning">
          Escolha uma das 5 opções acima para revelar a análise completa e os trade-offs.
        </div>
      )}

      {/* Formulário editável do cenário */}
      <div className="panel">
        <h2 className="panel-title">Editar parâmetros do cenário</h2>
        <div className="grid-3">
          <div className="panel-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <strong>1. Meu Estado &amp; Farm (Separado)</strong>
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
                <span>Nível</span>
                <input
                  type="number"
                  className="input"
                  min={1}
                  max={18}
                  value={scenario.level}
                  onChange={(e) => updateField('level', Number(e.target.value) || 1)}
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
                <span>CS de Lane (opcional)</span>
                <input
                  type="number"
                  className="input"
                  placeholder="Desconhecido"
                  value={scenario.laneCs ?? ''}
                  onChange={(e) =>
                    updateField('laneCs', e.target.value === '' ? null : Number(e.target.value))
                  }
                />
              </label>
              <label className="field-label">
                <span>Campos Jungle (opcional)</span>
                <input
                  type="number"
                  className="input"
                  placeholder="Desconhecido"
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
            <div className="grid-2">
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
              <label className="field-label">
                <span>Segundos esperando já perdidos</span>
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
            </div>
          </div>

          <div className="panel-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <strong>2. Objetivo &amp; Pressão das Lanes</strong>
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
                <span>Prio Top</span>
                <select
                  className="select"
                  value={scenario.topPrio}
                  onChange={(e) => updateField('topPrio', e.target.value as LanePrioState)}
                >
                  <option value="ally">Aliada</option>
                  <option value="even">Neutra</option>
                  <option value="enemy">Inimiga</option>
                  <option value="unknown">Desconhecida</option>
                </select>
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
                <span>Lado do mapa</span>
                <select
                  className="select"
                  value={scenario.mapSide}
                  onChange={(e) => updateField('mapSide', e.target.value as MapSide)}
                >
                  <option value="blue_side">Lado Azul</option>
                  <option value="red_side">Lado Vermelho</option>
                </select>
              </label>
            </div>
          </div>

          <div className="panel-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <strong>3. Bot Lane, Setup &amp; Jungler Inimigo</strong>
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
                  <option value="top_side">Visto no Top</option>
                  <option value="bot_side">Visto na Bot</option>
                  <option value="mid_area">Visto no Mid</option>
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
                  <option value="even">Neutra no meio</option>
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
                <span>Suporte aliado baixo?</span>
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
              <label className="field-label">
                <span>Mid move?</span>
                <select
                  className="select"
                  value={scenario.alliesCanMoveMid}
                  onChange={(e) => updateField('alliesCanMoveMid', e.target.value as TriStateBool)}
                >
                  <option value="yes">Sim</option>
                  <option value="no">Não</option>
                  <option value="unknown">Desconhecido</option>
                </select>
              </label>
              <label className="field-label">
                <span>Estado da partida</span>
                <select
                  className="select"
                  value={scenario.gameState}
                  onChange={(e) =>
                    updateField('gameState', e.target.value as TrainingScenario['gameState'])
                  }
                >
                  <option value="ahead">Na frente</option>
                  <option value="even">Equilibrada</option>
                  <option value="behind">Atrás</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>

      <ExpandableSection title="Ver ranking completo das 5 opções avaliadas">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {analysis.rankedOptions.map((opt) => (
            <div key={opt.optionId} className="panel-subtle small-text">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>
                  {opt.label} ({opt.verdict.toUpperCase()})
                </strong>
                <span className="mono">Score: {opt.score}</span>
              </div>
              <div className="muted-text">{opt.reasons.join(' ')}</div>
            </div>
          ))}
        </div>
      </ExpandableSection>
    </div>
  );
}
