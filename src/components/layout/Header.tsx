import { useRef } from 'react';
import { useStore } from '../../store/useStore';

interface HeaderProps {
  currentPage?: string;
}

const TICKER_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

const FALLBACK: Record<string, { price: number; change: number }> = {
  BTCUSDT: { price: 67420,  change:  2.14 },
  ETHUSDT: { price: 3218,   change:  1.87 },
  SOLUSDT: { price: 142.5,  change: -0.93 },
};

function fmtPrice(sym: string, price: number): string {
  const p = price || FALLBACK[sym]?.price || 0;
  if (p > 10000) return p.toFixed(0);
  if (p > 1000)  return p.toFixed(1);
  if (p > 1)     return p.toFixed(2);
  return p.toFixed(4);
}

function fmtMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const PAGE_LABELS: Record<string, string> = {
  dashboard: 'Painel',
  nexus:     'Nexus',
  phantom:   'Phantom',
  oracle:    'Oracle',
  radar:     'Radar',
  settings:  'Configurações / API',
};

export default function Header({ currentPage }: HeaderProps) {
  const {
    connected,
    marketTicks,
    capital,
    totalPnl,
    todayPnl,
    mode,
    accountBalance,
    setShowApiModal,
  } = useStore();

  const firstPrices = useRef<Record<string, number>>({});

  const bal = accountBalance as Record<string, number> | null;
  const isRealMode = (mode === 'live' || mode === 'testnet') && bal;
  const displayCapital = isRealMode ? (bal!.totalWalletBalance ?? capital) : capital;

  // Ticker BTC/ETH/SOL
  const tickerItems = TICKER_SYMBOLS.map(sym => {
    const tick = marketTicks[sym];
    const price = tick?.price || 0;
    if (price > 0 && !firstPrices.current[sym]) firstPrices.current[sym] = price;
    const first = firstPrices.current[sym];
    const change =
      first && first !== price
        ? ((price - first) / first) * 100
        : (FALLBACK[sym]?.change ?? 0);
    const up = change >= 0;
    const displayPrice = price > 0 ? price : FALLBACK[sym]?.price ?? 0;
    const label = sym.replace('USDT', '');

    return (
      <span key={sym} className="inline-flex items-center gap-1.5 flex-shrink-0">
        <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: '#859399', letterSpacing: '0.12em' }}>
          {label}
        </span>
        <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#e1e2e7' }}>
          ${fmtPrice(sym, displayPrice)}
        </span>
        <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 600, color: up ? '#00e297' : '#ffb4ab' }}>
          {up ? '▲' : '▼'}{Math.abs(change).toFixed(2)}%
        </span>
      </span>
    );
  });

  const breadcrumb = currentPage ? PAGE_LABELS[currentPage] : null;

  const pnlColor = (v: number) => (v >= 0 ? '#00e297' : '#ffb4ab');
  const pnlSign  = (v: number) => (v >= 0 ? '+' : '');

  // Percentual do dia (usando capital como base estimada)
  const todayPct = displayCapital > 0 ? (todayPnl / displayCapital) * 100 : 0;
  const totalPct = displayCapital > 0 ? (totalPnl / (displayCapital - totalPnl || 1)) * 100 : 0;

  return (
    <header
      className="flex-shrink-0 flex items-center justify-between px-5"
      style={{
        height: 48,
        background: '#0b0e11',
        borderBottom: '1px solid #3c494e',
        fontFamily: "'Space Grotesk', sans-serif",
        zIndex: 50,
      }}
    >
      {/* ── Esquerda: Logo + Ticker ── */}
      <div className="flex items-center gap-5">
        {/* Logo */}
        <span
          className="font-bold uppercase tracking-tight select-none flex-shrink-0"
          style={{ fontSize: 14, color: '#4cd6ff', letterSpacing: '0.06em' }}
        >
          KINETIC
        </span>

        {/* Separador */}
        <span style={{ width: 1, height: 20, background: '#3c494e', display: 'inline-block' }} />

        {/* Ticker BTC / ETH / SOL */}
        <div className="hidden md:flex items-center gap-5">
          {tickerItems}
        </div>
      </div>

      {/* ── Centro: Breadcrumb ── */}
      <div className="flex-1 flex justify-center">
        {breadcrumb && (
          <span style={{ fontSize: 11, color: '#bbc9cf', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {breadcrumb}
          </span>
        )}
      </div>

      {/* ── Direita: Métricas + Ações ── */}
      <div className="flex items-center gap-4">
        {/* Saldo */}
        <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
          <span style={{ fontSize: 9, color: '#859399', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            SALDO:
          </span>
          <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#e1e2e7' }}>
            ${fmtMoney(Number(displayCapital))} USDT
          </span>
        </div>

        {/* Separador */}
        <span className="hidden lg:block" style={{ width: 1, height: 16, background: '#3c494e' }} />

        {/* Diário */}
        <div className="hidden md:flex items-center gap-1 flex-shrink-0">
          <span style={{ fontSize: 9, color: '#859399', fontWeight: 600, letterSpacing: '0.1em' }}>DIÁRIO:</span>
          <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: pnlColor(todayPnl) }}>
            {pnlSign(todayPnl)}${fmtMoney(todayPnl)}
          </span>
        </div>

        {/* Total % */}
        <div
          className="hidden md:flex items-center justify-center px-2 py-0.5 rounded"
          style={{ background: totalPnl >= 0 ? 'rgba(0,226,151,0.1)' : 'rgba(255,180,171,0.1)', border: `1px solid ${totalPnl >= 0 ? 'rgba(0,226,151,0.25)' : 'rgba(255,180,171,0.25)'}` }}
        >
          <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: pnlColor(totalPnl) }}>
            {pnlSign(totalPct)}{totalPct.toFixed(1)}%
          </span>
        </div>

        {/* Separador */}
        <span style={{ width: 1, height: 16, background: '#3c494e' }} />

        {/* Ações */}
        <div className="flex items-center gap-3" style={{ color: '#4cd6ff' }}>
          {/* Status de conexão */}
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: connected ? '#00e297' : '#ffb4ab',
              boxShadow: connected ? '0 0 6px rgba(0,226,151,0.7)' : 'none',
              display: 'inline-block',
              flexShrink: 0,
            }}
            title={connected ? 'Online' : 'Offline'}
          />

          {/* Notificações */}
          <button
            className="material-symbols-outlined"
            title="Notificações"
            style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#4cd6ff', padding: 0, lineHeight: 1 }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#00e297')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#4cd6ff')}
          >
            notifications
          </button>

          {/* Configurações / API */}
          <button
            className="material-symbols-outlined"
            title="Configurações / API"
            onClick={() => setShowApiModal(true)}
            style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#4cd6ff', padding: 0, lineHeight: 1 }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#00e297')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#4cd6ff')}
          >
            settings
          </button>

          {/* Usuário */}
          <button
            className="material-symbols-outlined"
            title="Perfil"
            style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#4cd6ff', padding: 0, lineHeight: 1 }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#00e297')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#4cd6ff')}
          >
            account_circle
          </button>
        </div>
      </div>
    </header>
  );
}
