import {
  AlertTriangle,
  Calendar,
  Eye,
  EyeOff,
  Lock,
  SlidersHorizontal,
  Target,
  Unlock,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type {
  CardWindowOptions,
  CatalogSnapshot,
  FrozenPreGameCard,
} from '../../shared/types';
import { ComboSequenceBadge } from '../components/ComboSequenceBadge';
import { ChampionPortrait, ItemIconTile, RuneIconTile } from '../components/GameIcon';
import { TacticalMapSvg } from '../components/TacticalMapSvg';

/**
 * Janela estreita e estática do Cartão Pré-Jogo.
 * Totalmente desacoplada do simulador de treino e sem qualquer leitura ao vivo da partida.
 */
export function CardWindowPage({
  frozenCard,
  catalog,
  options,
  onUpdateOptions,
  onCloseCard,
}: {
  frozenCard: FrozenPreGameCard | null;
  catalog: CatalogSnapshot;
  options: CardWindowOptions;
  onUpdateOptions: (partial: Partial<CardWindowOptions>) => Promise<void>;
  onCloseCard: () => Promise<void>;
}) {
  const [showOpacityBar, setShowOpacityBar] = useState(false);

  const formTitle =
    frozenCard?.recommendedForm === 'blue'
      ? 'Kayn Azul'
      : frozenCard?.recommendedForm === 'red'
        ? 'Rhaast'
        : 'Indefinido';

  const heroMiniClass =
    frozenCard?.recommendedForm === 'blue'
      ? 'card-hero-mini-blue'
      : frozenCard?.recommendedForm === 'red'
        ? 'card-hero-mini-red'
        : 'card-hero-mini-open';

  const kaynChamp = catalog.champions.Kayn;
  const cardPatch = frozenCard?.patch || catalog.patch;

  // Resolve lembretes curtos (1-2 no máximo, sem parágrafos)
  const shortReminders =
    frozenCard?.selectedTacticalReminders && frozenCard.selectedTacticalReminders.length > 0
      ? frozenCard.selectedTacticalReminders.slice(0, 2).map((r) => r.text)
      : (frozenCard?.staticReminders ?? []).slice(0, 2);

  // Primeiro combo fixado (verificado ou exercício claramente rotulado)
  const pinnedCombos = (frozenCard?.pinnedMicroCards ?? []).slice(0, 2);

  return (
    <div className="card-shell" data-testid="frozen-card-root">
      <div className="card-drag-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={13} color="var(--blue)" />
          <strong style={{ fontSize: 12.5, color: '#ffffff' }}>Plano pré-jogo</strong>
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
        {!frozenCard ? (
          <div className="panel-subtle small-text" style={{ textAlign: 'center', padding: 14 }}>
            <strong>Sem plano salvo</strong>
            <div className="muted-text" style={{ marginTop: 4 }}>
              No Draft, clique em <strong>Salvar plano pré-jogo</strong>.
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
                  {frozenCard.shortFormReason ?? frozenCard.lanesToWatch.firstGankWindow}
                </div>
              </div>
              <span className="mono muted-text" style={{ fontSize: 10 }}>
                {frozenCard.patch}
              </span>
            </div>

            {/* 2. RUNA VISUAL */}
            <div>
              <div className="card-section-label">Runa</div>
              {frozenCard.runesVisual ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <RuneIconTile
                    patch={cardPatch}
                    iconPath={frozenCard.runesVisual.keystone.icon}
                    name={frozenCard.runesVisual.keystone.name}
                    subLabel={frozenCard.runesSummary.primaryTree}
                    size={44}
                    variant="keystone"
                    accent={frozenCard.recommendedForm === 'blue' ? 'blue' : 'gold'}
                    invalid={!frozenCard.runesVisual.keystone.validInCatalog}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: '#ffffff', lineHeight: 1.15 }}>
                      {frozenCard.runesVisual.keystone.validInCatalog
                        ? frozenCard.runesVisual.keystone.name
                        : 'Revisão necessária'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                      {frozenCard.runesVisual.secondaryRunes.map((r) => (
                        <RuneIconTile
                          key={r.id}
                          patch={cardPatch}
                          iconPath={r.icon}
                          name={r.name}
                          subLabel={frozenCard.runesSummary.secondaryTree}
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
                  <strong>{frozenCard.runesSummary.primaryRunes[0]}</strong> ·{' '}
                  <span className="muted-text">
                    {frozenCard.runesSummary.secondaryRunes.join(' + ')}
                  </span>
                </div>
              )}
              {frozenCard.runesVisual?.hasInvalidRunes ? (
                <div className="small-text" style={{ color: '#fde68a', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={11} /> Revisão necessária nas runas
                </div>
              ) : null}
            </div>

            {/* 3. BUILD VISUAL EM ORDEM */}
            <div>
              <div className="card-section-label">Build</div>
              {frozenCard.buildVisual ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    {frozenCard.buildVisual.core.map((item, idx) => (
                      <ItemIconTile
                        key={`${item.id}-${idx}`}
                        patch={cardPatch}
                        iconFile={item.icon}
                        name={item.name}
                        gold={item.gold}
                        size={44}
                        invalid={!item.availableInCatalog}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ItemIconTile
                      patch={cardPatch}
                      iconFile={frozenCard.buildVisual.junglePet.icon}
                      name={frozenCard.buildVisual.junglePet.name}
                      size={26}
                      invalid={!frozenCard.buildVisual.junglePet.availableInCatalog}
                    />
                    <span className="muted-text" style={{ fontSize: 10 }}>·</span>
                    {frozenCard.buildVisual.boots.slice(0, 2).map((b) => (
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
                      1ª: {frozenCard.lanesToWatch.firstGankWindow}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="small-text">
                  {frozenCard.buildSummary.coreItems.join(' → ')}
                </div>
              )}
            </div>

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

            {/* 5. COMBO FIXADO (APENAS VERIFICADOS OU EXERCÍCIO DE TREINO) */}
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

            {/* Mapa estático opcional */}
            {options.showStaticMap ? (
              <TacticalMapSvg
                compact
                focusSide={frozenCard.schematicPlan.primaryFocusSide}
                suggestedStart={frozenCard.schematicPlan.suggestedStart}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
