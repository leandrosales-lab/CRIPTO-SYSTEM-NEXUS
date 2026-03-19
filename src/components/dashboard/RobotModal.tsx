import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useStore, RobotState, Trade } from '../../store/useStore';
import axios from 'axios';

interface Props {
  robot: RobotState;
  accentColor: string;
  onClose: () => void;
}

function fmtPrice(price?: number) {
  if (!price) return '—';
  return price > 1000 ? price.toFixed(2) : price > 1 ? price.toFixed(4) : price.toFixed(6);
}

function ReasonBadge({ reason }: { reason?: string }) {
  if (reason === 'trailing') return <span className="text-amber-400 text-[8px] font-bold">⟳ TRAIL</span>;
  if (reason === 'tp') return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold text-emerald-400" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>TP</span>;
  if (reason === 'sl') return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold text-rose-400" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)' }}>SL</span>;
  return <span className="text-slate-500 text-[9px]">{reason ?? '—'}</span>;
}

function UnrealizedPnl({ trade, currentPrice }: { trade: Trade; currentPrice: number }) {
  if (!currentPrice) return <span className="text-slate-500">—</span>;
  const priceDiff = trade.direction === 'LONG'
    ? currentPrice - trade.entryPrice
    : trade.entryPrice - currentPrice;
  const fee = trade.notional * 0.0004 * 2;
  const pnl = trade.notional * (priceDiff / trade.entryPrice) - fee;
  const pct = (pnl / trade.size) * 100;
  const isPos = pnl >= 0;
  return (
    <span className={`font-mono font-bold tabular-nums ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
      {isPos ? '+' : ''}{pnl.toFixed(4)} <span className="text-[8px] opacity-70">({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)</span>
    </span>
  );
}

export default function RobotModal({ robot, accentColor, onClose }: Props) {
  const [tab, setTab] = useState<'open' | 'history' | 'signals'>('open');
  const [dbHistory, setDbHistory] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const marketTicks = useStore(s => s.marketTicks);
  const tradeHistory = useStore(s => s.tradeHistory.filter(t => t.robotId === robot.id));
  const activeTrades = useStore(s => s.activeTrades.filter(t => t.robotId === robot.id));
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab === 'history') {
      setLoading(true);
      axios.get(`/api/trades?robotId=${robot.id}&limit=100`)
        .then(r => setDbHistory(r.data))
        .catch(() => setDbHistory(tradeHistory))
        .finally(() => setLoading(false));
    }
  }, [tab, robot.id]);

  const totalHistory = dbHistory.length > 0 ? dbHistory : tradeHistory;
  const wins = totalHistory.filter(t => (t.pnl ?? 0) > 0).length;
  const totalPnl = totalHistory.reduce((a, t) => a + (t.pnl ?? 0), 0);
  const winRate = totalHistory.length > 0 ? (wins / totalHistory.length) * 100 : 0;

  const closedTrades = totalHistory.filter(t => t.status === 'closed');

  return createPortal(
    <AnimatePresence>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 flex items-center justify-center"
        onClick={e => e.target === overlayRef.current && onClose()}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
        />
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 12 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="relative z-10 w-[780px] max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
          style={{ background: 'rgba(8,11,22,0.98)', border: `1px solid ${accentColor}30`, boxShadow: `0 0 60px ${accentColor}15, 0 32px 64px rgba(0,0,0,0.6)` }}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}30`, color: accentColor }}
              >
                {robot.id === 'phantom' ? '◈' : robot.id === 'nexus' ? '⬡' : '◎'}
              </div>
              <div>
                <div className="font-bold text-base tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif", color: accentColor }}>
                  {robot.name}
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">{robot.strategy}</div>
              </div>
            </div>

            {/* Summary stats */}
            <div className="flex items-center gap-6">
              {[
                { label: 'P&L Total', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(4)}`, color: totalPnl >= 0 ? '#34D399' : '#F43F5E' },
                { label: 'Taxa Acerto', value: `${winRate.toFixed(1)}%`, color: accentColor },
                { label: 'Operações', value: `${totalHistory.length}`, color: '#E2E8F0' },
                { label: 'Capital', value: `$${robot.capital.toFixed(4)}`, color: '#E2E8F0' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">{label}</div>
                  <div className="font-mono font-bold text-sm tabular-nums" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-6 pt-3 flex-shrink-0">
            {(['open', 'history', 'signals'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-4 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all"
                style={{
                  background: tab === t ? `${accentColor}15` : 'transparent',
                  border: tab === t ? `1px solid ${accentColor}40` : '1px solid transparent',
                  color: tab === t ? accentColor : '#64748b',
                }}
              >
                {t === 'open'
                  ? `Posições Abertas (${activeTrades.length})`
                  : t === 'history'
                  ? `Histórico (${totalHistory.length})`
                  : `Sinais (${robot.signalHistory?.length ?? 0})`}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6 pt-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
            {tab === 'open' ? (
              activeTrades.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
                  <div className="text-3xl text-slate-600">◉</div>
                  <span className="font-mono text-sm text-slate-500">Nenhuma posição aberta</span>
                </div>
              ) : (
                <table className="w-full text-[10px] font-mono">
                  <thead>
                    <tr className="border-b border-white/[0.05]">
                      {['Par', 'Dir', 'Entrada', 'Atual', 'P&L', 'Notional', 'TP', 'SL', 'Alavancagem'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[9px] text-slate-500 uppercase tracking-wider font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTrades.map(t => {
                      const cp = marketTicks[t.symbol]?.price || 0;
                      return (
                        <tr key={t.id} className="border-b border-white/[0.03]">
                          <td className="px-3 py-2 text-slate-200 font-semibold">{t.symbol.replace('USDT', '')}</td>
                          <td className={`px-3 py-2 font-bold ${t.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>{t.direction}</td>
                          <td className="px-3 py-2 text-slate-400 tabular-nums">${fmtPrice(t.entryPrice)}</td>
                          <td className="px-3 py-2 text-slate-200 tabular-nums font-semibold">{cp > 0 ? `$${fmtPrice(cp)}` : '—'}</td>
                          <td className="px-3 py-2"><UnrealizedPnl trade={t} currentPrice={cp} /></td>
                          <td className="px-3 py-2 text-slate-400 tabular-nums">${t.notional.toFixed(2)}</td>
                          <td className="px-3 py-2 text-emerald-400 tabular-nums">${fmtPrice(t.tpPrice)}</td>
                          <td className="px-3 py-2 text-rose-400 tabular-nums">${fmtPrice(t.slPrice)}</td>
                          <td className="px-3 py-2 text-slate-400">{t.leverage}x</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            ) : tab === 'signals' ? (
              !robot.signalHistory?.length ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
                  <div className="text-3xl text-slate-600">◎</div>
                  <span className="font-mono text-sm text-slate-500">Nenhum sinal registrado</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {robot.signalHistory.map((s, i) => {
                    const isLong = s.signal.startsWith('LONG');
                    const isShort = s.signal.startsWith('SHORT');
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 px-3 py-2 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <span
                          className={`font-mono text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${
                            isLong ? 'text-emerald-400' : isShort ? 'text-rose-400' : 'text-slate-400'
                          }`}
                          style={{
                            background: isLong ? 'rgba(52,211,153,0.1)' : isShort ? 'rgba(244,63,94,0.1)' : 'transparent',
                            border: isLong ? '1px solid rgba(52,211,153,0.2)' : isShort ? '1px solid rgba(244,63,94,0.2)' : 'none',
                          }}
                        >
                          {isLong ? '▲' : isShort ? '▼' : '·'}
                        </span>
                        <span className="font-mono text-[9px] text-slate-300 flex-1 leading-relaxed">{s.signal}</span>
                        <span className="font-mono text-[8px] text-slate-600 flex-shrink-0">
                          {new Date(s.time).toLocaleTimeString('pt-BR', { hour12: false })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )
            ) : loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500 font-mono text-sm">Carregando...</div>
            ) : closedTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
                <div className="text-3xl text-slate-600">≡</div>
                <span className="font-mono text-sm text-slate-500">Sem operações fechadas</span>
              </div>
            ) : (
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    {['Par', 'Dir', 'Entrada', 'Saída', 'P&L', 'P&L %', 'Notional', 'Motivo', 'Duração'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[9px] text-slate-500 uppercase tracking-wider font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.map(t => {
                    const pnl = t.pnl ?? 0;
                    const isWin = pnl > 0;
                    const dur = t.closeTime && t.openTime ? Math.floor((t.closeTime - t.openTime) / 1000) : 0;
                    const durStr = dur > 3600 ? `${Math.floor(dur/3600)}h${Math.floor((dur%3600)/60)}m` : dur > 60 ? `${Math.floor(dur/60)}m${(dur%60)}s` : `${dur}s`;
                    return (
                      <motion.tr
                        key={t.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-white/[0.03]"
                      >
                        <td className="px-3 py-1.5 text-slate-200 font-semibold">{t.symbol.replace('USDT', '')}</td>
                        <td className={`px-3 py-1.5 font-bold ${t.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>{t.direction}</td>
                        <td className="px-3 py-1.5 text-slate-400 tabular-nums">${fmtPrice(t.entryPrice)}</td>
                        <td className="px-3 py-1.5 text-slate-400 tabular-nums">${fmtPrice(t.exitPrice)}</td>
                        <td className={`px-3 py-1.5 font-bold tabular-nums ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isWin ? '+' : ''}{pnl.toFixed(4)}
                        </td>
                        <td className={`px-3 py-1.5 tabular-nums ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(t.pnlPercent ?? 0) >= 0 ? '+' : ''}{(t.pnlPercent ?? 0).toFixed(2)}%
                        </td>
                        <td className="px-3 py-1.5 text-slate-500 tabular-nums">${t.notional.toFixed(2)}</td>
                        <td className="px-3 py-1.5"><ReasonBadge reason={t.reason} /></td>
                        <td className="px-3 py-1.5 text-slate-500">{durStr}</td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
