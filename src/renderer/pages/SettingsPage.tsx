import { RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type {
  AppSettings,
  CardWindowOptions,
  CatalogStatus,
} from '../../shared/types';

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
      setFeedback('Verificação do Data Dragon concluída.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {feedback ? <div className="banner banner-success">{feedback}</div> : null}

      <div className="grid-2">
        {/* Preferência de forma e comportamento */}
        <section className="panel">
          <h2 className="panel-title">Preferência do Jogador</h2>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={settings.preferBlueAsTiebreaker}
              onChange={(e) =>
                void onUpdateSettings({ preferBlueAsTiebreaker: e.target.checked })
              }
            />
            <span>Preferir Kayn Azul apenas como desempate em drafts equilibrados</span>
          </label>
          <div className="small-text muted-text">
            Esta opção nunca esconde um draft claramente favorável ao Rhaast. Quando ativada, decide apenas composições equilibradas onde ambos os planos têm viabilidade parecida.
          </div>

          <h2 className="panel-title" style={{ marginTop: 10 }}>
            Dados Locais &amp; Demos
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => void onResetDemos()}
            >
              <RotateCcw size={12} /> Restaurar demos padrão (mantendo configurações)
            </button>
          </div>
          <div className="small-text muted-text">
            Drafts, treinos, revisões e posição do cartão são gravados apenas no seu computador. Nada é enviado para servidores externos por padrão.
          </div>
        </section>

        {/* Cartão pré-jogo */}
        <section className="panel">
          <h2 className="panel-title">Cartão Estático Durante a Partida</h2>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={settings.cardWindow.alwaysOnTop}
              onChange={(e) =>
                void onUpdateCardOptions({ alwaysOnTop: e.target.checked })
              }
            />
            <span>Manter janela do cartão sempre no topo</span>
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
              Modo somente leitura com clique atravessado (use{' '}
              <span className="mono">Ctrl+Shift+L</span> para destravar)
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

          <label className="field-label">
            <span>Opacidade padrão ({Math.round(settings.cardWindow.opacity * 100)}%)</span>
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

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <label className="field-label" style={{ flex: 1 }}>
              <span>Atalho global para esconder/mostrar cartão</span>
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
              Aplicar atalho
            </button>
          </div>
          <div className="small-text muted-text">
            Status do atalho:{' '}
            {shortcutRegistered ? 'Registrado no sistema' : 'Não registrado / indisponível'}.
          </div>
          {shortcutWarning ? (
            <div className="banner banner-warning">{shortcutWarning}</div>
          ) : null}
          <div className="panel-subtle small-text muted-text">
            <strong>Compatibilidade de vídeo (Windows):</strong> {exclusiveFullscreenNote}
          </div>
        </section>
      </div>

      {/* Data Dragon & Patch */}
      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Catálogo Oficial Data Dragon &amp; Versionamento</h2>
          <button
            type="button"
            className="btn btn-xs btn-blue"
            disabled={refreshing}
            onClick={() => void handleRefreshDdragon()}
          >
            <RefreshCw size={12} /> {refreshing ? 'Atualizando...' : 'Atualizar Data Dragon (pt_BR)'}
          </button>
        </div>
        <div className="small-text">
          <strong>Patch do catálogo ativo:</strong> <span className="mono">{catalogStatus.activePatch}</span> |{' '}
          <strong>Perfis táticos:</strong> <span className="mono">{catalogStatus.validation.tacticalVersion}</span> (validado no patch {catalogStatus.validation.tacticalValidatedPatch}) |{' '}
          <strong>Builds/Runas:</strong> <span className="mono">{catalogStatus.validation.buildVersion}</span> (validado no patch {catalogStatus.validation.buildValidatedPatch})
        </div>
        {catalogStatus.lastError ? (
          <div className="banner banner-warning">{catalogStatus.lastError}</div>
        ) : null}
        {catalogStatus.validation.warnings.length > 0 ? (
          <div className="banner banner-warning">
            {catalogStatus.validation.warnings.join(' ')}
          </div>
        ) : (
          <div className="small-text" style={{ color: 'var(--green)' }}>
            Todos os IDs de itens (Summoner&apos;s Rift) e runas recomendados foram validados contra o catálogo ativo.
          </div>
        )}
      </section>

      {/* Política Riot */}
      <section className="panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={16} color="#34d399" />
          <h2 className="panel-title" style={{ margin: 0 }}>
            Conformidade com a Política da Riot Games
          </h2>
        </div>
        <ul className="list-compact small-text muted-text">
          <li>Sem leitura de memória do processo do LoL, sem injeção, sem manipulação do cliente e sem necessidade de rodar como administrador ou mexer no Vanguard.</li>
          <li>Sem desanonimização do champion select (trabalha apenas com campeões/rotas informados pelo jogador).</li>
          <li>Durante a partida ativa, o cartão mostra exclusivamente o plano congelado antes do jogo — sem ordens dinâmicas, sem alertas contextuais, sem recálculo e sem sons.</li>
          <li>Treino e Revisão operam 100% fora de partida ativa, com separação explícita entre fato observado, hipótese e dado desconhecido.</li>
        </ul>
      </section>
    </div>
  );
}
