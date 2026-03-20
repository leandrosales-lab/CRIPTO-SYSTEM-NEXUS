import { useState, useMemo, useCallback } from 'react';
import { useStore, Trade } from '../../store/useStore';
import { AnimatePresence, motion } from 'framer-motion';

// ─── Paleta Stitch ────────────────────────────────────────────────────────────
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

// ─── Cores por agente ─────────────────────────────────────────────────────────
const ROBOT_COLORS: Record<string, { text: string; glow: string }> = {
  nexus:   { text: '#4cd6ff',  glow: 'rgba(76,214,255,0.8)' },
  phantom: { text: '#ffd1d5',  glow: 'rgba(255,209,213,0.8)' },
  oracle:  { text: '#fbbf24',  glow: 'rgba(251,191,36,0.8)' },
  radar:   { text: '#a78bfa',  glow: 'rgba(167,139,250,0.8)' },
};

function getRobotColor(robotId: string) {
  return ROBOT_COLORS[robotId.toLowerCase()] ?? { text: C.dim, glow: 'rgba(187,201,207,0.5)' };
}

// ─── Utilitários ──────────────────────────────────────────────────────────────
function fmtPrice(price?: number): string {
  if (!price) return '—';
  if (price > 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (price > 1)    return price.toFixed(2);
  return price.toFixed(4);
}

function fmtDate(ts?: number): { date: string; time: string } {
  if (!ts) return { date: '—', time: '—' };
  const d = new Date(ts);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  const time = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return { date, time };
}

function fmtDuration(openTime?: number, closeTime?: number): string {
  if (!openTime || !closeTime) return '—';
  const ms  = closeTime - openTime;
  const s   = Math.floor(ms / 1000);
  const m   = Math.floor(s / 60);
  const h   = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// ─── Badge Direção ────────────────────────────────────────────────────────────
function DirectionBadge({ direction }: { direction: 'LONG' | 'SHORT' }) {
  const isLong = direction === 'LONG';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        background: isLong ? 'rgba(0,226,151,0.1)' : 'rgba(255,180,171,0.1)',
        border: `1px solid ${isLong ? 'rgba(0,226,151,0.25)' : 'rgba(255,180,171,0.25)'}`,
        color: isLong ? C.green : C.red,
      }}
    >
      {direction}
    </span>
  );
}

// ─── Badge Motivo ─────────────────────────────────────────────────────────────
function ReasonBadge({ reason }: { reason?: string }) {
  if (!reason || reason === '—') return <span style={{ color: C.outline, fontSize: 10 }}>—</span>;
  const styles: Record<string, { bg: string; border: string; color: string }> = {
    tp:       { bg: 'rgba(0,226,151,0.1)',   border: 'rgba(0,226,151,0.25)',   color: C.green },
    sl:       { bg: 'rgba(255,180,171,0.1)', border: 'rgba(255,180,171,0.25)', color: C.red },
    trailing: { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)',  color: '#fbbf24' },
    manual:   { bg: 'rgba(187,201,207,0.1)', border: 'rgba(187,201,207,0.2)',  color: C.dim },
  };
  const s = styles[reason.toLowerCase()] ?? styles.manual;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 7px',
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
      }}
    >
      {reason === 'trailing' ? '⟳ TRAIL' : reason.toUpperCase()}
    </span>
  );
}

