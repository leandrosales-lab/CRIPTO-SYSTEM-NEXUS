import { useStore } from '../../store/useStore';
import axios from 'axios';
import { useEffect, useState } from 'react';

interface SidebarProps {
  activePage?: string;
  onNavigate?: (page: string) => void;
}

const MODE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  paper:   { label: 'PAPER',   color: '#4cd6ff', bg: 'rgba(76,214,255,0.12)' },
  testnet: { label: 'TESTNET', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  live:    { label: 'LIVE',    color: '#00e297', bg: 'rgba(0,226,151,0.12)' },
};

const NAV_ITEMS = [
  { page: 'dashboard', icon: 'dashboard',  label: 'Painel' },
  { divider: true },
  { page: 'nexus',     icon: 'memory',      label: 'Nexus' },
  { page: 'phantom',   icon: 'auto_awesome', label: 'Phantom' },
  { page: 'oracle',    icon: 'insights',    label: 'Oracle' },
  { page: 'radar',     icon: 'sensors',     label: 'Radar' },
  { divider: true },
  { page: 'settings',  icon: 'settings',    label: 'Configurações/API' },
] as const;

export default function Sidebar({ activePage = 'dashboard', onNavigate }: SidebarProps) {
  const { mode, capital, accountBalance, apiKeySet, setAccountBalance, setMode } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  const modeConf = MODE_CONFIG[mode] ?? MODE_CONFIG.paper;

  const bal = accountBalance as Record<string, number> | null;
  const isRealMode = (mode === 'live' || mode === 'testnet') && bal;
  const displayCapital = isRealMode ? (bal!.totalWalletBalance ?? capital) : capital;

  async function fetchBalance() {
    setRefreshing(true);
    try {
      const r = await axios.get<{ mode: string; accountBalance: Record<string, number> | null }>('/api/account/balance');
      if (r.data.accountBalance) setAccountBalance(r.data.accountBalance as unknown as Parameters<typeof setAccountBalance>[0]);
      if (r.data.mode) setMode(r.data.mode as 'paper' | 'testnet' | 'live');
    } catch (_) {}
    setRefreshing(false);
  }

  useEffect(() => {
    if (mode !== 'paper' && apiKeySet) fetchBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, apiKeySet]);

  return (
    <aside
      className="flex-shrink-0 flex flex-col h-full"
      style={{
        width: 220,
        background: '#111417',
        borderRight: '1px solid #3c494e',
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {/* ── Logo ── */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid #3c494e' }}>
        <h1
          className="font-bold uppercase tracking-tight leading-none"
          style={{ fontSize: 13, color: '#4cd6ff', letterSpacing: '0.04em' }}
        >
          KINETIC INTELLIGENCE
        </h1>
        <p
          className="uppercase mt-1"
          style={{ fontSize: 9, color: '#859399', letterSpacing: '0.18em' }}
        >
          CENTRO DE COMANDO
        </p>
      </div>

      {/* ── Navegação ── */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item, idx) => {
          if ('divider' in item) {
            return (
              <div
                key={`divider-${idx}`}
                className="my-2 mx-3"
                style={{ height: 1, background: '#3c494e' }}
              />
            );
          }

          const isActive = activePage === item.page;

          return (
            <button
              key={item.page}
              onClick={() => onNavigate?.(item.page)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left"
              style={{
                background: isActive ? '#1d2023' : 'transparent',
                borderLeft: isActive ? `2px solid #4cd6ff` : '2px solid transparent',
                color: isActive ? '#4cd6ff' : '#bbc9cf',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = '#1d2023';
                  (e.currentTarget as HTMLElement).style.color = '#e1e2e7';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = '#bbc9cf';
                }
              }}
            >
              <span
                className="material-symbols-outlined flex-shrink-0"
                style={{ fontSize: 20, lineHeight: 1 }}
              >
                {item.icon}
              </span>
              <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ── Rodapé: Modo + Operador ── */}
      <div style={{ borderTop: '1px solid #3c494e' }}>
        {/* Saldo rápido */}
        <div
          className="mx-3 mt-3 mb-2 px-3 py-2 rounded-lg flex items-center justify-between"
          style={{ background: '#1d2023', border: '1px solid #3c494e' }}
        >
          <span style={{ fontSize: 10, color: '#859399', letterSpacing: '0.1em' }}>
            {isRealMode ? 'SALDO' : 'CAPITAL'}
          </span>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 11, fontWeight: 600, color: '#e1e2e7', fontFamily: 'monospace' }}>
              ${Number(displayCapital).toFixed(2)}
            </span>
            {isRealMode && (
              <button
                onClick={fetchBalance}
                disabled={refreshing}
                title="Atualizar saldo"
                style={{ fontSize: 12, color: '#859399', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#4cd6ff')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#859399')}
              >
                {refreshing ? '⟳' : '↺'}
              </button>
            )}
          </div>
        </div>

        {/* Badge de modo */}
        <div className="px-3 pb-3">
          <div
            className="flex items-center justify-between px-3 py-2 rounded-lg"
            style={{ background: modeConf.bg, border: `1px solid ${modeConf.color}33` }}
          >
            <div className="flex items-center gap-2">
              <span
                className="rounded-full animate-pulse flex-shrink-0"
                style={{
                  width: 6,
                  height: 6,
                  background: modeConf.color,
                  boxShadow: `0 0 6px ${modeConf.color}`,
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  color: modeConf.color,
                  textTransform: 'uppercase',
                }}
              >
                {modeConf.label}
              </span>
            </div>
            <span style={{ fontSize: 9, color: '#bbc9cf', letterSpacing: '0.05em' }}>
              OPERADOR_01
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
