import {
  CheckCircle2,
  Database,
  Info,
  LayoutTemplate,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import type {
  AppSettings,
  CardWindowOptions,
  CatalogStatus,
} from '../../shared/types';
import { ExpandableSection } from '../components/ExpandableSection';

type SettingsGroup = 'card' | 'data' | 'about';

export function SettingsPage({
  settings,
  catalogStatus,
  shortcutRegistered,
  exclusiveFullscreenNote,
  onUpdateSettings,
  onUpdateCardOptions,
  onRefreshDdragon,
  onResetDemos,
}: {
  settings: AppSettings;
  catalogStatus: CatalogStatus;
  shortcutRegistered: boolean;
  exclusiveFullscreenNote: string;
  onUpdateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  onUpdateCardOptions: (
    partial: Partial<CardWindowOptions>,
  ) => Promise<{ warning?: string }>;
  onRefreshDdragon: () => Promise<void>;
  onResetDemos: () => Promise<void>;
}) {
  const [group, setGroup] = useState<SettingsGroup>('card');
  const [shortcutDraft, setShortcutDraft] = useState(
    settings.cardWindow.toggleShortcut,
  );
  const [shortcutWarning, setShortcutWarning] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const applyShortcut = async () => {
    setShortcutWarning(null);
    const res = await onUpdateCardOptions({ toggleShortcut: shortcutDraft });
    if (res.warning) {
      setShortcutWarning(res.warning);
    } else {
      setFeedback(`Atalho atualizado para ${shortcutDraft}.`);
    }
  };

  const handleRefreshDdragon = async () => {
    setRefreshing(true);
    setFeedback(null);
    try {
      await onRefreshDdragon();
      setFeedback('Verificação do catálogo BR (Data Dragon pt_BR) concluída.');
    } finally {
      setRefreshing(false);
    }
  };

  const sourceLabel =
    catalogStatus.sourceMode === 'bundled_offline'
      ? 'Snapshot offline embutido'
      : catalogStatus.sourceMode === 'local_cache'
        ? 'Cache local validado'
        : 'Atualizado da rede (BR)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Navegação agrupada: Cartão / Dados / Sobre */}
      <div className="toolbar">
        <div className="toolbar-group">
          <button
            type="button"
            data-testid="settings-tab-card"
            className={`btn btn-xs ${group === 'card' ? 'btn-primary' : ''}`}
            onClick={() => setGroup('card')}
          >
            <LayoutTemplate size={13} /> Cartão
          </button>
          <button
            type="button"
            data-testid="settings-tab-data"
            className={`btn btn-xs ${group === 'data' ? 'btn-primary' : ''}`}
            onClick={() => setGroup('data')}
          >
            <Database size={13} /> Dados
          </button>
          <button
            type="button"
            data-testid="settings-tab-about"
            className={`btn btn-xs ${group === 'about' ? 'btn-primary' : ''}`}
            onClick={() => setGroup('about')}
          >
            <Info size={13} /> Sobre
          </button>
        </div>

        <span className="small-text muted-text mono">
          BR · {catalogStatus.activePatch}
        </span>
      </div>

      {feedback ? <div className="banner banner-success">{feedback}</div> : null}

      {/* GRUPO 1: CARTÃO E PREFERÊNCIAS DE JOGO */}
      {group === 'card' ? (
        <div className="grid-2">
          <section className="panel">
            <h2 className="panel-title">Cartão Flutuante</h2>
            <label className="switch-row">
              <input
                type="checkbox"
                checked={settings.cardWindow.alwaysOnTop}
                onChange={(e) =>
                  void onUpdateCardOptions({ alwaysOnTop: e.target.checked })
                }
              />
              <span>Manter janela sempre no topo</span>
            </label>
            <label className="switch-row">
              <input
                type="checkbox"
                checked={settings.cardWindow.clickThrough}
                onChange={(e) =>
                  void onUpdateCardOptions({ clickThrough: e.target.checked })
                }
              />
              <span>
                Clique atravessado (<span className="mono">Ctrl+Shift+L</span> destrava)
              </span>
            </label>
            <label className="switch-row">
              <input
                type="checkbox"
                checked={settings.cardWindow.showStaticMap}
                onChange={(e) =>
                  void onUpdateCardOptions({ showStaticMap: e.target.checked })
                }
              />
              <span>Exibir mapa esquemático estático no cartão</span>
            </label>

            <label className="field-label" style={{ marginTop: 4 }}>
              <span>Opacidade ({Math.round(settings.cardWindow.opacity * 100)}%)</span>
              <input
                type="range"
                min={0.35}
                max={1}
                step={0.05}
                value={settings.cardWindow.opacity}
                onChange={(e) =>
                  void onUpdateCardOptions({ opacity: Number(e.target.value) })
                }
              />
            </label>
          </section>

          <section className="panel">
            <h2 className="panel-title">Atalho &amp; Draft</h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <label className="field-label" style={{ flex: 1 }}>
                <span>Atalho global para mostrar/esconder cartão</span>
                <input
                  type="text"
                  className="input mono"
                  value={shortcutDraft}
                  onChange={(e) => setShortcutDraft(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn btn-xs btn-primary"
                onClick={() => void applyShortcut()}
              >
                Aplicar
              </button>
            </div>
            <div className="small-text muted-text">
              Status: {shortcutRegistered ? 'Registrado no sistema' : 'Indisponível no ambiente atual'}.
            </div>
            {shortcutWarning ? (
              <div className="banner banner-warning">{shortcutWarning}</div>
            ) : null}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={settings.preferBlueAsTiebreaker}
                  onChange={(e) =>
                    void onUpdateSettings({ preferBlueAsTiebreaker: e.target.checked })
                  }
                />
                <span>Preferir Kayn Azul como desempate em drafts equilibrados</span>
              </label>
              <div className="small-text muted-text" style={{ marginTop: 4 }}>
                Nunca substitui um draft claramente favorável ao Rhaast.
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {/* GRUPO 2: DADOS, PATCH, CACHE DE ÍCONES E VERSIONAMENTO */}
      {group === 'data' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Catálogo Data Dragon (BR · pt_BR) &amp; Cache de Ícones</h2>
              <button
                type="button"
                data-testid="refresh-ddragon-btn"
                className="btn btn-xs btn-blue"
                disabled={refreshing}
                onClick={() => void handleRefreshDdragon()}
              >
                <RefreshCw size={12} /> {refreshing ? 'Verificando...' : 'Atualizar Data Dragon (pt_BR)'}
              </button>
            </div>

            <div className="grid-3 small-text">
              <div className="panel-subtle">
                <div className="muted-text">Catálogo ativo (cliente BR)</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>
                  {catalogStatus.activePatch}
                </div>
                <div className="muted-text" style={{ marginTop: 2 }}>{sourceLabel}</div>
              </div>

              <div className="panel-subtle">
                <div className="muted-text">Recomendações (Builds &amp; Runas)</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>
                  {catalogStatus.validation.buildValidatedPatch}
                </div>
                <div className="muted-text" style={{ marginTop: 2 }}>
                  {catalogStatus.validation.buildVersion}
                </div>
              </div>

              <div className="panel-subtle">
                <div className="muted-text">Ícones oficiais em cache offline</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>
                  {catalogStatus.cachedAssetsCount ?? 0} arquivos
                </div>
                <div className="muted-text" style={{ marginTop: 2 }}>
                  Perfis táticos {catalogStatus.validation.tacticalValidatedPatch}
                </div>
              </div>
            </div>

            {catalogStatus.lastError ? (
              <div className="banner banner-warning">{catalogStatus.lastError}</div>
            ) : null}

            {catalogStatus.validation.warnings.length > 0 ? (
              <div className="banner banner-warning">
                {catalogStatus.validation.warnings.join(' ')}
              </div>
            ) : (
              <div className="small-text" style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} />
                <span>
                  Todos os IDs de campeões, itens (Summoner&apos;s Rift), runas, slots e fragmentos estão validados para o patch ativo.
                </span>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Dados Locais &amp; Memória Tática</h2>
              <button
                type="button"
                className="btn btn-xs"
                onClick={() => void onResetDemos()}
              >
                <RotateCcw size={12} /> Restaurar demos padrão
              </button>
            </div>
            <div className="small-text muted-text">
              Drafts, favoritos, lembretes fixados, anotações das regras táticas, revisões e posição do cartão ficam salvos localmente no seu computador e sobrevivem a atualizações do app.
            </div>
          </section>
        </div>
      ) : null}

      {/* GRUPO 3: SOBRE & DETALHES TÉCNICOS SOB EXPANSÃO */}
      {group === 'about' ? (
        <section className="panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <ShieldCheck size={16} color="var(--green)" />
            <strong>KAYN-DICAS · Assistente offline para Kayn Jungle (BR Solo/Duo)</strong>
          </div>
          <div className="small-text muted-text">
            Funciona 100% offline, sem conta de IA, sem leitura em tempo real da partida e sem alterar o cliente do League of Legends.
          </div>

          <ExpandableSection title="Compatibilidade de vídeo (Windows) e Política da Riot Games">
            <div className="small-text muted-text" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <strong>Tela Cheia Exclusiva:</strong> {exclusiveFullscreenNote}
              </div>
              <ul className="list-compact">
                <li>Sem leitura de memória, injeção, automação ou necessidade de privilégios de administrador.</li>
                <li>Sem desanonimização do champion select (usa apenas campeões selecionados manualmente).</li>
                <li>O cartão flutuante exibe exclusivamente o plano congelado antes da partida — sem ordens calculadas ao vivo e sem sons.</li>
                <li>Consulte detalhes completos no arquivo <span className="mono">docs/RIOT_POLICY.md</span> e <span className="mono">README.md</span>.</li>
              </ul>
            </div>
          </ExpandableSection>
        </section>
      ) : null}
    </div>
  );
}