// ─── Linha expandida ──────────────────────────────────────────────────────────
function ExpandedRow({ trade }: { trade: Trade }) {
  const { date: od, time: ot } = fmtDate(trade.openTime);
  const { date: cd, time: ct } = fmtDate(trade.closeTime);
  const duration = fmtDuration(trade.openTime, trade.closeTime);

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={{ background: 'rgba(11,14,17,0.6)' }}
    >
      <td colSpan={8} style={{ padding: '0 24px 16px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 20,
            background: C.surface,
            border: `1px solid ${C.outline}`,
            borderRadius: 8,
            padding: '14px 20px',
          }}
        >
          {/* Preços */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.outline, marginBottom: 4 }}>
              Execução
            </p>
            <p style={{ fontSize: 11, color: C.dim }}>
              <span style={{ color: C.outline }}>Entrada: </span>
              <span style={{ color: C.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${fmtPrice(trade.entryPrice)}</span>
            </p>
            <p style={{ fontSize: 11, color: C.dim }}>
              <span style={{ color: C.outline }}>Saída: </span>
              <span style={{ color: C.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{trade.exitPrice ? `$${fmtPrice(trade.exitPrice)}` : '—'}</span>
            </p>
            <p style={{ fontSize: 11, color: C.dim }}>
              <span style={{ color: C.outline }}>Tamanho: </span>
              <span style={{ color: C.text, fontWeight: 600 }}>{trade.size?.toFixed(4) ?? '—'}</span>
            </p>
          </div>

          {/* Timing */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.outline, marginBottom: 4 }}>
              Timing
            </p>
            <p style={{ fontSize: 11 }}>
              <span style={{ color: C.outline }}>Abertura: </span>
              <span style={{ color: C.text }}>{od} {ot}</span>
            </p>
            <p style={{ fontSize: 11 }}>
              <span style={{ color: C.outline }}>Fechamento: </span>
              <span style={{ color: C.text }}>{cd} {ct}</span>
            </p>
            <p style={{ fontSize: 11 }}>
              <span style={{ color: C.outline }}>Duração: </span>
              <span style={{ color: C.text, fontWeight: 600 }}>{duration}</span>
            </p>
          </div>

          {/* Engine State */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.outline, marginBottom: 4 }}>
              Engine State
            </p>
            <p style={{ fontSize: 11 }}>
              <span style={{ color: C.outline }}>Motivo: </span>
              <ReasonBadge reason={trade.reason} />
            </p>
            <p style={{ fontSize: 11 }}>
              <span style={{ color: C.outline }}>TP: </span>
              <span style={{ color: C.text }}>{trade.tpPrice ? `$${fmtPrice(trade.tpPrice)}` : '—'}</span>
            </p>
            <p style={{ fontSize: 11 }}>
              <span style={{ color: C.outline }}>SL: </span>
              <span style={{ color: C.text }}>{trade.slPrice ? `$${fmtPrice(trade.slPrice)}` : '—'}</span>
            </p>
          </div>

          {/* Confidence */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'flex-end' }}>
            <div
              style={{
                width: 4,
                height: 48,
                borderRadius: 999,
                overflow: 'hidden',
                background: 'rgba(76,214,255,0.12)',
              }}
            >
              <div style={{ height: '100%', background: C.primary, boxShadow: `0 0 10px rgba(76,214,255,0.4)` }} />
            </div>
            <div>
              <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.outline, marginBottom: 6 }}>
                Notional
              </p>
              <p style={{ fontSize: 20, fontWeight: 800, color: C.primary, fontFamily: "'Space Grotesk', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                ${trade.notional?.toFixed(2) ?? '—'}
              </p>
            </div>
          </div>
        </div>
      </td>
    </motion.tr>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface TradeHistoryProps {
  filterBot?:    string;
  filterPeriod?: string;
  filterPair?:   string;
  page?:         number;
  pageSize?:     number;
  onPageChange?: (page: number) => void;
  onTotalChange?: (total: number) => void;
}

// ─── Export CSV ───────────────────────────────────────────────────────────────
export function exportTradesCsv(trades: Trade[]) {
  const headers = [
    'ID', 'Timestamp', 'Bot', 'Par', 'Direção', 'Alavancagem',
    'Tamanho', 'Entrada', 'Saída', 'PnL', 'PnL%', 'Motivo',
    'TP', 'SL', 'Abertura', 'Fechamento', 'Duração (s)'
  ];

  const rows = trades.map(t => [
    t.id,
    t.closeTime ? new Date(t.closeTime).toISOString() : '',
    t.robotId,
    t.symbol,
    t.direction,
    t.leverage,
    t.size,
    t.entryPrice?.toFixed(4) ?? '',
    t.exitPrice?.toFixed(4) ?? '',
    t.pnl?.toFixed(4) ?? '',
    t.pnlPercent?.toFixed(4) ?? '',
    t.reason ?? '',
    t.tpPrice?.toFixed(4) ?? '',
    t.slPrice?.toFixed(4) ?? '',
    t.openTime  ? new Date(t.openTime).toISOString()  : '',
    t.closeTime ? new Date(t.closeTime).toISOString() : '',
    t.openTime && t.closeTime ? Math.floor((t.closeTime - t.openTime) / 1000) : '',
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `trade-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── TradeHistory ─────────────────────────────────────────────────────────────
export default function TradeHistory({
  filterBot    = 'all',
  filterPeriod = '30d',
  filterPair   = 'all',
  page         = 1,
  pageSize     = 25,
  onPageChange,
  onTotalChange,
}: TradeHistoryProps) {
  const tradeHistory = useStore(s => s.tradeHistory);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Filtrar ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const now    = Date.now();
    const cutoff: Record<string, number> = {
      '7d':  now - 7  * 864e5,
      '30d': now - 30 * 864e5,
      '90d': now - 90 * 864e5,
      'all': 0,
    };
    const cut = cutoff[filterPeriod] ?? 0;

    return tradeHistory
      .filter(t => t.status === 'closed')
      .filter(t => filterBot  === 'all' || t.robotId.toLowerCase() === filterBot.toLowerCase())
      .filter(t => filterPair === 'all' || t.symbol === filterPair)
      .filter(t => cut === 0 || (t.closeTime ?? 0) >= cut);
  }, [tradeHistory, filterBot, filterPeriod, filterPair]);

  // Notificar total
  useMemo(() => { onTotalChange?.(filtered.length); }, [filtered.length]);

  // ── Paginar ────────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(Math.max(1, page), totalPages);
  const paged      = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const headers = [
    { label: 'Timestamp',       align: 'left'   },
    { label: 'Bot',             align: 'left'   },
    { label: 'Asset Pair',      align: 'left'   },
    { label: 'Direction',       align: 'left'   },
    { label: 'Lev.',            align: 'center' },
    { label: 'Execution',       align: 'left'   },
    { label: 'Net PnL (USDT)',  align: 'right'  },
    { label: 'Action',          align: 'right'  },
  ];

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Tabela ── */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
        {paged.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 280,
              gap: 12,
              opacity: 0.45,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: C.outline }}>history</span>
            <span style={{ fontSize: 12, color: C.outline, fontFamily: 'Inter, sans-serif' }}>
              Nenhuma operação encontrada
            </span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(39,42,46,0.5)', borderBottom: `1px solid rgba(60,73,78,0.3)` }}>
                {headers.map(h => (
                  <th
                    key={h.label}
                    style={{
                      padding: '14px 24px',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: C.outline,
                      textAlign: h.align as 'left' | 'center' | 'right',
                      whiteSpace: 'nowrap',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {paged.map(trade => {
                  const pnl     = trade.pnl ?? 0;
                  const pnlPct  = trade.pnlPercent ?? 0;
                  const isWin   = pnl >= 0;
                  const pnlColor = isWin ? C.green : C.red;
                  const robot   = getRobotColor(trade.robotId);
                  const { date, time } = fmtDate(trade.closeTime);
                  const isExpanded = expandedId === trade.id;

                  return [
                    // ── Linha principal ──
                    <motion.tr
                      key={`row-${trade.id}`}
                      initial={{ opacity: 0, backgroundColor: isWin ? 'rgba(0,226,151,0.06)' : 'rgba(255,180,171,0.06)' }}
                      animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)' }}
                      transition={{ duration: 0.8 }}
                      onClick={() => toggleExpand(trade.id)}
                      style={{
                        borderBottom: isExpanded
                          ? 'none'
                          : `1px solid rgba(60,73,78,0.12)`,
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(39,42,46,0.35)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                      }}
                    >
                      {/* Timestamp */}
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: 'Inter, sans-serif' }}>
                            {date}, {time}
                          </span>
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: `${C.outline}99`, textTransform: 'uppercase' }}>
                            System Time
                          </span>
                        </div>
                      </td>

                      {/* Bot */}
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: robot.text,
                              boxShadow: `0 0 8px ${robot.glow}`,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              letterSpacing: '-0.01em',
                              color: robot.text,
                              fontFamily: "'Space Grotesk', sans-serif",
                              textTransform: 'capitalize',
                            }}
                          >
                            {trade.robotId}
                          </span>
                        </div>
                      </td>

                      {/* Par */}
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', color: C.text, fontFamily: 'Inter, sans-serif' }}>
                          {trade.symbol.replace('USDT', '')} / USDT
                        </span>
                      </td>

                      {/* Direção */}
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <DirectionBadge direction={trade.direction} />
                      </td>

                      {/* Alavancagem */}
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.outline, fontFamily: 'Inter, sans-serif' }}>
                          {trade.leverage ?? '—'}x
                        </span>
                      </td>

                      {/* Execução (preços) */}
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 9, color: C.outline }}>Entry:</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                              ${fmtPrice(trade.entryPrice)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 9, color: C.outline }}>Exit:</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                              {trade.exitPrice ? `$${fmtPrice(trade.exitPrice)}` : '—'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* PnL */}
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: pnlColor,
                              fontFamily: "'Space Grotesk', sans-serif",
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {isWin ? '+' : ''}${pnl.toFixed(2)}
                          </span>
                          <span style={{ fontSize: 10, color: `${pnlColor}CC`, fontVariantNumeric: 'tabular-nums' }}>
                            {isWin ? '+' : ''}{pnlPct.toFixed(2)}%
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <button
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: isExpanded ? C.primary : C.outline,
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            transition: 'color 0.15s',
                          }}
                          onClick={e => { e.stopPropagation(); toggleExpand(trade.id); }}
                          title={isExpanded ? 'Recolher' : 'Expandir detalhes'}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: 22, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                          >
                            expand_circle_right
                          </span>
                        </button>
                      </td>
                    </motion.tr>,

                    // ── Linha expandida ──
                    isExpanded && (
                      <AnimatePresence key={`exp-${trade.id}`}>
                        <ExpandedRow trade={trade} />
                      </AnimatePresence>
                    ),
                  ];
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {/* ── Paginação ── */}
      {filtered.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 24px',
            borderTop: `1px solid rgba(60,73,78,0.2)`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, color: `${C.dim}99`, fontFamily: 'Inter, sans-serif' }}>
            Exibindo{' '}
            <span style={{ color: C.text }}>
              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)}
            </span>{' '}
            de{' '}
            <span style={{ color: C.text }}>{filtered.length.toLocaleString()}</span>{' '}
            operações
          </span>

          <div style={{ display: 'flex', gap: 6 }}>
            {/* Prev */}
            <button
              disabled={safePage === 1}
              onClick={() => onPageChange?.(safePage - 1)}
              style={{
                width: 32, height: 32,
                borderRadius: 6,
                border: `1px solid ${C.outline}`,
                background: C.surface,
                color: safePage === 1 ? C.outline : C.text,
                cursor: safePage === 1 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: safePage === 1 ? 0.4 : 1,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
            </button>

            {/* Páginas */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (safePage <= 3) {
                pageNum = i + 1;
              } else if (safePage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = safePage - 2 + i;
              }
              const isActive = pageNum === safePage;
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange?.(pageNum)}
                  style={{
                    width: 32, height: 32,
                    borderRadius: 6,
                    border: isActive ? `1px solid rgba(76,214,255,0.4)` : `1px solid transparent`,
                    background: isActive ? 'rgba(76,214,255,0.15)' : C.surface,
                    color: isActive ? C.primary : C.text,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 400,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next */}
            <button
              disabled={safePage === totalPages}
              onClick={() => onPageChange?.(safePage + 1)}
              style={{
                width: 32, height: 32,
                borderRadius: 6,
                border: `1px solid ${C.outline}`,
                background: C.surface,
                color: safePage === totalPages ? C.outline : C.text,
                cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: safePage === totalPages ? 0.4 : 1,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
