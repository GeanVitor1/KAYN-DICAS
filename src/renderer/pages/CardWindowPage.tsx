import { Eye, EyeOff, Lock, Map, Pin, Unlock, X } from 'lucide-react';
import type { CardWindowOptions, FrozenPreGameCard } from '../../shared/types';
import { ComboSequenceBadge } from '../components/ComboSequenceBadge';
import { FormBadge } from '../components/FormBadge';
import { TacticalMapSvg } from '../components/TacticalMapSvg';

/**
 * Janela compacta e estática do Cartão Pré-Jogo.
 * Totalmente desacoplada do simulador de treino e sem qualquer leitura ao vivo da partida.
 */
export function CardWindowPage({
  frozenCard,
  options,
  exclusiveFullscreenNote,
  onUpdateOptions,
  onCloseCard,
}: {
  frozenCard: FrozenPreGameCard | null;
  options: CardWindowOptions;
  exclusiveFullscreenNote: string;
  onUpdateOptions: (partial: Partial<CardWindowOptions>) => Promise<void>;
  onCloseCard: () => Promise<void>;
}) {
  return (
    <div className="card-shell" data-testid="frozen-card-root">
      <div className="card-drag-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Pin size={13} color="#38bdf8" />
          <strong style={{ fontSize: 12 }}>CARTÃO PRÉ-JOGO</strong>
        </div>

        <div className="card-no-drag" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            className={`btn btn-xs ${options.alwaysOnTop ? 'btn-blue' : ''}`}
            title="Sempre no topo"
            onClick={() => void onUpdateOptions({ alwaysOnTop: !options.alwaysOnTop })}
          >
            {options.alwaysOnTop ? <Eye size={12} /> : <EyeOff size={12} />} Topo
          </button>

          <button
            type="button"
            className={`btn btn-xs ${options.clickThrough ? 'btn-amber' : ''}`}
            title="Modo somente leitura com clique atravessado (Ctrl+Shift+L destrava)"
            onClick={() => void onUpdateOptions({ clickThrough: !options.clickThrough })}
          >
            {options.clickThrough ? <Lock size={12} /> : <Unlock size={12} />} Clique
          </button>

          <button
            type="button"
            className={`btn btn-xs ${options.showStaticMap ? 'btn-blue' : ''}`}
            title="Mostrar/ocultar mapa esquemático estático"
            onClick={() => void onUpdateOptions({ showStaticMap: !options.showStaticMap })}
          >
            <Map size={12} />
          </button>

          <button
            type="button"
            className="btn btn-xs btn-ghost"
            aria-label="Fechar cartão"
            onClick={() => void onCloseCard()}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Barra compacta de opacidade e atalhos */}
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
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
          <span>Opacidade {Math.round(options.opacity * 100)}%</span>
          <input
            type="range"
            min={0.35}
            max={1}
            step={0.05}
            value={options.opacity}
            onChange={(e) => void onUpdateOptions({ opacity: Number(e.target.value) })}
          />
        </label>
        <span className="small-text muted-text mono" style={{ fontSize: 10.5 }}>
          {options.toggleShortcut}
        </span>
      </div>

      {options.clickThrough ? (
        <div className="banner banner-warning" style={{ margin: 8, fontSize: 11.5 }}>
          <span>
            Clique atravessado ativo. Pressione <strong className="mono">Ctrl+Shift+L</strong> para destravar interação.
          </span>
        </div>
      ) : null}

      <div className="card-body">
        {!frozenCard ? (
          <div className="panel">
            <strong>Nenhum plano pré-jogo congelado ainda.</strong>
            <p className="small-text muted-text" style={{ margin: 0 }}>
              Volte à tela <strong>Draft</strong> na janela principal, escolha os campeões (ou carregue uma demo) e clique em{' '}
              <strong>Salvar plano pré-jogo</strong>.
            </p>
          </div>
        ) : (
          <>
            <div className="banner" style={{ padding: '6px 8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399' }}>
                  PLANO PRÉ-JOGO ESTÁTICO — CONGELADO ÀS{' '}
                  {new Date(frozenCard.frozenAt).toLocaleTimeString('pt-BR')}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{frozenCard.draftName}</span>
              </div>
              <span className="small-text muted-text">
                Patch {frozenCard.patch}
                {frozenCard.patchMismatch ? ' (divergente)' : ''}
              </span>
            </div>

            <div className="panel" style={{ padding: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <FormBadge
                  form={frozenCard.recommendedForm}
                  label={frozenCard.recommendedFormLabel}
                />
                <span className="small-text muted-text">Alt: {frozenCard.alternativeFormLabel}</span>
              </div>
              <div className="small-text">
                <strong>Inverte se:</strong> {frozenCard.flipCondition}
              </div>
            </div>

            <div className="panel" style={{ padding: 9 }}>
              <div className="small-text">
                <strong>Runas ({frozenCard.runesSummary.primaryTree}):</strong>{' '}
                {frozenCard.runesSummary.primaryRunes.join(' → ')} |{' '}
                <strong>{frozenCard.runesSummary.secondaryTree}:</strong>{' '}
                {frozenCard.runesSummary.secondaryRunes.join(' + ')}
              </div>
              <div className="small-text">
                <strong>Build núcleo:</strong> {frozenCard.buildSummary.junglePet} •{' '}
                {frozenCard.buildSummary.boots} •{' '}
                <strong>{frozenCard.buildSummary.coreItems.join(' → ')}</strong>
              </div>
              {frozenCard.buildSummary.activeSituational.length > 0 ? (
                <div className="small-text muted-text">
                  <strong>Situacionais:</strong>{' '}
                  {frozenCard.buildSummary.activeSituational
                    .map((s) => `${s.label}: ${s.items.join('/')}`)
                    .join(' | ')}
                </div>
              ) : null}
            </div>

            <div className="panel" style={{ padding: 9 }}>
              <div className="small-text">
                <strong>1ª janela:</strong> {frozenCard.lanesToWatch.firstGankWindow} |{' '}
                <strong>Jogar em torno:</strong> {frozenCard.lanesToWatch.bestPlayAroundLane}
              </div>
              {frozenCard.lanesToWatch.perLaneNotes.map((ln) => (
                <div key={ln.laneLabel} className="panel-subtle" style={{ padding: 6, fontSize: 11.5 }}>
                  <strong>{ln.laneLabel}:</strong> {ln.favorable}{' '}
                  <span className="muted-text">{ln.fallback}</span>
                </div>
              ))}
              <div className="small-text">
                <strong>Plano de farm:</strong> {frozenCard.farmPlan}
              </div>
            </div>

            {frozenCard.pinnedMicroCards && frozenCard.pinnedMicroCards.length > 0 ? (
              <div className="panel" style={{ padding: 9 }} data-testid="card-pinned-micros">
                <strong className="small-text">Combos fixados ({frozenCard.pinnedMicroCards.length}/3):</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {frozenCard.pinnedMicroCards.map((mc) => (
                    <div key={mc.lessonId} className="panel-subtle" style={{ padding: 7, fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <FormBadge
                          form={mc.form === 'blue' ? 'blue' : mc.form === 'red' ? 'red' : 'open'}
                          label={mc.form === 'blue' ? 'Azul' : mc.form === 'red' ? 'Rhaast' : 'Base/Ambas'}
                        />
                        <span className="muted-text" style={{ fontSize: 10.5 }}>{mc.attributionLabel}</span>
                      </div>
                      <ComboSequenceBadge compact steps={mc.steps} form={mc.form} />
                      <div>
                        <strong>Uso:</strong> {mc.conditionToUse}
                      </div>
                      <div className="muted-text">
                        <strong>Guardar:</strong> {mc.heldAbilityHint}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {frozenCard.staticReminders.length > 0 ? (
              <div className="panel" style={{ padding: 9 }}>
                <strong className="small-text">Lembretes pré-jogo:</strong>
                <ul className="list-compact" style={{ fontSize: 11.5 }}>
                  {frozenCard.staticReminders.map((rem, i) => (
                    <li key={i}>{rem}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {options.showStaticMap ? (
              <div className="panel" style={{ padding: 9 }}>
                <TacticalMapSvg
                  compact
                  focusSide={frozenCard.schematicPlan.primaryFocusSide}
                  suggestedStart={frozenCard.schematicPlan.suggestedStart}
                />
              </div>
            ) : null}

            <div className="small-text muted-text" style={{ fontSize: 11 }}>
              {exclusiveFullscreenNote}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
