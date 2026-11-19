/**
 * Desenho esquemático ORIGINAL e 100% ESTÁTICO para ilustrar o plano pré-jogo.
 * Não recebe estado ao vivo de partida nem altera recomendações durante o jogo.
 */
export function TacticalMapSvg({
  focusSide,
  suggestedStart,
  compact = false,
}: {
  focusSide: 'top' | 'mid' | 'bot' | 'balanced';
  suggestedStart: string;
  compact?: boolean;
}) {
  const width = compact ? 220 : 280;
  const height = compact ? 150 : 185;

  const isTopFocus = focusSide === 'top';
  const isBotFocus = focusSide === 'bot';
  const isMidFocus = focusSide === 'mid' || focusSide === 'balanced';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        alignItems: 'flex-start',
      }}
    >
      <svg
        viewBox="0 0 240 180"
        width={width}
        height={height}
        role="img"
        aria-label="Mapa esquemático estático do plano pré-jogo"
        style={{
          background: '#090e18',
          border: '1px solid #25344e',
          borderRadius: 8,
        }}
      >
        {/* Fundo de lanes estilizadas */}
        <path
          d="M 24 156 L 24 24 L 216 24"
          fill="none"
          stroke={isTopFocus ? '#38bdf8' : '#2a3a56'}
          strokeWidth={isTopFocus ? 6 : 4}
          strokeLinecap="round"
        />
        <path
          d="M 24 156 L 216 156 L 216 24"
          fill="none"
          stroke={isBotFocus ? '#f87171' : '#2a3a56'}
          strokeWidth={isBotFocus ? 6 : 4}
          strokeLinecap="round"
        />
        <path
          d="M 28 152 L 212 28"
          fill="none"
          stroke={isMidFocus ? '#fbbf24' : '#2a3a56'}
          strokeWidth={isMidFocus ? 5 : 3.5}
          strokeLinecap="round"
        />

        {/* Rio diagonal estático */}
        <path
          d="M 48 36 Q 120 90 192 144"
          fill="none"
          stroke="#193b60"
          strokeWidth="12"
          strokeLinecap="round"
          opacity="0.7"
        />

        {/* Setas estáticas da rota planejada antes da partida */}
        {isTopFocus ? (
          <path
            d="M 118 140 Q 82 110 62 46"
            fill="none"
            stroke="#34d399"
            strokeWidth="3"
            strokeDasharray="5 4"
          />
        ) : isBotFocus ? (
          <path
            d="M 78 56 Q 108 106 168 140"
            fill="none"
            stroke="#34d399"
            strokeWidth="3"
            strokeDasharray="5 4"
          />
        ) : (
          <path
            d="M 86 124 Q 116 92 142 66"
            fill="none"
            stroke="#34d399"
            strokeWidth="3"
            strokeDasharray="5 4"
          />
        )}

        {/* Zonas esquemáticas */}
        <circle cx="88" cy="64" r="6" fill="#64748b" />
        <circle cx="152" cy="116" r="6" fill="#64748b" />
        <text x="14" y="18" fill="#94a3b8" fontSize="10" fontWeight="700">
          TOP
        </text>
        <text x="108" y="84" fill="#e2e8f0" fontSize="10" fontWeight="700">
          MID
        </text>
        <text x="196" y="168" fill="#94a3b8" fontSize="10" fontWeight="700">
          BOT
        </text>
        <text x="58" y="54" fill="#94a3b8" fontSize="8">
          Vast/Arauto
        </text>
        <text x="140" y="132" fill="#94a3b8" fontSize="8">
          Dragão
        </text>
      </svg>
      <div className="small-text muted-text" style={{ maxWidth: width }}>
        <strong>Rota estática pré-jogo:</strong> {suggestedStart}
      </div>
    </div>
  );
}
