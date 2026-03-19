import { useStore } from '../../store/useStore';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import axios from 'axios';

function TradeTimer({ openTime }: { openTime: number }) {
  const [elapsed, setElapsed] = useState(Date.now() - openTime);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - openTime), 1000);
    return () => clearInterval(t);
  }, [openTime]);
  const s = Math.floor(elapsed / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return <span>{h}h{(m % 60).toString().padStart(2,'0')}m</span>;
  if (m > 0) return <span>{m}m{(s % 60).toString().padStart(2,'0')}s</span>;
  return <span>{s}s</span>;
}

function UnrealizedPnl({ trade, currentPrice }: { trade: { direction: string; entryPrice: number; notional: number; size: number }; currentPrice: number }) {
  if (!currentPrice) return <span style={{ color: '#334155' }}>—</span>;
  const priceDiff = trade.direction === 'LONG'
    ? currentPrice - trade.entryPrice
    : trade.entryPrice - currentPrice;
  const TAKER_FEE = 0.0004;
  const fee  = trade.notional * TAKER_FEE * 2;
  const pnl  = trade.notional * (priceDiff / trade.entryPrice) - fee;
  const pct  = (pnl / trade.size) * 100;
  const isPos = pnl >= 0;
  return (
    <span style={{ color: isPos ? '#10B981' : '#EF4444', fontWeight: 700 }}>
      {isPos ? '+' : ''}{pnl.toFixed(4)}
      <span style={{ fontSize: 8, opacity: 0.65, marginLeft: 3 }}>({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)</span>
    </span>
  );
}

function CloseButton({ tradeId }: { tradeId: string }) {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading || done) return;
    setLoading(true);
    try { await axios.post(`/api/trade/${tradeId}/close`); setDone(true); }
    catch { setLoading(false); }
  };

  return (
    <button
      onClick={handleClose}
      disabled={loading || done}
      className="px-2.5 py-1 rounded-md font-mono uppercase tracking-wider transition-all disabled:opacity-40"
      style={{
        fontSize: 8, fontWeight: 700, fontFamily: "'JetBrains Mono'",
        background: done ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.08)',
        border:     done ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(244,63,94,0.35)',
        color:      done ? '#10B981' : '#EF4444',
        cursor:     loading || done ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? '···' : done ? '✓' : 'Fechar'}
    </button>
  );
}

const ROBOT_COLORS: Record<string, string> = {
  phantom: '#22D3EE', nexus: '#34D399', oracle: '#FBBF24', radar: '#8B5CF6',
};

function fmtPrice(price: number) {
  if (!price) return '—';
  return price > 1000 ? price.toFixed(2) : price > 1 ? price.toFixed(4) : price.toFixed(6);
}

const COL_HEADERS = ['Robô', 'Par', 'Dir', 'Entrada', 'Atual', 'P&L Não Realizado', 'TP', 'SL / Trail', 'Tempo', ''];

export default function ActiveTrades() {
  const activeTrades = useStore(s => s.activeTrades);
  const marketTicks  = useStore(s => s.marketTicks);
  const utilPct      = (activeTrades.length / 20) * 100;

  return (
    <div
      className="flex-1 h-full flex flex-col rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Header bar */}
      <div
        className="px-4 py-2.5 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(34,211,238,0.07)', background: 'rgba(0,0,0,0.2)' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#94A3B8' }}>
            Posições Abertas
          </span>
          <span
            className="chip"
            style={{
              background: activeTrades.length > 15 ? 'rgba(245,158,11,0.1)' : 'rgba(34,211,238,0.07)',
              border:     activeTrades.length > 15 ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(34,211,238,0.18)',
              color:      activeTrades.length > 15 ? '#F59E0B' : '#22D3EE',
              fontSize: 8,
            }}
          >
            {activeTrades.length}/20
          </span>
        </div>
        {/* Utilization bar */}
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, color: '#334155' }}>utilização</span>
          <div
            className="w-24 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${utilPct}%`,
                background: utilPct > 75
                  ? 'linear-gradient(90deg, #d97706, #FBBF24)'
                  : 'linear-gradient(90deg, #0e7490, #22D3EE)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(34,211,238,0.12) transparent' }}>
        {activeTrades.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">◉</div>
            <div className="empty-state-text">Nenhuma posição aberta</div>
            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: '#1E293B' }}>
              Inicie um robô para começar a operar
            </div>
          </div>
        ) : (
          <table className="w-full" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
            <thead className="sticky top-0" style={{ background: 'rgba(5,7,15,0.98)' }}>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {COL_HEADERS.map(h => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left font-normal whitespace-nowrap"
                    style={{ fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#334155' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {activeTrades.map(trade => {
                  const accent      = ROBOT_COLORS[trade.robotId] || '#94A3B8';
                  const currentPrice = marketTicks[trade.symbol]?.price || 0;
                  const isLong       = trade.direction === 'LONG';
                  return (
                    <motion.tr
                      key={trade.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      className="trade-row"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    >
                      {/* Robô */}
                      <td className="px-3 py-2 font-bold uppercase" style={{ color: accent, fontSize: 10, letterSpacing: '0.06em' }}>
                        {trade.robotId}
                      </td>
                      {/* Par */}
                      <td className="px-3 py-2 font-bold" style={{ color: '#E2E8F0' }}>
                        {trade.symbol.replace('USDT', '')}<span style={{ color: '#334155', fontWeight: 400 }}>/USDT</span>
                      </td>
                      {/* Dir */}
                      <td className="px-3 py-2 font-bold" style={{ color: isLong ? '#10B981' : '#EF4444' }}>
                        {isLong ? '▲ LONG' : '▼ SHORT'}
                      </td>
                      {/* Entrada */}
                      <td className="px-3 py-2 tabular-nums" style={{ color: '#94A3B8' }}>
                        ${fmtPrice(trade.entryPrice)}
                      </td>
                      {/* Atual */}
                      <td className="px-3 py-2 tabular-nums font-semibold" style={{ color: '#E2E8F0' }}>
                        {currentPrice > 0 ? `$${fmtPrice(currentPrice)}` : '—'}
                      </td>
                      {/* P&L */}
                      <td className="px-3 py-2">
                        <UnrealizedPnl trade={trade} currentPrice={currentPrice} />
                      </td>
                      {/* TP */}
                      <td className="px-3 py-2 tabular-nums" style={{ color: '#10B981' }}>
                        ${fmtPrice(trade.tpPrice)}
                      </td>
                      {/* SL / Trail */}
                      <td className="px-3 py-2 tabular-nums">
                        {trade.trailingActive ? (
                          <span style={{ color: '#F59E0B', fontWeight: 600 }}>⟳ ${fmtPrice(trade.trailingStopPrice)}</span>
                        ) : (
                          <span style={{ color: '#EF4444' }}>
                            ${fmtPrice(trade.slPrice)}
                            {trade.trailingStop && <span style={{ color: '#334155', fontSize: 8, marginLeft: 4 }}>TRAIL</span>}
                          </span>
                        )}
                      </td>
                      {/* Timer */}
                      <td className="px-3 py-2 tabular-nums" style={{ color: '#475569' }}>
                        <TradeTimer openTime={trade.openTime} />
                      </td>
                      {/* Fechar */}
                      <td className="px-2 py-2">
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
