import { useEffect, useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useStore } from './store/useStore';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import ApiKeyModal from './components/config/ApiKeyModal';
import { AnimatePresence, motion } from 'framer-motion';

import DashboardPage from './pages/DashboardPage';
import RobotPage from './pages/RobotPage';
import RadarPage from './pages/RadarPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type Page =
  | 'dashboard'
  | 'robot-nexus'
  | 'robot-phantom'
  | 'robot-oracle'
  | 'radar'
  | 'history'
  | 'settings';

// ─── Estilos dos alertas toast ────────────────────────────────────────────────
const alertStyles: Record<string, { border: string; text: string; bg: string; icon: string }> = {
  critical: { border: '#F43F5E', text: 'text-rose-400',  bg: 'rgba(244,63,94,0.09)',  icon: '⚠' },
  warning:  { border: '#FBBF24', text: 'text-amber-400', bg: 'rgba(251,191,36,0.09)', icon: '⚡' },
  info:     { border: '#22D3EE', text: 'text-cyan-400',  bg: 'rgba(34,211,238,0.09)', icon: '◈' },
};

// ─── AlertsOverlay ────────────────────────────────────────────────────────────
function AlertsOverlay() {
  const { alerts, dismissAlert } = useStore();

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
    <AnimatePresence>
      {alerts.map((alert, index) => {
        const style = alertStyles[alert.level] ?? alertStyles.info;
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
              boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)',
            }}
            onClick={() => dismissAlert(alert.id)}
          >
            <span className={`text-base leading-none mt-0.5 ${style.text}`}>{style.icon}</span>
            <div className="flex-1 min-w-0">
              <div className={`text-[9px] font-mono font-bold uppercase tracking-widest mb-0.5 ${style.text}`}>
                {alert.level}
              </div>
              <div className="text-[10px] font-mono text-slate-200 leading-relaxed break-words">
                {alert.message}
              </div>
            </div>
            <span className="text-slate-600 text-xs hover:text-slate-300 mt-0.5 flex-shrink-0">✕</span>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [activePage, setActivePage] = useState<Page>('dashboard');

  // CRÍTICO: manter sempre ativo para receber dados do backend
  useWebSocket();

  const { showApiModal, killSwitchActive } = useStore();

  return (
    <div
      className="flex h-screen overflow-hidden select-none"
      style={{
        background: '#111417',
        color: '#e1e2e7',
        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      }}
    >
      {/* Kill Switch — anel vermelho pulsante */}
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

      {/* Sidebar fixa à esquerda */}
      <Sidebar
        activePage={activePage}
        onNavigate={(p) => setActivePage(p as Page)}
      />

      {/* Área principal */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header currentPage={activePage} />

        {/* Conteúdo da página */}
        <main
          className="flex-1 overflow-auto"
          style={{ background: '#111417' }}
        >
          {activePage === 'dashboard'      && <DashboardPage />}
          {activePage === 'robot-nexus'    && <RobotPage robotId="nexus" />}
          {activePage === 'robot-phantom'  && <RobotPage robotId="phantom" />}
          {activePage === 'robot-oracle'   && <RobotPage robotId="oracle" />}
          {activePage === 'radar'          && <RadarPage />}
          {activePage === 'history'        && <HistoryPage />}
          {activePage === 'settings'       && <SettingsPage />}
        </main>
      </div>

      {/* Modal de API Key */}
      {showApiModal && <ApiKeyModal />}

      {/* Alertas toast */}
      <AlertsOverlay />
    </div>
  );
}
