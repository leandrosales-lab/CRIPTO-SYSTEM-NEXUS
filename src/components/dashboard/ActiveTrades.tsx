import { useStore } from '../../store/useStore';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import axios from 'axios';

// ─── Paleta MD dark ───────────────────────────────────────────────────────────
const C = {
  bg:          '#111417',
  surface:     '#1d2023',
  surfaceHigh: '#272a2e',
  primary:     '#4cd6ff',
  green:       '#00e297',
  red:         '#ffb4ab',
  text:        '#e1e2e7',
  dim:         '#bbc9cf',
  outline:     '#3c494e',
} as const;

// Cor por robô (uppercase key)
const ROBOT_COLORS: Record<string, string> = {
  nexus:   '#4cd6ff',
  phantom: '#00e297',
  oracle:  '#ffd1d5',
  radar:   '#bbc9cf',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPrice(price: number) {
  if (!price) return '—';
  return price > 1000
    ? price.toFixed(2)
    : price > 1
    ? price.toFixed(4)
    : price.toFixed(6);
}

function fmtTime(ts: number) {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function TradeTimer({ openTime }: { openTime: number }) {
  const [elapsed, setElapsed] = useState(Date.now() - openTime);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - openTime), 1000);
    return () => clearInterval(t);
  }, [openTime]);
  const s = Math.floor(elapsed / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return <span>{h}h{(m % 60).toString().padStart(2, '0')}m</span>;
  if (m > 0) return <span>{m}m{(s % 60).toString().padStart(2, '0')}s</span>;
  return <span>{s}s</span>;
}

function UnrealizedPnl({
  trade,
  currentPrice,
}: {
  trade: { direction: string; entryPrice: number; notional: number; size: number };
  currentPrice: number;
}) {
  if (!currentPrice)
    return <span style={{ color: C.outline }}>—</span>;

  const priceDiff =
    trade.direction === 'LONG'
      ? currentPrice - trade.entryPrice
      : trade.entryPrice - currentPrice;
  const TAKER_FEE = 0.0004;
  const fee = trade.notional * TAKER_FEE * 2;
  const pnl = trade.notional * (priceDiff / trade.entryPrice) - fee;
  const pct = (pnl / trade.size) * 100;
  const isPos = pnl >= 0;

  return (
    <span
      style={{
        color: isPos ? C.green : C.red,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {isPos ? '+' : ''}
      {pnl.toFixed(4)}
      <span
        style={{ fontSize: 9, opacity: 0.7, marginLeft: 4, fontWeight: 400 }}
      >
        ({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)
      </span>
    </span>
  );
}

function CloseButton({ tradeId }: { tradeId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading || done) return;
    setLoading(true);
    try {
      await axios.post(`/api/trade/${tradeId}/close`);
      setDone(true);
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClose}
      disabled={loading || done}
      title="Fechar trade"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: 4,
        border: `1px solid ${done ? C.green + '55' : C.red + '44'}`,
        background: done ? C.green + '14' : C.red + '14',
        color: done ? C.green : C.red,
        cursor: loading || done ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.5 : 1,
        transition: 'all 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 14, lineHeight: 1 }}
      >
        {loading ? 'hourglass_empty' : done ? 'check' : 'close'}
      </span>
    </button>
  );
}

function ActionBadge({ direction }: { direction: string }) {
  const isLong = direction === 'LONG';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        background: isLong ? C.green + '18' : C.red + '18',
        color: isLong ? C.green : C.red,
        border: `1px solid ${isLong ? C.green + '44' : C.red + '44'}`,
      }}
    >
      {isLong ? 'COMPRADO' : 'VENDIDO'}
    </span>
  );
}

