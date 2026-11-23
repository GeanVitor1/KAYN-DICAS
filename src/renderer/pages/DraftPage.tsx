import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Coins,
  ExternalLink,
  HelpCircle,
  Layers,
  Pin,
  Radio,
  RotateCcw,
  Sparkles,
  Swords,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { DEMO_DRAFTS, createEmptyDraft } from '../../engine/demos';
import {
  analyzeDraft,
  createFrozenCardFromAnalysis,
  getShortFormReason,
} from '../../engine/draftAnalyzer';
import {
  computeNextBuildStep,
  formatGameClock,
} from '../../engine/liveLolParser';
import { selectPreGameReminders } from '../../engine/tacticalMemory';
import type {
  CatalogSnapshot,
  DraftState,
  FrozenMicroComboCard,
  FrozenPreGameCard,
  LaneRole,
  LiveLolStatus,
  TacticalRule,
  TargetLane,
} from '../../shared/types';
import { getKaynSplashUrl } from '../assetUrls';
import { ChampionPortraitSlot } from '../components/ChampionPicker';
import { ExpandableSection } from '../components/ExpandableSection';
import { ConfidenceBadge } from '../components/FormBadge';
import { ItemIconTile, RuneIconTile } from '../components/GameIcon';
import { TacticalMapSvg } from '../components/TacticalMapSvg';

const ROLES: Array<{ role: LaneRole; short: string; label: string }> = [
  { role: 'top', short: 'TOP', label: 'Top' },
  { role: 'jungle', short: 'JG', label: 'Jungle' },
  { role: 'mid', short: 'MID', label: 'Mid' },
  { role: 'bot', short: 'ADC', label: 'ADC' },
  { role: 'support', short: 'SUP', label: 'Suporte' },
];

const LANE_SHORT: Record<TargetLane, string> = {
  top: 'Top',
  mid: 'Mid',
  bot: 'Bot',
};

const THREAT_LABEL: Record<string, string> = {
  armor: 'Armadura',
  healing: 'Cura',
  shields: 'Escudo',
  defensive: 'Defesa',
};

