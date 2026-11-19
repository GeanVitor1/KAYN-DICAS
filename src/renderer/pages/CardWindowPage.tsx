import {
  AlertTriangle,
  Calendar,
  Check,
  Coins,
  Eye,
  EyeOff,
  Lock,
  Radio,
  SlidersHorizontal,
  Target,
  Unlock,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  analyzeDraft,
  createFrozenCardFromAnalysis,
} from '../../engine/draftAnalyzer';
import {
  computeNextBuildStep,
  formatGameClock,
} from '../../engine/liveLolParser';
import { selectPreGameReminders } from '../../engine/tacticalMemory';
import type {
  CardWindowOptions,
  CatalogSnapshot,
  DraftState,
  FrozenMicroComboCard,
  FrozenPreGameCard,
  LiveLolStatus,
  TacticalRule,
} from '../../shared/types';
import { ComboSequenceBadge } from '../components/ComboSequenceBadge';
import { ChampionPortrait, ItemIconTile, RuneIconTile } from '../components/GameIcon';
import { TacticalMapSvg } from '../components/TacticalMapSvg';

const THREAT_PT: Record<string, string> = {
  armor: 'Armadura',
  healing: 'Cura',
  shields: 'Escudo',
  defensive: 'Defesa',
};

/**
 * Janela estreita do Cartão Pré-Jogo / Acompanhamento ao Vivo (via API oficial da Riot).
 * Sem leitura de memória, sem timers ocultos e sem ordens automáticas de macro.
 */