// ─── Cabeçalhos ───────────────────────────────────────────────────────────────
const COL_HEADERS = [
  'Horário',
  'Agente',
  'Par',
  'Ação',
  'Quantidade',
  'TP / SL',
  'Tempo',
  'PNL',
  '',
];

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: C.dim,
  whiteSpace: 'nowrap',
  borderBottom: `1px solid ${C.outline}`,
  background: '#0b0e11',
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ActiveTrades() {
  const activeTrades = useStore(s => s.activeTrades);
  const marketTicks  = useStore(s => s.marketTicks);
  const utilPct      = (activeTrades.length / 20) * 100;

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        overflow: 'hidden',
        background: C.surface,
        border: `1px solid ${C.outline}`,
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: `1px solid ${C.outline}`,
          flexShrink: 0,
          background: '#0b0e11',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 16, color: C.primary }}
          >
            history
          </span>
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: C.text,
            }}
          >
            Registro de Ordens em Tempo Real
          </span>
          <span
            style={{
              padding: '1px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              background:
                activeTrades.length > 15
                  ? 'rgba(255,180,171,0.12)'
                  : 'rgba(76,214,255,0.1)',
              border: `1px solid ${
                activeTrades.length > 15
                  ? C.red + '55'
                  : C.primary + '44'
              }`,
              color:
                activeTrades.length > 15 ? C.red : C.primary,
            }}
          >
            {activeTrades.length}/20
          </span>
        </div>

        {/* Barra de utilização */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 9,
              color: C.dim,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            utilização
          </span>
          <div
            style={{
              width: 80,
              height: 4,
              borderRadius: 99,
              background: C.outline,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                borderRadius: 99,
                width: `${utilPct}%`,
                transition: 'width 0.5s ease',
                background:
                  utilPct > 75
                    ? `linear-gradient(90deg, ${C.red}, #ff6b6b)`
                    : `linear-gradient(90deg, ${C.primary}, ${C.green})`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Tabela ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: `${C.outline} transparent`,
        }}
      >
        {activeTrades.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 120,
              gap: 8,
              color: C.outline,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 32, color: C.outline }}
            >
              inbox
            </span>
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                color: C.dim,
                letterSpacing: '0.1em',
              }}
            >
              Nenhuma ordem ativa
            </span>
            <span
              style={{
                fontSize: 10,
                color: C.outline,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Inicie um agente para começar a operar
            </span>
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: "'Inter', monospace",
              fontSize: 11,
            }}
          >
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                {COL_HEADERS.map((h, i) => (
                  <th key={i} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {activeTrades.map((trade, idx) => {
                  const robotColor =
                    ROBOT_COLORS[trade.robotId?.toLowerCase()] || C.dim;
                  const currentPrice =
                    marketTicks[trade.symbol]?.price || 0;
                  const isEven = idx % 2 === 0;

                  const tdStyle: React.CSSProperties = {
                    padding: '10px 16px',
                    whiteSpace: 'nowrap',
                    borderBottom: `1px solid ${C.outline}30`,
                    background: isEven ? '#1d2023' : '#171a1d',
                  };

                  return (
                    <motion.tr
                      key={trade.id}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.18 }}
                    >
                      {/* Horário */}
                      <td style={{ ...tdStyle, color: C.dim, fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>
                        {fmtTime(trade.openTime)}
                      </td>

                      {/* Agente */}
                      <td
                        style={{
                          ...tdStyle,
                          color: robotColor,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          fontSize: 11,
                        }}
                      >
                        {trade.robotId}
                      </td>

                      {/* Par */}
                      <td style={{ ...tdStyle, fontWeight: 700 }}>
                        <span style={{ color: C.text }}>
                          {trade.symbol.replace('USDT', '')}
                        </span>
                        <span style={{ color: C.outline, fontWeight: 400 }}>
                          {' '}/{' '}USDT
                        </span>
                      </td>

                      {/* Ação */}
                      <td style={tdStyle}>
                        <ActionBadge direction={trade.direction} />
                      </td>

                      {/* Quantidade (notional) */}
                      <td
                        style={{
                          ...tdStyle,
                          color: C.dim,
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: 10,
                        }}
                      >
                        ${fmtPrice(trade.notional)}
                        <span
                          style={{
                            marginLeft: 4,
                            fontSize: 9,
                            color: C.outline,
                          }}
                        >
                          ×{trade.leverage}
                        </span>
                      </td>

                      {/* TP / SL */}
                      <td style={{ ...tdStyle, fontSize: 10 }}>
                        <span style={{ color: C.green }}>
                          ${fmtPrice(trade.tpPrice)}
                        </span>
                        <span style={{ color: C.outline, margin: '0 4px' }}>
                          /
                        </span>
                        {trade.trailingActive ? (
                          <span style={{ color: '#fbbf24' }}>
                            ⟳${fmtPrice(trade.trailingStopPrice)}
                          </span>
                        ) : (
                          <span style={{ color: C.red }}>
                            ${fmtPrice(trade.slPrice)}
                            {trade.trailingStop && (
                              <span
                                style={{
                                  fontSize: 8,
                                  color: C.outline,
                                  marginLeft: 3,
                                }}
                              >
                                TRAIL
                              </span>
                            )}
                          </span>
                        )}
                      </td>

                      {/* Tempo */}
                      <td
                        style={{
                          ...tdStyle,
                          color: C.outline,
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: 10,
                        }}
                      >
                        <TradeTimer openTime={trade.openTime} />
                      </td>

                      {/* PNL */}
                      <td style={{ ...tdStyle, fontSize: 11 }}>
                        <UnrealizedPnl
                          trade={trade}
                          currentPrice={currentPrice}
                        />
                      </td>

                      {/* Fechar */}
                      <td
                        style={{
                          ...tdStyle,
                          paddingLeft: 8,
                          paddingRight: 12,
                        }}
                      >
                        <CloseButton tradeId={trade.id} />
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