export function DraftPage({
  draft,
  savedDrafts,
  frozenCard,
  liveLolStatus,
  pinnedMicroCards,
  tacticalRules,
  pinnedReminderIds,
  tacticalRuleNotes,
  catalog,
  preferBlueAsTiebreaker,
  onChangeDraft,
  onSaveDraft,
  onDeleteDraft,
  onTogglePreferBlue,
  onTogglePinnedReminder,
  onFreezeCard,
  onOpenCardWindow,
  onRefreshLiveLol,
}: {
  draft: DraftState;
  savedDrafts: DraftState[];
  frozenCard: FrozenPreGameCard | null;
  liveLolStatus?: LiveLolStatus | null;
  pinnedMicroCards: FrozenMicroComboCard[];
  tacticalRules: TacticalRule[];
  pinnedReminderIds: string[];
  tacticalRuleNotes: Record<string, string>;
  catalog: CatalogSnapshot;
  preferBlueAsTiebreaker: boolean;
  onChangeDraft: (next: DraftState) => void;
  onSaveDraft: (draft: DraftState) => void;
  onDeleteDraft: (id: string) => void;
  onTogglePreferBlue: (value: boolean) => void;
  onTogglePinnedReminder: (ruleId: string) => Promise<void>;
  onFreezeCard: (card: FrozenPreGameCard) => Promise<void>;
  onOpenCardWindow: () => Promise<void>;
  onRefreshLiveLol?: () => Promise<void>;
}) {
  const [freezeNotice, setFreezeNotice] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [showSituational, setShowSituational] = useState(false);
  const [splashFailed, setSplashFailed] = useState(false);
  const [manualOverrideDuringLive, setManualOverrideDuringLive] = useState(false);

  const hasLiveDraft = Boolean(
    liveLolStatus &&
      (liveLolStatus.phase === 'champ_select' || liveLolStatus.phase === 'in_game') &&
      liveLolStatus.liveDraft,
  );
  const isLiveActive = hasLiveDraft && !manualOverrideDuringLive;
  const liveMatch = isLiveActive && liveLolStatus?.phase === 'in_game' ? liveLolStatus.liveMatch : null;

  const effectiveDraft: DraftState = useMemo(() => {
    if (isLiveActive && liveLolStatus?.liveDraft) {
      return {
        ...draft,
        id: liveLolStatus.phase === 'in_game' ? 'live-in-game' : 'live-champ-select',
        name:
          liveLolStatus.phase === 'in_game'
            ? 'Partida ao vivo (LoL)'
            : 'Seleção de Campeões ao vivo',
        allies: liveLolStatus.liveDraft.allies,
        enemies: liveLolStatus.liveDraft.enemies,
      };
    }
    return draft;
  }, [draft, isLiveActive, liveLolStatus]);

  const analysis = useMemo(
    () => analyzeDraft(effectiveDraft, catalog, { preferBlueAsTiebreaker }),
    [effectiveDraft, catalog, preferBlueAsTiebreaker],
  );

  const nextBuildStep = useMemo(
    () =>
      liveMatch
        ? computeNextBuildStep(analysis.build, liveMatch.ownedItemIds, liveMatch.currentGold)
        : null,
    [analysis.build, liveMatch],
  );

  const ownedItemSet = useMemo(
    () => new Set(liveMatch?.ownedItemIds ?? []),
    [liveMatch],
  );

  const preGameReminders = useMemo(
    () =>
      selectPreGameReminders(
        analysis,
        tacticalRules,
        pinnedReminderIds,
        tacticalRuleNotes,
        effectiveDraft.staticNotes,
      ),
    [analysis, tacticalRules, pinnedReminderIds, tacticalRuleNotes, effectiveDraft.staticNotes],
  );

  const shortReason = useMemo(() => getShortFormReason(analysis), [analysis]);

  const updateSlot = (side: 'allies' | 'enemies', role: LaneRole, champId: string | null) => {
    if (hasLiveDraft) setManualOverrideDuringLive(true);
    onChangeDraft({
      ...effectiveDraft,
      [side]: {
        ...effectiveDraft[side],
        [role]: champId,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const swapWithNextRole = (side: 'allies' | 'enemies', roleIndex: number) => {
    if (hasLiveDraft) setManualOverrideDuringLive(true);
    const r1 = ROLES[roleIndex].role;
    const r2 = ROLES[(roleIndex + 1) % ROLES.length].role;
    if (side === 'allies' && (r1 === 'jungle' || r2 === 'jungle')) {
      const target = ROLES[(roleIndex + 2) % ROLES.length].role;
      const sideObj = effectiveDraft[side];
      onChangeDraft({
        ...effectiveDraft,
        [side]: {
          ...sideObj,
          [r1]: sideObj[target],
          [target]: sideObj[r1],
        },
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    const sideObj = effectiveDraft[side];
    onChangeDraft({
      ...effectiveDraft,
      [side]: {
        ...sideObj,
        [r1]: sideObj[r2],
        [r2]: sideObj[r1],
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const loadManualDemo = (next: DraftState) => {
    if (hasLiveDraft) setManualOverrideDuringLive(true);
    onChangeDraft(next);
  };

  const handleFreeze = async () => {
    const card = createFrozenCardFromAnalysis(
      effectiveDraft,
      analysis,
      pinnedMicroCards,
      preGameReminders.slice(0, 2).map((r) => ({
        ruleId: r.ruleId,
        text: r.text,
        watchCondition: r.watchCondition,
      })),
    );
    await onFreezeCard(card);
    setFreezeNotice(
      `Plano salvo às ${new Date(card.frozenAt).toLocaleTimeString('pt-BR')}.`,
    );
  };

  const formTitle =
    analysis.recommendedForm === 'blue'
      ? 'Kayn Azul'
      : analysis.recommendedForm === 'red'
        ? 'Rhaast'
        : 'Indefinido';

  const heroClass =
    analysis.recommendedForm === 'blue'
      ? 'form-hero-blue'
      : analysis.recommendedForm === 'red'
        ? 'form-hero-red'
        : 'form-hero-open';

  const keystoneAccent: 'gold' | 'blue' | 'red' =
    analysis.recommendedForm === 'blue' ? 'blue' : 'gold';

  const keystone = analysis.runes.primaryRunes[0];
  const primaryMinors = analysis.runes.primaryRunes.slice(1);
  const activeSituationals = analysis.build.situational.filter((s) => s.activeInDraft);
  const splashUrl = getKaynSplashUrl(catalog.patch);

  const firstWindowLabel =
    analysis.lanes.firstGankWindow === 'farm_first'
      ? 'Farm primeiro'
      : `Observar ${LANE_SHORT[analysis.lanes.firstGankWindow]}`;

  const firstWindowShortNote =
    analysis.lanes.firstGankWindow === 'farm_first'
      ? 'Sem janela limpa no início — complete o clear antes de forçar.'
      : analysis.lanes.perLane[analysis.lanes.firstGankWindow].favorableConditionSentence;

  const shortFarmAlt =
    analysis.lanes.bestPlayAroundLane === 'top'
      ? 'Full clear Bot → Top; sem abertura, Aronguejo ou reset.'
      : analysis.lanes.bestPlayAroundLane === 'bot'
        ? 'Full clear Top → Bot; sem setup na Bot, volte aos campos.'
        : 'Full clear avaliando Mid na travessia; resete no pico de ouro.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {/* Barra compacta superior: Status ao vivo do LoL + Simular offline + Ações */}
      <div className="toolbar">
        <div className="toolbar-group">
          {isLiveActive ? (
            <span
              data-testid="draft-live-badge"
              className={`badge ${liveLolStatus?.phase === 'in_game' ? 'badge-green' : 'badge-blue'}`}
            >
              <Radio size={11} />
              {liveLolStatus?.phase === 'in_game'
                ? `LoL em partida · ${formatGameClock(liveMatch?.gameTimeSeconds ?? 0)}`
                : 'Seleção de Campeões ao vivo (LCU)'}
            </span>
          ) : hasLiveDraft ? (
            <button
              type="button"
              className="btn btn-xs btn-blue"
              onClick={() => setManualOverrideDuringLive(false)}
            >
              <Radio size={12} /> Voltar ao LoL ao vivo
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-xs"
              title="Procurar Seleção de Campeões ou Partida ativa no League of Legends"
              onClick={() => void onRefreshLiveLol?.()}
            >
              <Radio size={12} color="var(--muted)" />
              {liveLolStatus?.phase === 'client_idle'
                ? 'LoL aberto (entre na Seleção)'
                : 'Detectar LoL'}
            </button>
          )}

          <span className="small-text muted-text" style={{ marginLeft: 4 }}>
            Simular:
          </span>
          <button
            type="button"
            data-testid="demo-blue"
            className="btn btn-blue btn-xs"
            onClick={() => loadManualDemo({ ...DEMO_DRAFTS.blue })}
          >
            Azul
          </button>
          <button
            type="button"
            data-testid="demo-red"
            className="btn btn-red btn-xs"
            onClick={() => loadManualDemo({ ...DEMO_DRAFTS.red })}
          >
            Rhaast
          </button>
          <button
            type="button"
            data-testid="demo-balanced"
            className="btn btn-amber btn-xs"
            onClick={() => loadManualDemo({ ...DEMO_DRAFTS.balanced })}
          >
            Equilibrado
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            title="Limpar draft manual"
            onClick={() => loadManualDemo(createEmptyDraft())}
          >
            <RotateCcw size={12} />
          </button>
          <label
            className="switch-row"
            style={{ marginLeft: 2, fontSize: 12 }}
            title="Usado apenas como desempate em drafts equilibrados — nunca mascara um Rhaast claro"
          >
            <input
              type="checkbox"
              checked={preferBlueAsTiebreaker}
              onChange={(e) => onTogglePreferBlue(e.target.checked)}
            />
            <span className="muted-text">Desempate Azul</span>
          </label>
        </div>

        <div className="toolbar-group">
          {freezeNotice ? (
            <span className="badge badge-green">{freezeNotice}</span>
          ) : frozenCard && !isLiveActive ? (
            <span className="badge badge-muted">
              Plano salvo · {new Date(frozenCard.frozenAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}

          <button
            type="button"
            data-testid="freeze-card-btn"
            className="btn btn-primary btn-xs"
            style={{ padding: '6px 12px', fontSize: 12.5 }}
            onClick={() => void handleFreeze()}
          >
            <Pin size={13} /> Salvar plano pré-jogo
          </button>
          <button
            type="button"
            data-testid="open-card-btn"
            className="btn btn-xs"
            style={{ padding: '6px 11px', fontSize: 12.5 }}
            onClick={() => void onOpenCardWindow()}
          >
            <ExternalLink size={13} /> Cartão
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL 2 COLUNAS (CABE EM 1200×780 SEM ROLAGEM) */}
      <div className="draft-main-grid">
        {/* COLUNA ESQUERDA: COMPOSIÇÕES + FORMA RECOMENDADA */}
        <section className="draft-left-col" aria-label="Composições e forma recomendada">
          {/* Aliados */}
          <div className="champ-team-strip">
            <div className="team-bar team-bar-ally" aria-hidden="true" />
            <div className="champ-slots-grid">
              {ROLES.map((item, idx) => (
                <ChampionPortraitSlot
                  key={`ally-${item.role}`}
                  value={effectiveDraft.allies[item.role]}
                  roleLabel={item.short}
                  side="ally"
                  catalog={catalog}
                  disabled={!isLiveActive && item.role === 'jungle'}
                  ariaLabel={`Aliado ${item.label}`}
                  onChange={(id) => updateSlot('allies', item.role, id)}
                  onSwapNext={
                    !isLiveActive && item.role === 'jungle'
                      ? undefined
                      : () => swapWithNextRole('allies', idx)
                  }
                />
              ))}
            </div>
          </div>

          {/* Inimigos */}
          <div className="champ-team-strip">
            <div className="team-bar team-bar-enemy" aria-hidden="true" />
            <div className="champ-slots-grid">
              {ROLES.map((item, idx) => (
                <ChampionPortraitSlot
                  key={`enemy-${item.role}`}
                  value={effectiveDraft.enemies[item.role]}
                  roleLabel={item.short}
                  side="enemy"
                  catalog={catalog}
                  ariaLabel={`Inimigo ${item.label}`}
                  onChange={(id) => updateSlot('enemies', item.role, id)}
                  onSwapNext={() => swapWithNextRole('enemies', idx)}
                />
              ))}
            </div>
          </div>

          {analysis.missingDraftGaps.length > 0 ? (
            <div className="small-text muted-text" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={13} color="var(--amber)" />
              <span>{analysis.missingDraftGaps[0]}</span>
            </div>
          ) : null}

          {/* Hero Card da Forma Recomendada */}
          <div className={`form-hero-card ${heroClass}`}>
            {splashUrl && !splashFailed ? (
              <img
                src={splashUrl}
                alt=""
                aria-hidden="true"
                className="form-hero-art"
                onError={() => setSplashFailed(true)}
              />
            ) : null}

            <div className="form-hero-body">
              <div className="form-hero-kicker">
                <span>
                  {isLiveActive
                    ? liveLolStatus?.phase === 'in_game'
                      ? 'Partida ao vivo'
                      : 'Seleção ao vivo'
                    : 'Recomendação'}
                </span>
                <ConfidenceBadge level={analysis.confidence.level} />
              </div>

              <div className="form-hero-title" data-testid="recommended-form-label">
                {formTitle}
              </div>

              <div className="form-hero-sub">
                <Swords size={14} />
                <span>{shortReason}</span>
              </div>

              <div className="form-hero-actions">
                <span className="small-text" style={{ color: 'rgba(226, 232, 240, 0.8)' }}>
                  Alt: {analysis.alternativeForm === 'blue' ? 'Kayn Azul' : 'Rhaast'}
                </span>
                <button
                  type="button"
                  data-testid="why-form-btn"
                  className="btn btn-xs"
                  style={{ background: 'rgba(9, 14, 24, 0.72)' }}
                  onClick={() => setShowWhy((v) => !v)}
                >
                  <HelpCircle size={12} /> Por quê? {showWhy ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* COLUNA DIREITA: RUNAS VISUAIS + TELEMETRIA AO VIVO (SE EM PARTIDA) + BUILD VISUAL */}
        <section className="draft-right-col" aria-label="Runas e build recomendadas">
          {/* TELEMETRIA REAL EM PARTIDA (SÓ QUANDO EM JOGO) */}
          {liveMatch ? (
            <div className="live-telemetry-bar" data-testid="live-match-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge badge-green mono">{formatGameClock(liveMatch.gameTimeSeconds)}</span>
                <span className="small-text">
                  <strong>Nv {liveMatch.level}</strong> · {liveMatch.kills}/{liveMatch.deaths}/{liveMatch.assists} · {liveMatch.totalCreepScore} CS (HUD)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Coins size={13} color="var(--amber)" />
                <strong className="small-text mono" style={{ color: '#fde68a' }}>
                  {liveMatch.currentGold}g
                </strong>
                {nextBuildStep?.nextItem ? (
                  <span className="small-text muted-text">
                    {nextBuildStep.canAffordNow
                      ? `· fecha ${nextBuildStep.nextItem.name}!`
                      : `· faltam ${nextBuildStep.goldNeeded}g p/ ${nextBuildStep.nextItem.name}`}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* RUNAS */}
          <div className="rune-section-block" data-testid="draft-runes-section">
            <div className="panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <h2 className="panel-title">Runa</h2>
                {analysis.runes.summonerSpells && analysis.runes.summonerSpells.length > 0 ? (
                  <span
                    className={`badge ${analysis.recommendedForm === 'blue' ? 'badge-blue' : 'badge-muted'}`}
                    title={analysis.runes.summonerSpellsNote}
                    data-testid="summoner-spells-badge"
                  >
                    {analysis.runes.summonerSpells.join(' + ')}
                  </span>
                ) : null}
              </div>
              {analysis.runes.hasInvalidRunes ? (
                <span className="badge badge-amber">
                  <AlertTriangle size={11} /> Revisão necessária
                </span>
              ) : (
                <span className="small-text muted-text" data-testid="runes-tree-summary">
                  {analysis.runes.primaryTreeName} + {analysis.runes.secondaryTreeName}
                  {analysis.runes.variantLabel ? ` · ${analysis.runes.variantLabel}` : ''}
                </span>
              )}
            </div>

            <div className="rune-visual-board">
              <div className="rune-keystone-col">
                <RuneIconTile
                  patch={catalog.patch}
                  iconPath={keystone.icon}
                  name={keystone.name}
                  subLabel={analysis.runes.primaryTreeName}
                  size={68}
                  variant="keystone"
                  accent={keystoneAccent}
                  invalid={!keystone.validInCatalog}
                />
                <div className="rune-keystone-name" data-testid="keystone-name">
                  {keystone.validInCatalog ? keystone.name : 'Revisão necessária'}
                </div>
                <span className="rune-tree-caption">
                  {analysis.runes.primaryTreeName}
                </span>
              </div>

              <div className="rune-divider" aria-hidden="true" />

              <div className="rune-rows-col">
                <div className="rune-row-line" aria-label="Runas da árvore principal">
                  <span className="rune-row-tag">Principal</span>
                  {primaryMinors.map((rune) => (
                    <RuneIconTile
                      key={rune.id}
                      patch={catalog.patch}
                      iconPath={rune.icon}
                      name={rune.name}
                      subLabel={analysis.runes.primaryTreeName}
                      size={40}
                      variant="minor"
                      invalid={!rune.validInCatalog}
                    />
                  ))}
                </div>

                <div className="rune-row-line" aria-label="Runas da árvore secundária">
                  <span className="rune-row-tag">Secundária</span>
                  {analysis.runes.secondaryTreeIcon ? (
                    <RuneIconTile
                      patch={catalog.patch}
                      iconPath={analysis.runes.secondaryTreeIcon}
                      name={analysis.runes.secondaryTreeName}
                      subLabel="Árvore secundária"
                      size={26}
                      variant="tree"
                    />
                  ) : null}
                  {analysis.runes.secondaryRunes.map((rune) => (
                    <RuneIconTile
                      key={rune.id}
                      patch={catalog.patch}
                      iconPath={rune.icon}
                      name={rune.name}
                      subLabel={analysis.runes.secondaryTreeName}
                      size={36}
                      variant="secondary"
                      invalid={!rune.validInCatalog}
                    />
                  ))}
                </div>

                <div className="rune-row-line" aria-label="Fragmentos de atributos">
                  <span className="rune-row-tag">Fragmentos</span>
                  {analysis.runes.statShardRefs.map((shard, idx) => (
                    <RuneIconTile
                      key={`${shard.id}-${idx}`}
                      patch={catalog.patch}
                      iconPath={shard.icon}
                      name={shard.name}
                      subLabel={shard.shortLabel}
                      size={28}
                      variant="shard"
                      invalid={!shard.validInCatalog}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* BUILD */}
          <div className="build-section-block" data-testid="draft-build-section">
            <div className="panel-header">
              <h2 className="panel-title">Build</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {analysis.build.hasInvalidItems ? (
                  <span className="badge badge-amber">
                    <AlertTriangle size={11} /> Revisão necessária
                  </span>
                ) : null}
                <button
                  type="button"
                  data-testid="toggle-situational-btn"
                  className="btn btn-xs btn-ghost"
                  onClick={() => setShowSituational((v) => !v)}
                >
                  Situacionais ({activeSituationals.length})
                  {showSituational ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>
            </div>

            {/* Núcleo em ordem visual (com check nos itens já comprados em partida!) */}
            <div className="build-core-row" aria-label="Núcleo da build em ordem">
              {analysis.build.core.map((item, idx) => {
                const isOwned = ownedItemSet.has(item.id);
                const isNext = nextBuildStep?.nextItem?.id === item.id;
                const tileSize = analysis.build.core.length >= 5 ? 48 : 54;
                return (
                  <div key={`${item.id}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <div className={`item-live-wrap ${isOwned ? 'item-owned' : ''} ${isNext ? 'item-next' : ''}`}>
                      <ItemIconTile
                        patch={catalog.patch}
                        iconFile={item.icon}
                        name={item.name}
                        gold={item.gold}
                        reason={isOwned ? 'Já comprado nesta partida.' : item.reason}
                        size={tileSize}
                        invalid={!item.availableInCatalog}
                      />
                      {isOwned ? (
                        <span className="item-owned-check" title="Comprado">
                          <Check size={11} strokeWidth={3} />
                        </span>
                      ) : null}
                    </div>
                    {idx < analysis.build.core.length - 1 ? (
                      <span className="build-arrow" aria-hidden="true">
                        <ChevronRight size={15} />
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Alertas factuais de itens comprados pelos inimigos ao vivo */}
            {liveMatch && liveMatch.enemyItemThreats.length > 0 ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {liveMatch.enemyItemThreats.slice(0, 3).map((th, idx) => (
                  <span key={`${th.championId}-${th.itemId}-${idx}`} className="badge badge-amber">
                    {th.championName}: {th.itemName} ({THREAT_LABEL[th.threat]})
                  </span>
                ))}
              </div>
            ) : null}

            {/* Linha compacta: Pet + Botas (+ troca no full build quando aplicável) */}
            <div className="build-support-strip">
              <div className="build-mini-group">
                <span className="build-mini-label">Pet</span>
                <ItemIconTile
                  patch={catalog.patch}
                  iconFile={analysis.build.junglePet.icon}
                  name={analysis.build.junglePet.name}
                  gold={analysis.build.junglePet.gold}
                  reason={analysis.build.junglePet.reason}
                  size={34}
                  invalid={!analysis.build.junglePet.availableInCatalog}
                />
                <span className="small-text" style={{ fontWeight: 600 }}>
                  {analysis.build.junglePet.availableInCatalog
                    ? analysis.build.junglePet.name.replace(/^Filhote de |^Cria de |^Broto de /, '')
                    : 'Revisão necessária'}
                </span>
              </div>

              <div className="build-mini-group">
                <span className="build-mini-label">
                  {analysis.build.fullBuildBootReplacement ? 'Bota T1' : 'Bota'}
                </span>
                {analysis.build.boots.map((b) => (
                  <ItemIconTile
                    key={b.id}
                    patch={catalog.patch}
                    iconFile={b.icon}
                    name={b.name}
                    gold={b.gold}
                    reason={b.reason}
                    size={34}
                    invalid={!b.availableInCatalog}
                  />
                ))}
                {analysis.build.fullBuildBootReplacement ? (
                  <>
                    <span
                      className="small-text muted-text"
                      style={{ fontSize: 11 }}
                      title={analysis.build.bootsNote}
                    >
                      vender full build →
                    </span>
                    <ItemIconTile
                      patch={catalog.patch}
                      iconFile={analysis.build.fullBuildBootReplacement.icon}
                      name={analysis.build.fullBuildBootReplacement.name}
                      gold={analysis.build.fullBuildBootReplacement.gold}
                      reason={analysis.build.fullBuildBootReplacement.reason}
                      size={34}
                      invalid={!analysis.build.fullBuildBootReplacement.availableInCatalog}
                    />
                  </>
                ) : analysis.build.boots[0] ? (
                  <span
                    className="small-text"
                    style={{ fontWeight: 600 }}
                    title={analysis.build.bootsNote ?? analysis.build.boots[0].reason}
                    data-testid="recommended-boot-name"
                  >
                    {analysis.build.boots[0].availableInCatalog
                      ? analysis.build.boots[0].name
                          .replace('Botas Galvanizadas de Aço', 'Botas de Aço (AD)')
                          .replace('Botas Ionianas da Lucidez', 'Ionianas')
                          .replace('Passos de Mercúrio', 'Mercúrio (CC/AP)')
                      : 'Revisão necessária'}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Situacionais estritamente filtrados pela forma */}
            {showSituational ? (
              <div className="situational-pills-row" data-testid="situational-panel">
                {analysis.build.situational.map((cat) => {
                  const primaryItem = cat.items[0];
                  if (!primaryItem) return null;
                  return (
                    <div
                      key={cat.key}
                      className="situational-chip"
                      style={{
                        borderColor: cat.activeInDraft ? 'var(--blue-border)' : undefined,
                      }}
                    >
                      <ItemIconTile
                        patch={catalog.patch}
                        iconFile={primaryItem.icon}
                        name={primaryItem.name}
                        gold={primaryItem.gold}
                        reason={primaryItem.reason}
                        size={30}
                        invalid={!primaryItem.availableInCatalog}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 11.5 }}>
                          {cat.shortCondition ?? cat.label}
                        </div>
                        <div className="muted-text" style={{ fontSize: 10.5 }}>
                          {primaryItem.availableInCatalog ? primaryItem.name : 'Revisão necessária'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {/* PAINEL "POR QUÊ?" SOB DEMANDA */}
      {showWhy ? (
        <section className="panel" data-testid="why-form-details">
          <div className="panel-header">
            <strong className="small-text">
              Por que {formTitle}? (Alternativa: {analysis.alternativeFormLabel})
            </strong>
            <button type="button" className="btn btn-xs btn-ghost" onClick={() => setShowWhy(false)}>
              Fechar
            </button>
          </div>
          <div className="grid-2 small-text">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <ul className="list-compact">
                {analysis.shortReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <div className="muted-text">
                <strong>O que inverte a escolha:</strong> {analysis.flipCondition}
              </div>
              {analysis.tiebreakerBlockedReason ? (
                <div style={{ color: '#fca5a5' }}>{analysis.tiebreakerBlockedReason}</div>
              ) : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div>
                <strong>Runas ({analysis.runes.primaryTreeName}):</strong>{' '}
                <span className="muted-text">{analysis.runes.whyFormDiffers}</span>
              </div>
              {analysis.runes.summonerSpellsNote ? (
                <div className="muted-text">
                  <strong>Feitiços ({analysis.runes.summonerSpells?.join(' + ')}):</strong>{' '}
                  {analysis.runes.summonerSpellsNote}
                </div>
              ) : null}
              {analysis.build.bootsNote ? (
                <div className="muted-text">
                  <strong>Botas:</strong> {analysis.build.bootsNote}
                </div>
              ) : null}
              <div className="muted-text">
                <strong>Orbes:</strong> {analysis.orbSummary.earlyAccessNote}
              </div>
              {analysis.flexAmbiguityNotes.length > 0 ? (
                <div className="muted-text">
                  <strong>Flex picks:</strong> {analysis.flexAmbiguityNotes.join(' ')}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* FAIXA CURTA ABAIXO: LANE PARA OBSERVAR + FARM + LEMBRETE TÁTICO */}
      <section className="draft-lanes-strip" aria-label="Plano curto de lanes e lembrete">
        <div className="strip-card">
          <div className="strip-kicker">
            <span>1ª janela para observar</span>
            <span className="badge badge-blue" style={{ padding: '1px 6px', fontSize: 10 }}>
              Jogar em torno: {LANE_SHORT[analysis.lanes.bestPlayAroundLane]}
            </span>
          </div>
          <div className="strip-headline">{firstWindowLabel}</div>
          <div className="strip-sub">{firstWindowShortNote}</div>
        </div>

        <div className="strip-card">
          <div className="strip-kicker">
            <span>Alternativa de farm</span>
          </div>
          <div className="strip-headline">Sem janela limpa? Volte pros campos.</div>
          <div className="strip-sub">{shortFarmAlt}</div>
        </div>

        <div className="strip-card">
          <div className="strip-kicker">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={11} color="var(--blue)" /> Observar na partida
            </span>
            {preGameReminders[0]?.ruleId ? (
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                style={{ padding: '1px 5px', fontSize: 10.5 }}
                onClick={() => void onTogglePinnedReminder(preGameReminders[0].ruleId!)}
              >
                {pinnedReminderIds.includes(preGameReminders[0].ruleId) ? 'Fixado' : 'Fixar'}
              </button>
            ) : null}
          </div>
          <div className="strip-headline">
            {preGameReminders[0]?.text ?? 'Sem janela na Bot? Volte pros campos.'}
          </div>
          <div className="strip-sub">
            {preGameReminders[1]?.text ?? 'A API oficial não informa posição de waves — confirme visão antes de entrar.'}
          </div>
        </div>
      </section>

      {/* DETALHES EXPANSÍVEIS */}
      <ExpandableSection title="Detalhes das 3 lanes (Top / Mid / Bot) e mapa pré-jogo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="grid-3">
            {(['top', 'mid', 'bot'] as TargetLane[]).map((lane) => {
              const info = analysis.lanes.perLane[lane];
              return (
                <div key={lane} className="panel-subtle small-text" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{info.label}</strong>
                    <span className="muted-text" style={{ fontSize: 11 }}>
                      Contragank: {info.countergankRisk}
                    </span>
                  </div>
                  <div>
                    <strong>Entrar se:</strong> {info.favorableConditionSentence}
                  </div>
                  <div className="muted-text">
                    <strong>Farmar se:</strong> {info.fallbackConditionSentence}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ width: 260 }}>
              <TacticalMapSvg
                compact
                focusSide={analysis.lanes.bestPlayAroundLane}
                suggestedStart={shortFarmAlt}
              />
            </div>
            <div className="small-text muted-text" style={{ flex: 1, minWidth: 220 }}>
              <strong>Plano de farm completo:</strong> {analysis.lanes.fallbackFarmPath}
            </div>
          </div>
        </div>
      </ExpandableSection>

      <ExpandableSection title={`Notas do plano, lembretes e rascunhos locais (${savedDrafts.length})`}>
        <div className="grid-2">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label className="field-label">
              <span>Nome do draft</span>
              <input
                type="text"
                className="input"
                value={effectiveDraft.name}
                onChange={(e) =>
                  onChangeDraft({ ...effectiveDraft, name: e.target.value, updatedAt: new Date().toISOString() })
                }
              />
            </label>
            <label className="field-label">
              <span>Nota pessoal para congelar no cartão</span>
              <textarea
                className="textarea"
                placeholder="Ex.: Não forçar Bot contra Ezreal + Lulu sem Flash do suporte."
                value={effectiveDraft.staticNotes}
                onChange={(e) =>
                  onChangeDraft({
                    ...effectiveDraft,
                    staticNotes: e.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
              />
            </label>
            <div>
              <button type="button" className="btn btn-xs" onClick={() => onSaveDraft(effectiveDraft)}>
                <BookmarkPlus size={12} /> Salvar draft na lista
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="small-text muted-text">
              <strong>Rascunhos salvos:</strong>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {savedDrafts.map((sd) => (
                <div key={sd.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <button
                    type="button"
                    className="btn btn-xs"
                    onClick={() => loadManualDemo({ ...sd })}
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

            <div className="small-text muted-text" style={{ marginTop: 4 }}>
              <strong>Combos fixados da aba Aprender ({pinnedMicroCards.length}/3):</strong>{' '}
              {pinnedMicroCards.length === 0
                ? 'Nenhum ainda (fixe em Aprender).'
                : pinnedMicroCards.map((c) => c.title).join(' · ')}
            </div>
          </div>
        </div>
      </ExpandableSection>
    </div>
  );
}
