import {
  ArrowLeftRight,
  BookmarkPlus,
  ExternalLink,
  Layers,
  Pin,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { DEMO_DRAFTS, createEmptyDraft } from '../../engine/demos';
import {
  analyzeDraft,
  createFrozenCardFromAnalysis,
} from '../../engine/draftAnalyzer';
import type {
  CatalogSnapshot,
  CatalogStatus,
  DraftState,
  FrozenPreGameCard,
  LaneRole,
  TargetLane,
} from '../../shared/types';
import { ChampionPicker } from '../components/ChampionPicker';
import { ExpandableSection } from '../components/ExpandableSection';
import { ConfidenceBadge, FormBadge } from '../components/FormBadge';
import { TacticalMapSvg } from '../components/TacticalMapSvg';

const ROLES: Array<{ role: LaneRole; label: string }> = [
  { role: 'top', label: 'Top' },
  { role: 'jungle', label: 'Jungle' },
  { role: 'mid', label: 'Mid' },
  { role: 'bot', label: 'ADC' },
  { role: 'support', label: 'Suporte' },
];

export function DraftPage({
  draft,
  savedDrafts,
  frozenCard,
  catalog,
  catalogStatus,
  preferBlueAsTiebreaker,
  onChangeDraft,
  onSaveDraft,
  onDeleteDraft,
  onTogglePreferBlue,
  onFreezeCard,
  onOpenCardWindow,
}: {
  draft: DraftState;
  savedDrafts: DraftState[];
  frozenCard: FrozenPreGameCard | null;
  catalog: CatalogSnapshot;
  catalogStatus: CatalogStatus;
  preferBlueAsTiebreaker: boolean;
  onChangeDraft: (next: DraftState) => void;
  onSaveDraft: (draft: DraftState) => void;
  onDeleteDraft: (id: string) => void;
  onTogglePreferBlue: (value: boolean) => void;
  onFreezeCard: (card: FrozenPreGameCard) => Promise<void>;
  onOpenCardWindow: () => Promise<void>;
}) {
  const [freezeNotice, setFreezeNotice] = useState<string | null>(null);
  const [activeSituationalKey, setActiveSituationalKey] = useState<string>('all_active');

  const analysis = useMemo(
    () => analyzeDraft(draft, catalog, { preferBlueAsTiebreaker }),
    [draft, catalog, preferBlueAsTiebreaker],
  );

  const updateSlot = (side: 'allies' | 'enemies', role: LaneRole, champId: string | null) => {
    onChangeDraft({
      ...draft,
      [side]: {
        ...draft[side],
        [role]: champId,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const swapWithNextRole = (side: 'allies' | 'enemies', roleIndex: number) => {
    const r1 = ROLES[roleIndex].role;
    const r2 = ROLES[(roleIndex + 1) % ROLES.length].role;
    // Evita tirar o Kayn da jungle aliada acidentalmente sem necessidade
    if (side === 'allies' && (r1 === 'jungle' || r2 === 'jungle')) {
      const target = ROLES[(roleIndex + 2) % ROLES.length].role;
      const sideObj = draft[side];
      onChangeDraft({
        ...draft,
        [side]: {
          ...sideObj,
          [r1]: sideObj[target],
          [target]: sideObj[r1],
        },
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    const sideObj = draft[side];
    onChangeDraft({
      ...draft,
      [side]: {
        ...sideObj,
        [r1]: sideObj[r2],
        [r2]: sideObj[r1],
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleFreeze = async () => {
    const card = createFrozenCardFromAnalysis(draft, analysis);
    await onFreezeCard(card);
    setFreezeNotice(
      `Plano pré-jogo congelado às ${new Date(card.frozenAt).toLocaleTimeString('pt-BR')}! Não muda durante a partida.`,
    );
  };

  const shownSituational = analysis.build.situational.filter((s) =>
    activeSituationalKey === 'all_active' ? s.activeInDraft : s.key === activeSituationalKey,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Barra rápida para champion select */}
      <div className="toolbar">
        <div className="toolbar-group">
          <span className="small-text muted-text" style={{ fontWeight: 700 }}>
            Demos Diamante:
          </span>
          <button
            type="button"
            data-testid="demo-blue"
            className="btn btn-blue btn-xs"
            onClick={() => onChangeDraft({ ...DEMO_DRAFTS.blue })}
          >
            Demo Azul
          </button>
          <button
            type="button"
            data-testid="demo-red"
            className="btn btn-red btn-xs"
            onClick={() => onChangeDraft({ ...DEMO_DRAFTS.red })}
          >
            Demo Rhaast
          </button>
          <button
            type="button"
            data-testid="demo-balanced"
            className="btn btn-amber btn-xs"
            onClick={() => onChangeDraft({ ...DEMO_DRAFTS.balanced })}
          >
            Demo Equilibrado
          </button>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => onChangeDraft(createEmptyDraft())}
          >
            <RotateCcw size={12} /> Limpar draft
          </button>
        </div>

        <div className="toolbar-group">
          <label className="switch-row" title="Usado só em drafts equilibrados — nunca mascara um Rhaast claro">
            <input
              type="checkbox"
              checked={preferBlueAsTiebreaker}
              onChange={(e) => onTogglePreferBlue(e.target.checked)}
            />
            <span>Preferência Azul (só desempate)</span>
          </label>

          <button
            type="button"
            data-testid="freeze-card-btn"
            className="btn btn-primary"
            onClick={() => void handleFreeze()}
          >
            <Pin size={14} /> Salvar plano pré-jogo
          </button>
          <button
            type="button"
            data-testid="open-card-btn"
            className="btn"
            onClick={() => void onOpenCardWindow()}
          >
            <ExternalLink size={14} /> Abrir cartão
          </button>
        </div>
      </div>

      {/* Status de patch e notificações */}
      {catalogStatus.validation.patchMismatch || catalogStatus.lastError ? (
        <div className="banner banner-warning">
          <span>
            <strong>Aviso de versão:</strong> Catálogo ativo Data Dragon{' '}
            <span className="mono">{catalog.patch}</span> | Recomendações validadas em{' '}
            <span className="mono">{analysis.meta.buildVersion}</span> (patch{' '}
            <span className="mono">{analysis.build.validatedPatch}</span>).
            {catalogStatus.lastError ? ` ${catalogStatus.lastError}` : ''}
          </span>
        </div>
      ) : (
        <div className="banner">
          <span className="small-text muted-text">
            Catálogo <span className="mono">Data Dragon {catalog.patch} (pt_BR, Summoner&apos;s Rift)</span> —{' '}
            {catalogStatus.sourceMode === 'bundled_offline'
              ? 'Snapshot offline embutido'
              : catalogStatus.sourceMode === 'local_cache'
                ? 'Cache local validado'
                : 'Atualizado da rede'}
            . Perfis táticos <span className="mono">{analysis.meta.tacticalVersion}</span>.
          </span>
          {frozenCard ? (
            <span className="badge badge-green">
              Cartão congelado ({new Date(frozenCard.frozenAt).toLocaleTimeString('pt-BR')})
            </span>
          ) : (
            <span className="badge badge-muted">Nenhum cartão congelado ainda</span>
          )}
        </div>
      )}

      {freezeNotice ? (
        <div className="banner banner-success">
          <span>{freezeNotice}</span>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => void onOpenCardWindow()}
          >
            Ver cartão agora
          </button>
        </div>
      ) : null}

      {/* 4 RESPOSTAS NO TOPO PARA LEITURA RÁPIDA */}
      <div className="grid-4">
        {/* 1. FORMA */}
        <section className="panel" aria-label="Forma recomendada">
          <div className="panel-header">
            <h2 className="panel-title">1. Forma</h2>
            <ConfidenceBadge level={analysis.confidence.level} />
          </div>
          <div data-testid="recommended-form-label">
            <FormBadge
              form={analysis.recommendedForm}
              label={analysis.recommendedFormLabel}
            />
          </div>
          <div className="small-text">
            <strong>Alternativa:</strong> {analysis.alternativeFormLabel}
          </div>
          {analysis.tiebreakerBlockedReason ? (
            <div className="small-text" style={{ color: '#fca5a5' }}>
              {analysis.tiebreakerBlockedReason}
            </div>
          ) : null}
          <div className="small-text muted-text">
            <strong>O que inverte:</strong> {analysis.flipCondition}
          </div>
          <ul className="list-compact small-text">
            {analysis.shortReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <div className="small-text muted-text" style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
            <strong>Motivo da confiança:</strong> {analysis.confidence.reason}
          </div>
        </section>

        {/* 2. RUNAS */}
        <section className="panel" aria-label="Runas recomendadas">
          <div className="panel-header">
            <h2 className="panel-title">2. Runas</h2>
            <span className="badge badge-muted">Patch {analysis.runes.validatedPatch}</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{analysis.runes.formLabel}</div>
          <div className="panel-subtle small-text">
            <div>
              <strong>{analysis.runes.primaryTreeName}:</strong>{' '}
              {analysis.runes.primaryRunes.map((r) => r.name).join(' → ')}
            </div>
            <div style={{ marginTop: 4 }}>
              <strong>{analysis.runes.secondaryTreeName}:</strong>{' '}
              {analysis.runes.secondaryRunes.map((r) => r.name).join(' + ')}
            </div>
            <div style={{ marginTop: 4 }} className="muted-text">
              <strong>Fragmentos:</strong> {analysis.runes.statShards.join(' / ')}
            </div>
          </div>
          <div className="small-text muted-text">
            <strong>Por que difere:</strong> {analysis.runes.whyFormDiffers}
          </div>
        </section>

        {/* 3. BUILD */}
        <section className="panel" aria-label="Build recomendada">
          <div className="panel-header">
            <h2 className="panel-title">3. Build (SR)</h2>
            <span className="badge badge-muted">Patch {analysis.build.validatedPatch}</span>
          </div>
          <div className="small-text">
            <strong>Pet:</strong> {analysis.build.junglePet.name}
          </div>
          <div className="small-text">
            <strong>Bota:</strong> {analysis.build.boots.map((b) => b.name).join(' / ')}
          </div>
          <div className="panel-subtle small-text">
            <strong>Núcleo (Core):</strong>
            <ul className="list-compact" style={{ marginTop: 4 }}>
              {analysis.build.core.map((c) => (
                <li key={c.id}>
                  <strong>{c.name}</strong> ({c.gold}g) — <span className="muted-text">{c.reason}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="small-text">
            <label className="field-label">
              <span>Situacionais por ameaça:</span>
              <select
                className="select"
                value={activeSituationalKey}
                onChange={(e) => setActiveSituationalKey(e.target.value)}
              >
                <option value="all_active">Ativos neste draft</option>
                {analysis.build.situational.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label} {s.activeInDraft ? '(Recomendado)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {shownSituational.length === 0 ? (
                <span className="muted-text">Nenhum situacional crítico disparado; selecione uma categoria acima para ver opções.</span>
              ) : (
                shownSituational.map((cat) => (
                  <div key={cat.key} className="panel-subtle">
                    <div style={{ fontWeight: 700 }}>{cat.label}</div>
                    <div className="muted-text">{cat.triggerReason}</div>
                    <div>
                      <strong>Itens:</strong> {cat.items.map((i) => i.name).join(' • ')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* 4. LANES */}
        <section className="panel" aria-label="Comparação das Lanes">
          <div className="panel-header">
            <h2 className="panel-title">4. Lanes &amp; Farm</h2>
            <span className="badge badge-muted">Potencial do draft</span>
          </div>
          <div className="panel-subtle small-text" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>
              <strong>1ª janela de gank:</strong>{' '}
              <span className="badge badge-blue">
                {analysis.lanes.firstGankWindow === 'farm_first'
                  ? 'Farm primeiro (sem janela segura)'
                  : analysis.lanes.firstGankWindow.toUpperCase()}
              </span>
            </div>
            <div className="muted-text">{analysis.lanes.firstGankWindowReason}</div>
            <div style={{ marginTop: 4 }}>
              <strong>Melhor lane para jogar em torno:</strong>{' '}
              <span className="badge badge-green">
                {analysis.lanes.bestPlayAroundLane.toUpperCase()}
              </span>
            </div>
            <div className="muted-text">{analysis.lanes.bestPlayAroundReason}</div>
          </div>
          <div className="small-text">
            <strong>Rota de farm se não houver janela:</strong>{' '}
            <span className="muted-text">{analysis.lanes.fallbackFarmPath}</span>
          </div>
        </section>
      </div>

      {/* COMPARAÇÃO DETALHADA TOP / MID / BOT (2 FRASES CURTAS POR LANE) */}
      <div className="grid-3">
        {(['top', 'mid', 'bot'] as TargetLane[]).map((lane) => {
          const info = analysis.lanes.perLane[lane];
          return (
            <div key={lane} className="panel">
              <div className="panel-header">
                <strong>Rota {info.label}</strong>
                <span className="badge badge-muted">
                  Contragank: {info.countergankRisk} | Conversão: {info.conversionPotential}
                </span>
              </div>
              <div className="small-text">
                <strong>Quando entrar:</strong> {info.favorableConditionSentence}
              </div>
              <div className="small-text muted-text">
                <strong>Quando seguir farm:</strong> {info.fallbackConditionSentence}
              </div>
            </div>
          );
        })}
      </div>

      {/* SELEÇÃO RÁPIDA 5v5 (COM TROCA DE POSIÇÃO FLEX E BUSCA POR TECLADO) */}
      <div className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Seu Time (Aliados)</h2>
            <span className="small-text muted-text">Kayn preenchido na Jungle</span>
          </div>
          {ROLES.map((item, idx) => (
            <div key={item.role} className="draft-slot-row">
              <span style={{ fontWeight: 700, fontSize: 12.5 }}>{item.label}</span>
              <ChampionPicker
                value={draft.allies[item.role]}
                catalog={catalog}
                disabled={item.role === 'jungle'}
                ariaLabel={`Aliado ${item.label}`}
                placeholder={item.role === 'jungle' ? 'Kayn' : 'Espaço vazio (opcional)'}
                onChange={(id) => updateSlot('allies', item.role, id)}
              />
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                title="Trocar posição (flex pick)"
                disabled={item.role === 'jungle'}
                onClick={() => swapWithNextRole('allies', idx)}
              >
                <ArrowLeftRight size={12} />
              </button>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Time Adversário (Inimigos)</h2>
            <span className="small-text muted-text">Use setas/Enter ou troque se houver flex</span>
          </div>
          {ROLES.map((item, idx) => (
            <div key={item.role} className="draft-slot-row">
              <span style={{ fontWeight: 700, fontSize: 12.5 }}>{item.label}</span>
              <ChampionPicker
                value={draft.enemies[item.role]}
                catalog={catalog}
                ariaLabel={`Inimigo ${item.label}`}
                placeholder="Digite o campeão inimigo..."
                onChange={(id) => updateSlot('enemies', item.role, id)}
              />
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                title="Trocar posição com a linha abaixo (flex pick)"
                onClick={() => swapWithNextRole('enemies', idx)}
              >
                <ArrowLeftRight size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* NOTAS PRÉ-JOGO E EXPANSÕES TÉCNICAS */}
      <div className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Notas do Plano Pré-Jogo &amp; Rascunhos</h2>
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => onSaveDraft(draft)}
            >
              <BookmarkPlus size={12} /> Salvar draft na lista
            </button>
          </div>
          <label className="field-label">
            <span>Nome do plano / draft</span>
            <input
              type="text"
              className="input"
              value={draft.name}
              onChange={(e) =>
                onChangeDraft({ ...draft, name: e.target.value, updatedAt: new Date().toISOString() })
              }
            />
          </label>
          <label className="field-label">
            <span>Lembretes estáticos para congelar no cartão</span>
            <textarea
              className="textarea"
              placeholder="Ex.: Não forçar Bot contra Ezreal + Lulu sem Flash do suporte; respeitar invade nível 3."
              value={draft.staticNotes}
              onChange={(e) =>
                onChangeDraft({
                  ...draft,
                  staticNotes: e.target.value,
                  updatedAt: new Date().toISOString(),
                })
              }
            />
          </label>
          <div className="small-text muted-text">
            <strong>Rascunhos locais ({savedDrafts.length}):</strong>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {savedDrafts.map((sd) => (
              <div key={sd.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={() => onChangeDraft({ ...sd })}
                >
                  <Layers size={11} /> {sd.name}
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  aria-label={`Excluir draft ${sd.name}`}
                  onClick={() => onDeleteDraft(sd.id)}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2 className="panel-title">Mapa Esquemático Estático (Pré-Jogo)</h2>
          <TacticalMapSvg
            focusSide={analysis.lanes.bestPlayAroundLane}
            suggestedStart={
              analysis.lanes.bestPlayAroundLane === 'top'
                ? 'Full clear Bot -> Top'
                : analysis.lanes.bestPlayAroundLane === 'bot'
                  ? 'Full clear Top -> Bot (só entrar Bot se houver setup)'
                  : 'Full clear avaliando Mid na travessia'
            }
          />
        </div>
      </div>

      {/* DETALHES E PESOS EM EXPANSÃO */}
      <ExpandableSection
        title="Ver pesos internos, mecânica de orbes e lacunas do draft"
        badge={`Azul ${analysis.scores.blueScore} vs Rhaast ${analysis.scores.redScore}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="small-text">
            <strong>Forma mais forte na comp:</strong>{' '}
            {analysis.strongestForm === 'blue'
              ? 'Kayn Azul'
              : analysis.strongestForm === 'red'
                ? 'Rhaast'
                : 'Equilibrada'}{' '}
            | <strong>Forma mais fácil de desbloquear primeiro:</strong>{' '}
            {analysis.easiestUnlockForm === 'blue'
              ? 'Kayn Azul'
              : analysis.easiestUnlockForm === 'red'
                ? 'Rhaast'
                : 'Equilibrada'}
          </div>
          <div className="small-text muted-text">
            <strong>Mecânica oficial A Foice Darkin:</strong> {analysis.orbSummary.earlyAccessNote}
          </div>
          {analysis.missingDraftGaps.length > 0 ? (
            <div className="small-text">
              <strong>Falta no draft:</strong> {analysis.missingDraftGaps.join(' ')}
            </div>
          ) : null}
          {analysis.flexAmbiguityNotes.length > 0 ? (
            <div className="small-text">
              <strong>Possíveis flex picks:</strong> {analysis.flexAmbiguityNotes.join(' ')}
            </div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {analysis.detailedWeights.map((w) => (
              <div key={w.label} className="panel-subtle small-text">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{w.label}</strong>
                  <span className="mono">
                    Azul +{w.blueImpact} / Rhaast +{w.redImpact}
                  </span>
                </div>
                <div className="muted-text">{w.explanation}</div>
              </div>
            ))}
          </div>
          <div className="small-text muted-text">
            Nota: essas pontuações servem exclusivamente para ordenar alternativas de forma determinística e transparente — não representam probabilidade de vitória.
          </div>
        </div>
      </ExpandableSection>
    </div>
  );
}