export function CardWindowPage({
  frozenCard,
  liveLolStatus,
  tacticalRules = [],
  pinnedReminderIds = [],
  tacticalRuleNotes = {},
  pinnedMicroCards = [],
  preferBlueAsTiebreaker = true,
  catalog,
  options,
  onUpdateOptions,
  onCloseCard,
}: {
  frozenCard: FrozenPreGameCard | null;
  liveLolStatus?: LiveLolStatus | null;
  tacticalRules?: TacticalRule[];
  pinnedReminderIds?: string[];
  tacticalRuleNotes?: Record<string, string>;
  pinnedMicroCards?: FrozenMicroComboCard[];
  preferBlueAsTiebreaker?: boolean;
  catalog: CatalogSnapshot;
  options: CardWindowOptions;
  onUpdateOptions: (partial: Partial<CardWindowOptions>) => Promise<void>;
  onCloseCard: () => Promise<void>;
}) {
  const [showOpacityBar, setShowOpacityBar] = useState(false);

  const isLiveMatch =
    liveLolStatus?.phase === 'in_game' && Boolean(liveLolStatus.liveDraft && liveLolStatus.liveMatch);
  const isLiveChampSelect =
    liveLolStatus?.phase === 'champ_select' && Boolean(liveLolStatus.liveDraft);
  const isLiveMode = isLiveMatch || isLiveChampSelect;

  // Quando o LoL está em Seleção ou Partida, gera automaticamente a visão da partida real!
  const liveComputed = useMemo(() => {
    if (!isLiveMode || !liveLolStatus?.liveDraft) return null;
    const liveDraftState: DraftState = {
      id: isLiveMatch ? 'live-game-card' : 'live-select-card',
      name: isLiveMatch ? 'Partida ao vivo' : 'Seleção ao vivo',
      allies: liveLolStatus.liveDraft.allies,
      enemies: liveLolStatus.liveDraft.enemies,
      staticNotes: '',
      updatedAt: liveLolStatus.lastUpdatedAt ?? new Date().toISOString(),
    };
    const analysis = analyzeDraft(liveDraftState, catalog, { preferBlueAsTiebreaker });
    const reminders = selectPreGameReminders(
      analysis,
      tacticalRules,
      pinnedReminderIds,
      tacticalRuleNotes,
    );
    const card = createFrozenCardFromAnalysis(
      liveDraftState,
      analysis,
      pinnedMicroCards,
      reminders.slice(0, 2).map((r) => ({
        ruleId: r.ruleId,
        text: r.text,
        watchCondition: r.watchCondition,
      })),
    );
    const nextStep = liveLolStatus.liveMatch
      ? computeNextBuildStep(
          analysis.build,
          liveLolStatus.liveMatch.ownedItemIds,
          liveLolStatus.liveMatch.currentGold,
        )
      : null;
    return { card, nextStep };
  }, [
    isLiveMode,
    isLiveMatch,
    liveLolStatus,
    catalog,
    preferBlueAsTiebreaker,
    tacticalRules,
    pinnedReminderIds,
    tacticalRuleNotes,
    pinnedMicroCards,
  ]);

  const activeCard = liveComputed?.card ?? frozenCard;
  const liveMatch = isLiveMatch ? liveLolStatus?.liveMatch ?? null : null;
  const ownedSet = useMemo(
    () => new Set(liveMatch?.ownedItemIds ?? []),
    [liveMatch],
  );

  const formTitle =
    activeCard?.recommendedForm === 'blue'
      ? 'Kayn Azul'
      : activeCard?.recommendedForm === 'red'
        ? 'Rhaast'
        : 'Indefinido';

  const heroMiniClass =
    activeCard?.recommendedForm === 'blue'
      ? 'card-hero-mini-blue'
      : activeCard?.recommendedForm === 'red'
        ? 'card-hero-mini-red'
        : 'card-hero-mini-open';

  const kaynChamp = catalog.champions.Kayn;
  const cardPatch = activeCard?.patch || catalog.patch;

  const shortReminders =
    activeCard?.selectedTacticalReminders && activeCard.selectedTacticalReminders.length > 0
      ? activeCard.selectedTacticalReminders.slice(0, 2).map((r) => r.text)
      : (activeCard?.staticReminders ?? []).slice(0, 2);

  const pinnedCombos = (activeCard?.pinnedMicroCards ?? []).slice(0, 2);

  return (
    <div className="card-shell" data-testid="frozen-card-root">
      <div className="card-drag-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isLiveMode ? (
            <Radio size={13} color={isLiveMatch ? 'var(--green)' : 'var(--blue)'} />
          ) : (
            <Calendar size={13} color="var(--blue)" />
          )}
          <strong style={{ fontSize: 12.5, color: '#ffffff' }}>
            {isLiveMatch
              ? `Ao vivo · ${formatGameClock(liveMatch?.gameTimeSeconds ?? 0)}`
              : isLiveChampSelect
                ? 'Seleção ao vivo'
                : 'Plano pré-jogo'}
          </strong>
        </div>

        <div className="card-no-drag" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <button
            type="button"
            className={`btn btn-xs btn-ghost ${options.alwaysOnTop ? 'btn-blue' : ''}`}
            style={{ padding: '3px 5px' }}
            title="Sempre no topo"
            onClick={() => void onUpdateOptions({ alwaysOnTop: !options.alwaysOnTop })}
          >
            {options.alwaysOnTop ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>

          <button
            type="button"
            className={`btn btn-xs btn-ghost ${options.clickThrough ? 'btn-amber' : ''}`}
            style={{ padding: '3px 5px' }}
            title="Clique atravessado (Ctrl+Shift+L destrava)"
            onClick={() => void onUpdateOptions({ clickThrough: !options.clickThrough })}
          >
            {options.clickThrough ? <Lock size={12} /> : <Unlock size={12} />}
          </button>

          <button
            type="button"
            className={`btn btn-xs btn-ghost ${showOpacityBar ? 'btn-blue' : ''}`}
            style={{ padding: '3px 5px' }}
            title="Opacidade"
            onClick={() => setShowOpacityBar((v) => !v)}
          >
            <SlidersHorizontal size={12} />
          </button>

          <button
            type="button"
            className="btn btn-xs btn-ghost"
            style={{ padding: '3px 5px' }}
            aria-label="Fechar cartão"
            onClick={() => void onCloseCard()}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {showOpacityBar ? (
        <div
          className="card-no-drag"
          style={{
            padding: '5px 10px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            background: 'var(--surface-2)',
            fontSize: 11,
          }}
        >
          <span>Opacidade {Math.round(options.opacity * 100)}%</span>
          <input
            type="range"
            min={0.35}
            max={1}
            step={0.05}
            value={options.opacity}
            onChange={(e) => void onUpdateOptions({ opacity: Number(e.target.value) })}
          />
        </div>
      ) : null}

      {options.clickThrough ? (
        <div className="banner banner-warning" style={{ margin: '8px 10px 0', padding: '5px 8px', fontSize: 11 }}>
          <span>
            Clique atravessado · <strong className="mono">Ctrl+Shift+L</strong> destrava
          </span>
        </div>
      ) : null}

      <div className="card-body">
        {!activeCard ? (
          <div className="panel-subtle small-text" style={{ textAlign: 'center', padding: 14 }}>
            <strong>Aguardando LoL ou plano salvo</strong>
            <div className="muted-text" style={{ marginTop: 4 }}>
              Entre na Seleção de Campeões ou clique em <strong>Salvar plano pré-jogo</strong> no Draft.
            </div>
          </div>
        ) : (
          <>
            {/* 1. FORMA RECOMENDADA */}
            <div className={`card-hero-mini ${heroMiniClass}`}>
              <ChampionPortrait
                patch={cardPatch}
                imageFull={kaynChamp?.imageFull}
                name="Kayn"
                size={44}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                  {formTitle}
                </div>
                <div className="small-text" style={{ color: 'rgba(238,243,251,0.82)', marginTop: 2 }}>
                  {activeCard.shortFormReason ?? activeCard.lanesToWatch.firstGankWindow}
                </div>
              </div>
              <span className="mono muted-text" style={{ fontSize: 10 }}>
                {activeCard.patch}
              </span>
            </div>

            {/* BARRA AO VIVO (OURO / PRÓXIMO ITEM / KDA) QUANDO EM PARTIDA */}
            {liveMatch ? (
              <div className="panel-subtle" style={{ padding: '7px 9px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5 }}>
                  <span>
                    <strong>Nv {liveMatch.level}</strong> · {liveMatch.kills}/{liveMatch.deaths}/{liveMatch.assists} · {liveMatch.totalCreepScore} CS
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#fde68a', fontWeight: 800 }} className="mono">
                    <Coins size={12} /> {liveMatch.currentGold}g
                  </span>
                </div>
                {liveComputed?.nextStep?.nextItem ? (
                  <div className="small-text" style={{ fontSize: 11, color: liveComputed.nextStep.canAffordNow ? 'var(--green)' : 'var(--muted)' }}>
                    {liveComputed.nextStep.canAffordNow
                      ? `Ouro pronto p/ ${liveComputed.nextStep.nextItem.name}!`
                      : `Faltam ${liveComputed.nextStep.goldNeeded}g p/ ${liveComputed.nextStep.nextItem.name}`}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* 2. RUNA VISUAL */}
            <div>
              <div className="card-section-label">Runa</div>
              {activeCard.runesVisual ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <RuneIconTile
                    patch={cardPatch}
                    iconPath={activeCard.runesVisual.keystone.icon}
                    name={activeCard.runesVisual.keystone.name}
                    subLabel={activeCard.runesSummary.primaryTree}
                    size={44}
                    variant="keystone"
                    accent={activeCard.recommendedForm === 'blue' ? 'blue' : 'gold'}
                    invalid={!activeCard.runesVisual.keystone.validInCatalog}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: '#ffffff', lineHeight: 1.15 }}>
                      {activeCard.runesVisual.keystone.validInCatalog
                        ? activeCard.runesVisual.keystone.name
                        : 'Revisão necessária'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                      {activeCard.runesVisual.secondaryRunes.map((r) => (
                        <RuneIconTile
                          key={r.id}
                          patch={cardPatch}
                          iconPath={r.icon}
                          name={r.name}
                          subLabel={activeCard.runesSummary.secondaryTree}
                          size={26}
                          variant="secondary"
                          invalid={!r.validInCatalog}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="small-text">
                  <strong>{activeCard.runesSummary.primaryRunes[0]}</strong> ·{' '}
                  <span className="muted-text">
                    {activeCard.runesSummary.secondaryRunes.join(' + ')}
                  </span>
                </div>
              )}
              {activeCard.runesVisual?.hasInvalidRunes ? (
                <div className="small-text" style={{ color: '#fde68a', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={11} /> Revisão necessária nas runas
                </div>
              ) : null}
            </div>

            {/* 3. BUILD VISUAL EM ORDEM (COM CHECK NOS COMPRADOS AO VIVO) */}
            <div>
              <div className="card-section-label">Build</div>
              {activeCard.buildVisual ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    {activeCard.buildVisual.core.map((item, idx) => {
                      const isOwned = ownedSet.has(item.id);
                      return (
                        <div key={`${item.id}-${idx}`} className={`item-live-wrap ${isOwned ? 'item-owned' : ''}`}>
                          <ItemIconTile
                            patch={cardPatch}
                            iconFile={item.icon}
                            name={item.name}
                            gold={item.gold}
                            size={44}
                            invalid={!item.availableInCatalog}
                          />
                          {isOwned ? (
                            <span className="item-owned-check">
                              <Check size={10} strokeWidth={3} />
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ItemIconTile
                      patch={cardPatch}
                      iconFile={activeCard.buildVisual.junglePet.icon}
                      name={activeCard.buildVisual.junglePet.name}
                      size={26}
                      invalid={!activeCard.buildVisual.junglePet.availableInCatalog}
                    />
                    <span className="muted-text" style={{ fontSize: 10 }}>·</span>
                    {activeCard.buildVisual.boots.slice(0, 2).map((b) => (
                      <ItemIconTile
                        key={b.id}
                        patch={cardPatch}
                        iconFile={b.icon}
                        name={b.name}
                        size={26}
                        invalid={!b.availableInCatalog}
                      />
                    ))}
                    <span className="small-text muted-text" style={{ marginLeft: 'auto', fontSize: 11 }}>
                      1ª: {activeCard.lanesToWatch.firstGankWindow}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="small-text">
                  {activeCard.buildSummary.coreItems.join(' → ')}
                </div>
              )}
            </div>

            {/* ALERTAS FACTUAIS DE ITENS INIMIGOS AO VIVO */}
            {liveMatch && liveMatch.enemyItemThreats.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {liveMatch.enemyItemThreats.slice(0, 2).map((th, idx) => (
                  <div key={idx} className="badge badge-amber" style={{ justifyContent: 'flex-start', borderRadius: 7 }}>
                    {th.championName}: {th.itemName} ({THREAT_PT[th.threat]})
                  </div>
                ))}
              </div>
            ) : null}

            {/* 4. LEMBRETES CURTOS (1–2) */}
            {shortReminders.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {shortReminders.map((rem, idx) => (
                  <div key={idx} className="card-reminder-pill">
                    <Target size={14} color="var(--blue)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{rem}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {/* 5. COMBO FIXADO */}
            {pinnedCombos.length > 0 ? (
              <div data-testid="card-pinned-micros" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pinnedCombos.map((mc) => (
                  <div key={mc.lessonId} className="panel-subtle" style={{ padding: 9, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
                        {mc.attributionLabel}
                      </span>
                      <span
                        className={`badge ${
                          mc.form === 'blue' ? 'badge-blue' : mc.form === 'red' ? 'badge-red' : 'badge-muted'
                        }`}
                        style={{ padding: '1px 6px', fontSize: 10 }}
                      >
                        {mc.form === 'blue' ? 'Azul' : mc.form === 'red' ? 'Rhaast' : 'Base/Ambas'}
                      </span>
                    </div>
                    <ComboSequenceBadge compact steps={mc.steps} form={mc.form} />
                    <div className="small-text muted-text" style={{ fontSize: 11, lineHeight: 1.3 }}>
                      {mc.conditionToUse}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {options.showStaticMap ? (
              <TacticalMapSvg
                compact
                focusSide={activeCard.schematicPlan.primaryFocusSide}
                suggestedStart={activeCard.schematicPlan.suggestedStart}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
