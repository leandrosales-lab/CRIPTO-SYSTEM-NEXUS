import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';

const C = {
  bg:       '#0b0e11',
  surface:  '#1d2023',
  surface2: '#171a1d',
  primary:  '#4cd6ff',
  green:    '#00e297',
  red:      '#ffb4ab',
  amber:    '#fbbf24',
  text:     '#e1e2e7',
  dim:      '#bbc9cf',
  outline:  '#3c494e',
} as const;

const ROBOT_COLOR: Record<string, string> = {
  nexus:   '#4cd6ff',
  phantom: '#00e297',
  oracle:  '#ffd1d5',
  radar:   '#bbc9cf',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPrice(v: number) {
  if (!v) return '—';
  return v > 1000 ? v.toFixed(2) : v > 1 ? v.toFixed(4) : v.toFixed(6);
}

function fmtDuration(openTime: number, closeTime: number) {
  const ms = closeTime - openTime;
  const s  = Math.floor(ms / 1000);
  const m  = Math.floor(s / 60);
  const h  = Math.floor(m / 60);
  if (h > 0)  return `${h}h ${m % 60}m`;
  if (m > 0)  return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function fmtDateTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// Infere motivo da saída
function closeReason(trade: {
  trailingActive?: boolean;
  direction: string;
  exitPrice: number;
  tpPrice: number;
  slPrice: number;
}): 'TP' | 'SL' | 'TRAIL' | 'MANUAL' {
  if (trade.trailingActive) return 'TRAIL';
  const isLong = trade.direction === 'LONG';
  const hitTp  = isLong
    ? trade.exitPrice >= trade.tpPrice * 0.999
    : trade.exitPrice <= trade.tpPrice * 1.001;
  if (hitTp) return 'TP';
  const hitSl = isLong
    ? trade.exitPrice <= trade.slPrice * 1.001
    : trade.exitPrice >= trade.slPrice * 0.999;
  if (hitSl) return 'SL';
  return 'MANUAL';
}

function ReasonBadge({ reason }: { reason: 'TP' | 'SL' | 'TRAIL' | 'MANUAL' }) {
  const cfg = {
    TP:     { label: 'TAKE PROFIT', color: C.green,   bg: `${C.green}18`   },
    SL:     { label: 'STOP LOSS',   color: C.red,     bg: `${C.red}18`     },
    TRAIL:  { label: 'TRAIL STOP',  color: C.amber,   bg: `${C.amber}18`   },
    MANUAL: { label: 'MANUAL',      color: C.dim,     bg: `${C.outline}40` },
  }[reason];
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.1em',
        padding: '2px 7px',
        borderRadius: 4,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.color}40`,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
const PAGE_SIZE = 15;

export default function TradeHistoryTable() {
  const tradeHistory = useStore(s => s.tradeHistory);
  const [page, setPage]         = useState(0);
  const [filterRobot, setFilter] = useState('all');

  const closed = useMemo(() => {
    const all = tradeHistory
      .filter(t => t.status === 'closed' && t.exitPrice != null)
      .sort((a, b) => (b.closeTime ?? 0) - (a.closeTime ?? 0));
    return filterRobot === 'all' ? all : all.filter(t => t.robotId === filterRobot);
  }, [tradeHistory, filterRobot]);

  const totalPages = Math.max(1, Math.ceil(closed.length / PAGE_SIZE));
  const page_      = Math.min(page, totalPages - 1);
  const rows       = closed.slice(page_ * PAGE_SIZE, page_ * PAGE_SIZE + PAGE_SIZE);

  const thStyle: React.CSSProperties = {
    padding: '9px 14px',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    color: C.dim,
    whiteSpace: 'nowrap' as const,
    borderBottom: `1px solid ${C.outline}`,
    background: C.bg,
    textAlign: 'left' as const,
  };

  const robots = ['all', ...Array.from(new Set(tradeHistory.map(t => t.robotId)))];

  return (
    <section
      className="rounded-xl overflow-hidden"
      style={{ background: C.surface, border: `1px solid ${C.outline}30` }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: `1px solid ${C.outline}30`, background: C.bg }}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: C.primary }}>
            table_rows
          </span>
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: C.text,
            }}
          >
            Histórico de Trades
          </span>
          <span
            style={{
              padding: '1px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              background: `${C.primary}12`,
              border: `1px solid ${C.primary}30`,
              color: C.primary,
            }}
          >
            {closed.length}
          </span>
        </div>

        {/* Filtro por robô */}
        <div className="flex items-center gap-1">
          {robots.map(r => (
            <button
              key={r}
              onClick={() => { setFilter(r); setPage(0); }}
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                border: `1px solid ${filterRobot === r ? (ROBOT_COLOR[r] ?? C.primary) : C.outline}50`,
                background: filterRobot === r ? `${ROBOT_COLOR[r] ?? C.primary}18` : 'transparent',
                color: filterRobot === r ? (ROBOT_COLOR[r] ?? C.primary) : C.dim,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {r === 'all' ? 'TODOS' : r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabela ── */}
      <div style={{ overflowX: 'auto', scrollbarWidth: 'thin', scrollbarColor: `${C.outline} transparent` }}>
        {closed.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2 py-12"
            style={{ color: C.outline }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 32 }}>inbox</span>
            <span style={{ fontSize: 12, color: C.dim }}>Nenhum trade fechado ainda</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: "'Inter', monospace" }}>
            <thead>
              <tr>
                {['Data/Hora', 'Robô', 'Par', 'Direção', 'Entrada', 'Saída', 'TP', 'SL', 'Motivo', 'P&L', 'Duração'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t, idx) => {
                const reason    = closeReason(t as Parameters<typeof closeReason>[0]);
                const pnlPos    = (t.pnl ?? 0) >= 0;
                const robotColor = ROBOT_COLOR[t.robotId?.toLowerCase()] ?? C.dim;
                const isEven    = idx % 2 === 0;

                const td: React.CSSProperties = {
                  padding: '9px 14px',
                  whiteSpace: 'nowrap',
                  borderBottom: `1px solid ${C.outline}20`,
                  background: isEven ? C.surface : C.surface2,
                };

                return (
                  <tr key={t.id} style={{ transition: 'background 0.15s' }}>
                    {/* Data/Hora */}
                    <td style={{ ...td, color: C.dim, fontSize: 10 }}>
                      {fmtDateTime(t.closeTime ?? t.openTime)}
                    </td>

                    {/* Robô */}
                    <td style={{ ...td, color: robotColor, fontWeight: 700, fontSize: 10, letterSpacing: '0.08em' }}>
                      {t.robotId?.toUpperCase()}
                    </td>

                    {/* Par */}
                    <td style={{ ...td, fontWeight: 700 }}>
                      <span style={{ color: C.text }}>{t.symbol.replace('USDT', '')}</span>
                      <span style={{ color: C.outline, fontWeight: 400 }}>/USDT</span>
                    </td>

                    {/* Direção */}
                    <td style={td}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                        background: t.direction === 'LONG' ? `${C.green}18` : `${C.red}18`,
                        color: t.direction === 'LONG' ? C.green : C.red,
                        border: `1px solid ${t.direction === 'LONG' ? C.green : C.red}40`,
                      }}>
                        {t.direction}
                      </span>
                    </td>

                    {/* Entrada */}
                    <td style={{ ...td, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                      ${fmtPrice(t.entryPrice)}
                    </td>

                    {/* Saída */}
                    <td style={{ ...td, color: pnlPos ? C.green : C.red, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      ${fmtPrice(t.exitPrice ?? 0)}
                    </td>

                    {/* TP */}
                    <td style={{ ...td, color: C.green, fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>
                      ${fmtPrice(t.tpPrice)}
                    </td>

                    {/* SL */}
                    <td style={{ ...td, color: C.red, fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>
                      {t.trailingStop ? (
                        <span style={{ color: C.amber }}>TRAIL</span>
                      ) : (
                        `$${fmtPrice(t.slPrice)}`
                      )}
                    </td>

                    {/* Motivo */}
                    <td style={td}>
                      <ReasonBadge reason={reason} />
                    </td>

                    {/* P&L */}
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ fontWeight: 700, color: pnlPos ? C.green : C.red }}>
                        {pnlPos ? '+' : ''}${Math.abs(t.pnl ?? 0).toFixed(4)}
                      </span>
                      <span style={{ fontSize: 9, color: pnlPos ? `${C.green}99` : `${C.red}99`, marginLeft: 4 }}>
                        ({(t.pnlPercent ?? 0) >= 0 ? '+' : ''}{(t.pnlPercent ?? 0).toFixed(2)}%)
                      </span>
                    </td>

                    {/* Duração */}
                    <td style={{ ...td, color: C.dim, fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
                      {t.closeTime ? fmtDuration(t.openTime, t.closeTime) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Paginação ── */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: `1px solid ${C.outline}30`, background: C.bg }}
        >
          <span style={{ fontSize: 10, color: C.dim }}>
            {page_ * PAGE_SIZE + 1}–{Math.min((page_ + 1) * PAGE_SIZE, closed.length)} de {closed.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page_ === 0}
              style={{
                padding: '4px 10px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                background: 'transparent', border: `1px solid ${C.outline}`,
                color: page_ === 0 ? C.outline : C.dim, cursor: page_ === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page_ === totalPages - 1}
              style={{
                padding: '4px 10px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                background: 'transparent', border: `1px solid ${C.outline}`,
                color: page_ === totalPages - 1 ? C.outline : C.dim,
                cursor: page_ === totalPages - 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
