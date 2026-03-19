import { useEffect, useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useStore } from './store/useStore';
import Background from './components/layout/Background';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import EquityChart from './components/dashboard/EquityChart';
import CandleChart from './components/dashboard/CandleChart';
import RobotCard from './components/dashboard/RobotCard';
import ActiveTrades from './components/dashboard/ActiveTrades';
import TradeHistory from './components/dashboard/TradeHistory';
import StatPanel from './components/dashboard/StatPanel';
import ApiKeyModal from './components/config/ApiKeyModal';
import RadarPanel from './components/dashboard/RadarPanel';
import { AnimatePresence, motion } from 'framer-motion';

const alertStyles: Record<string, { border: string; text: string; bg: string; icon: string }> = {
  critical: { border: '#F43F5E', text: 'text-rose-400',  bg: 'rgba(244,63,94,0.09)',  icon: '⚠' },
  warning:  { border: '#FBBF24', text: 'text-amber-400', bg: 'rgba(251,191,36,0.09)', icon: '⚡' },
  info:     { border: '#22D3EE', text: 'text-cyan-400',  bg: 'rgba(34,211,238,0.09)', icon: '◈' },
};

function ChartPanel() {
  const [tab, setTab] = useState<'equity' | 'candles'>('candles');
  return (
    <div className="cyber-panel flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 pt-2.5 pb-0 flex-shrink-0">
        {([['candles', '◫ Velas'], ['equity', '∿ Capital']] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="relative px-3 py-1.5 text-[9px] font-mono font-semibold uppercase tracking-wider transition-all rounded-t-md"
            style={{
              color: tab === t ? '#22D3EE' : '#475569',
              background: tab === t ? 'rgba(34,211,238,0.06)' : 'transparent',
              borderBottom: tab === t ? '2px solid #22D3EE' : '2px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="h-px mx-3" style={{ background: 'rgba(34,211,238,0.08)' }} />
      <div className="flex-1 min-h-0 p-2">
        {tab === 'candles' ? <CandleChart /> : <EquityChart />}
      </div>
    </div>
  );
}

export default function App() {
  useWebSocket();
  const { alerts, dismissAlert, showApiModal, killSwitchActive } = useStore();

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    alerts.forEach(a => {
      if (a.level !== 'critical') {
        timers.push(setTimeout(() => dismissAlert(a.id), 6000));
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [alerts, dismissAlert]);

  return (
    <div
      className="relative h-screen w-screen overflow-hidden select-none"
      style={{ background: '#05070F', fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}
    >
      <Background />

      {/* Kill switch ring */}
      {killSwitchActive && (
        <div
          className="fixed inset-0 z-50 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 100px rgba(244,63,94,0.18), inset 0 0 200px rgba(244,63,94,0.06)',
            border: '2px solid rgba(244,63,94,0.35)',
            animation: 'pulseGlow 2s ease-in-out infinite',
          }}
        />
      )}

      <div className="relative z-10 flex flex-col h-screen">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />

          {/* Main grid */}
          <main
            className="flex-1 overflow-hidden p-2.5"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 258px 182px',
              gridTemplateRows: '252px 1fr 204px',
              gap: 10,
            }}
          >
            {/* Chart */}
            <div style={{ gridColumn: 1, gridRow: 1, overflow: 'hidden', minHeight: 0 }}>
              <ChartPanel />
            </div>

            {/* Robot cards row */}
            <div style={{ gridColumn: 1, gridRow: 2, display: 'flex', gap: 10, minHeight: 0 }}>
              <RobotCard robotId="phantom" color="cyan" />
              <RobotCard robotId="nexus" color="green" />
              <RobotCard robotId="oracle" color="amber" />
            </div>

            {/* Bottom: active trades + history */}
            <div style={{ gridColumn: '1 / 4', gridRow: 3, display: 'flex', gap: 10, overflow: 'hidden', minHeight: 0 }}>
              <ActiveTrades />
              <TradeHistory />
            </div>

            {/* Radar */}
            <div style={{ gridColumn: 2, gridRow: '1 / 3', overflow: 'hidden', minHeight: 0 }}>
              <RadarPanel />
            </div>

            {/* Stats */}
            <div style={{ gridColumn: 3, gridRow: '1 / 3', overflow: 'hidden', minHeight: 0 }}>
              <StatPanel />
            </div>
          </main>
        </div>
      </div>

      {/* Toast notifications — stacked */}
      <AnimatePresence>
        {alerts.map((alert, index) => {
          const style = alertStyles[alert.level] || alertStyles.info;
          return (
            <motion.div
              key={alert.id}
              initial={{ x: 420, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 420, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-4 z-[60] flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer min-w-[280px] max-w-xs"
              style={{
                top: `${76 + index * 72}px`,
                background: style.bg,
                border: `1px solid ${style.border}55`,
                backdropFilter: 'blur(16px)',
                boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)`,
              }}
              onClick={() => dismissAlert(alert.id)}
            >
              <span className={`text-base leading-none mt-0.5 ${style.text}`}>{style.icon}</span>
              <div className="flex-1 min-w-0">
                <div className={`text-[9px] font-mono font-bold uppercase tracking-widest mb-0.5 ${style.text}`}>
                  {alert.level}
                </div>
                <div className="text-[10px] font-mono text-slate-200 leading-relaxed break-words">{alert.message}</div>
              </div>
              <span className="text-slate-600 text-xs hover:text-slate-300 mt-0.5 flex-shrink-0">✕</span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {showApiModal && <ApiKeyModal />}
    </div>
  );
}
