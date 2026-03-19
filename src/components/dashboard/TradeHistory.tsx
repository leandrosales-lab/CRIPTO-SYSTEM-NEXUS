import { useStore } from '../../store/useStore';
import { AnimatePresence, motion } from 'framer-motion';

const robotAccents: Record<string, string> = {
  phantom: '#22D3EE',
  nexus:   '#34D399',
  oracle:  '#FBBF24',
  radar:   '#8B5CF6',
};

function fmtPrice(sym: string, price?: number) {
  if (!price) return '—';
  return price > 100 ? price.toFixed(0) : price > 1 ? price.toFixed(2) : price.toFixed(4);
}

function ReasonBadge({ reason }: { reason?: string }) {
  if (reason === 'trailing') return <span className="text-amber-400 font-bold text-[9px]">⟳ TRAIL</span>;
  if (reason === 'tp') return (
    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold text-emerald-400" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>TP</span>
  );
  if (reason === 'sl') return (
    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold text-rose-400" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)' }}>SL</span>
  );
  return <span className="text-slate-500 text-[9px]">{reason ?? '—'}</span>;
}

export default function TradeHistory() {
  const tradeHistory = useStore(s => s.tradeHistory);
  const headers = ['Robô', 'Par', 'Dir', 'Entrada', 'Saída', 'P&L', 'Motivo', 'Hora'];

  return (
    <div
      className="flex-1 h-full flex flex-col rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between flex-shrink-0 border-b border-white/[0.05]">
        <span
          className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          Histórico
        </span>
        <span className="text-[9px] font-mono text-slate-500">{tradeHistory.length} operações</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {tradeHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
            <div className="text-2xl text-slate-600">≡</div>
            <span className="text-[10px] font-mono text-slate-500">Aguardando operações...</span>
          </div>
        ) : (
          <table className="w-full text-[10px] font-mono">
            <thead className="sticky top-0" style={{ background: 'rgba(6,8,18,0.95)' }}>
              <tr className="border-b border-white/[0.05]">
                {headers.map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[9px] text-slate-500 uppercase tracking-wider font-normal whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {tradeHistory.slice(0, 50).map(trade => {
                  const pnl = trade.pnl || 0;
                  const isWin = pnl > 0;
                  const accent = robotAccents[trade.robotId] || '#94a3b8';
                  const time = trade.closeTime ? new Date(trade.closeTime) : new Date();
                  const timeStr = time.toLocaleTimeString('pt-BR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

                  return (
                    <motion.tr
                      key={trade.id}
                      initial={{ opacity: 0, backgroundColor: isWin ? 'rgba(52,211,153,0.08)' : 'rgba(244,63,94,0.08)' }}
                      animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)' }}
                      transition={{ duration: 1 }}
                      className="border-b border-white/[0.03]"
                    >
                      <td className="px-3 py-1.5 font-semibold uppercase" style={{ color: accent }}>{trade.robotId}</td>
                      <td className="px-3 py-1.5 text-slate-200 font-semibold">{trade.symbol.replace('USDT', '')}</td>
                      <td className={`px-3 py-1.5 font-bold ${trade.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {trade.direction === 'LONG' ? 'L' : 'S'}
                      </td>
                      <td className="px-3 py-1.5 text-slate-400 tabular-nums">${fmtPrice(trade.symbol, trade.entryPrice)}</td>
                      <td className="px-3 py-1.5 text-slate-400 tabular-nums">${fmtPrice(trade.symbol, trade.exitPrice)}</td>
                      <td className={`px-3 py-1.5 font-bold tabular-nums ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isWin ? '+' : ''}{pnl.toFixed(4)}
                      </td>
                      <td className="px-3 py-1.5"><ReasonBadge reason={trade.reason} /></td>
                      <td className="px-3 py-1.5 text-slate-500 tabular-nums">{timeStr}</td>
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
