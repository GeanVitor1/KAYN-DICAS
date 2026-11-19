import type { LanePrioState } from '../../shared/types';

export interface TrainingMapOverlay {
  botPrio: LanePrioState;
  midPrio: LanePrioState;
  topPrio: LanePrioState;
  enemyJg: 'bot_side' | 'top_side' | 'mid_area' | 'base_or_dead' | 'unknown';
  objectiveType: 'dragon' | 'voidgrubs' | 'herald' | 'baron' | 'none';
  focusLane?: 'top' | 'mid' | 'bot' | 'river';
}

function prioStroke(prio: LanePrioState): string {
  if (prio === 'ally') return '#38bdf8';
  if (prio === 'enemy') return '#f87171';
  if (prio === 'even') return '#94a3b8';
  return '#475569';
}

/**
 * Desenho esquemático ORIGINAL e 100% ESTÁTICO para ilustrar o plano pré-jogo ou um cenário de treino.
 * Não recebe estado ao vivo de partida nem altera recomendações durante o jogo.
 */
export function TacticalMapSvg({
  focusSide,
  suggestedStart,
  compact = false,
  trainingOverlay,
}: {
  focusSide: 'top' | 'mid' | 'bot' | 'balanced';
  suggestedStart?: string;
  compact?: boolean;
  trainingOverlay?: TrainingMapOverlay;
}) {
  const width = compact ? 240 : trainingOverlay ? 310 : 280;
  const height = compact ? 156 : trainingOverlay ? 250 : 185;

  const isTopFocus = focusSide === 'top';
  const isBotFocus = focusSide === 'bot';
  const isMidFocus = focusSide === 'mid' || focusSide === 'balanced';

  const topColor = trainingOverlay
    ? prioStroke(trainingOverlay.topPrio)
    : isTopFocus
      ? '#38bdf8'
      : '#334155';
  const midColor = trainingOverlay
    ? prioStroke(trainingOverlay.midPrio)
    : isMidFocus
      ? '#fbbf24'
      : '#334155';
  const botColor = trainingOverlay
    ? prioStroke(trainingOverlay.botPrio)
    : isBotFocus
      ? '#f87171'
      : '#334155';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <svg
        viewBox="0 0 260 210"
        width={width}
        height={height}
        role="img"
        aria-label="Mapa esquemático estático de Summoner's Rift"
        style={{
          width: '100%',
          maxWidth: width,
          height: 'auto',
          background: '#0b1420',
          border: '1px solid #263954',
          borderRadius: 10,
          display: 'block',
        }}
      >
        <defs>
          <linearGradient id="sr-bg" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#0f2329" />
            <stop offset="50%" stopColor="#132620" />
            <stop offset="100%" stopColor="#1e1c24" />
          </linearGradient>
          <linearGradient id="sr-river" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#174569" />
            <stop offset="100%" stopColor="#0e3454" />
          </linearGradient>
        </defs>

        {/* Fundo estilizado da selva */}
        <rect x="0" y="0" width="260" height="210" rx="10" fill="url(#sr-bg)" />

        {/* Quadrantes de vegetação da selva */}
        <polygon points="36,162 36,52 114,104" fill="#183226" opacity="0.85" />
        <polygon points="62,32 198,32 146,88" fill="#1d3528" opacity="0.78" />
        <polygon points="146,122 224,178 62,178" fill="#183226" opacity="0.82" />
        <polygon points="224,52 224,158 150,104" fill="#1e3127" opacity="0.78" />

        {/* Rio diagonal */}
        <path
          d="M 42 30 Q 130 105 218 180"
          fill="none"
          stroke="url(#sr-river)"
          strokeWidth="22"
          strokeLinecap="round"
          opacity="0.92"
        />

        {/* Lanes (Top, Bot, Mid) */}
        <path
          d="M 24 184 L 24 24 L 236 24"
          fill="none"
          stroke={topColor}
          strokeWidth={isTopFocus ? 8 : 6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
        <path
          d="M 24 184 L 236 184 L 236 24"
          fill="none"
          stroke={botColor}
          strokeWidth={isBotFocus ? 8 : 6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
        <path
          d="M 30 178 L 230 30"
          fill="none"
          stroke={midColor}
          strokeWidth={isMidFocus ? 7 : 5.5}
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* Base Aliada (azul) e Inimiga (vermelha) */}
        <circle cx="24" cy="184" r="11" fill="#1d4ed8" stroke="#60a5fa" strokeWidth="2" />
        <circle cx="236" cy="24" r="11" fill="#991b1b" stroke="#f87171" strokeWidth="2" />

        {/* Rota pré-jogo planejada (quando não está em modo trainingOverlay) */}
        {!trainingOverlay ? (
          isTopFocus ? (
            <path
              d="M 118 162 Q 74 128 56 54"
              fill="none"
              stroke="#34d399"
              strokeWidth="3.5"
              strokeDasharray="6 4"
            />
          ) : isBotFocus ? (
            <path
              d="M 74 62 Q 112 126 178 162"
              fill="none"
              stroke="#34d399"
              strokeWidth="3.5"
              strokeDasharray="6 4"
            />
          ) : (
            <path
              d="M 88 144 Q 124 108 150 78"
              fill="none"
              stroke="#34d399"
              strokeWidth="3.5"
              strokeDasharray="6 4"
            />
          )
        ) : null}

        {/* Covis de Objetivos */}
        <circle
          cx="92"
          cy="72"
          r={trainingOverlay?.objectiveType === 'voidgrubs' || trainingOverlay?.objectiveType === 'herald' || trainingOverlay?.objectiveType === 'baron' ? 9 : 6}
          fill={
            trainingOverlay?.objectiveType === 'voidgrubs' ||
            trainingOverlay?.objectiveType === 'herald' ||
            trainingOverlay?.objectiveType === 'baron'
              ? '#a855f7'
              : '#334155'
          }
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />
        <circle
          cx="168"
          cy="138"
          r={trainingOverlay?.objectiveType === 'dragon' ? 9 : 6}
          fill={trainingOverlay?.objectiveType === 'dragon' ? '#f59e0b' : '#334155'}
          stroke="#fde68a"
          strokeWidth="1.5"
        />

        {/* Pílulas de rótulos das rotas (estilo mockup) */}
        <g>
          <rect x="40" y="12" width="40" height="17" rx="6" fill="#0f172a" stroke="#334155" />
          <text x="60" y="24" textAnchor="middle" fill="#e2e8f0" fontSize="9.5" fontWeight="700">
            Topo
          </text>
        </g>

        <g>
          <rect x="108" y="95" width="38" height="17" rx="6" fill="#0f172a" stroke="#334155" />
          <text x="127" y="107" textAnchor="middle" fill="#e2e8f0" fontSize="9.5" fontWeight="700">
            Mid
          </text>
        </g>

        <g>
          <rect x="182" y="175" width="38" height="17" rx="6" fill="#0f172a" stroke={botColor} />
          <text x="201" y="187" textAnchor="middle" fill="#e2e8f0" fontSize="9.5" fontWeight="700">
            Bot
          </text>
        </g>

        {/* Marcador JG aliado e JG inimigo no modo Treino */}
        {trainingOverlay ? (
          <>
            <g>
              <rect x="44" y="114" width="36" height="17" rx="6" fill="#0c263a" stroke="#38bdf8" />
              <text x="62" y="126" textAnchor="middle" fill="#7dd3fc" fontSize="9.5" fontWeight="700">
                Kayn
              </text>
            </g>

            {trainingOverlay.enemyJg === 'unknown' ? (
              <g>
                <rect x="150" y="48" width="54" height="17" rx="6" fill="#2b171b" stroke="#f87171" strokeDasharray="3 2" />
                <text x="177" y="60" textAnchor="middle" fill="#fca5a5" fontSize="9" fontWeight="700">
                  JG ?
                </text>
              </g>
            ) : trainingOverlay.enemyJg === 'top_side' ? (
              <g>
                <rect x="102" y="34" width="52" height="17" rx="6" fill="#3b1219" stroke="#f87171" />
                <text x="128" y="46" textAnchor="middle" fill="#fecaca" fontSize="9" fontWeight="700">
                  JG Top
                </text>
              </g>
            ) : trainingOverlay.enemyJg === 'bot_side' ? (
              <g>
                <rect x="166" y="148" width="52" height="17" rx="6" fill="#3b1219" stroke="#f87171" />
                <text x="192" y="160" textAnchor="middle" fill="#fecaca" fontSize="9" fontWeight="700">
                  JG Bot
                </text>
              </g>
            ) : null}

            {trainingOverlay.objectiveType === 'dragon' ? (
              <text x="168" y="125" textAnchor="middle" fill="#fde68a" fontSize="8.5" fontWeight="700">
                Dragão
              </text>
            ) : trainingOverlay.objectiveType !== 'none' ? (
              <text x="92" y="59" textAnchor="middle" fill="#e9d5ff" fontSize="8.5" fontWeight="700">
                {trainingOverlay.objectiveType === 'voidgrubs' ? 'Vastilarvas' : trainingOverlay.objectiveType === 'herald' ? 'Arauto' : 'Barão'}
              </text>
            ) : null}
          </>
        ) : (
          <>
            <text x="92" y="61" textAnchor="middle" fill="#94a3b8" fontSize="8">
              Vast/Arauto
            </text>
            <text x="168" y="155" textAnchor="middle" fill="#94a3b8" fontSize="8">
              Dragão
            </text>
          </>
        )}
      </svg>

      {suggestedStart ? (
        <div className="small-text muted-text" style={{ maxWidth: width }}>
          {suggestedStart}
        </div>
      ) : null}
    </div>
  );
}
