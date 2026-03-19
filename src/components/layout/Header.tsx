import { useRef } from 'react';
import { useStore } from '../../store/useStore';

const TICKER_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT'];
const FALLBACK: Record<string, { price: number; change: number }> = {
  BTCUSDT:  { price: 67420,  change:  2.14 },
  ETHUSDT:  { price: 3218,   change:  1.87 },
  SOLUSDT:  { price: 142.5,  change: -0.93 },
  BNBUSDT:  { price: 418,    change:  0.45 },
  XRPUSDT:  { price: 0.5821, change:  3.21 },
  ADAUSDT:  { price: 0.4512, change: -1.24 },
  DOGEUSDT: { price: 0.1234, change:  5.67 },
  AVAXUSDT: { price: 36.42,  change: -2.11 },
};

function fmtPrice(sym: string, price: number) {
  if (!price) return FALLBACK[sym]?.price.toFixed(price > 100 ? 0 : 4) ?? '—';
  return price > 10000 ? price.toFixed(0) : price > 1000 ? price.toFixed(1) : price > 1 ? price.toFixed(2) : price.toFixed(4);
}

const MODE_CONFIG = {
  paper:   { label: 'Paper',   cls: 'badge-paper',   dot: '#22D3EE' },
  testnet: { label: 'Testnet', cls: 'badge-testnet', dot: '#F59E0B' },
  live:    { label: 'LIVE',    cls: 'badge-live',    dot: '#10B981' },
};

export default function Header() {
  const { connected, marketTicks, capital, totalPnl, setShowApiModal, killSwitchActive, mode, accountBalance } = useStore();
  const firstPrices = useRef<Record<string, number>>({});

  const bal = accountBalance as Record<string, number> | null;
  const isRealMode = (mode === 'live' || mode === 'testnet') && bal;
  const displayCapital = isRealMode ? (bal!.totalWalletBalance ?? capital) : capital;
  const modeConf = MODE_CONFIG[mode] ?? MODE_CONFIG.paper;

  // Compute per-ticker change against first seen price (session change)
  const tickerItems = [...TICKER_SYMBOLS, ...TICKER_SYMBOLS].map((sym, i) => {
    const tick = marketTicks[sym];
    const price = tick?.price || 0;
    if (price > 0 && !firstPrices.current[sym]) firstPrices.current[sym] = price;
    const first = firstPrices.current[sym];
    const change = first && first !== price
      ? ((price - first) / first) * 100
      : (FALLBACK[sym]?.change ?? 0);
    const up = change >= 0;
    const displayPrice = price > 0 ? price : FALLBACK[sym]?.price ?? 0;

    return (
      <span key={`${sym}-${i}`} className="inline-flex items-center gap-2.5 mx-5 flex-shrink-0">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-slate-500">
          {sym.replace('USDT', '')}
        </span>
        <span className="text-[11px] font-mono font-bold text-slate-100 tabular-nums">
          ${fmtPrice(sym, displayPrice)}
        </span>
        <span className={`text-[9px] font-mono font-semibold ${up ? 'text-emerald-400' : 'text-rose-400'} tabular-nums`}>
          {up ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
        </span>
        <span className="text-slate-700 text-[8px]">│</span>
      </span>
    );
  });

  return (
    <header
      className="flex-shrink-0"
      style={{
        background: 'rgba(5,7,15,0.97)',
        borderBottom: '1px solid rgba(34,211,238,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Ticker tape */}
      <div
        className="h-7 flex items-center overflow-hidden"
        style={{ background: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
      >
        <div
          className="ticker-inner inline-flex items-center whitespace-nowrap"
          style={{ animationDuration: '55s' }}
        >
          {tickerItems}
        </div>
      </div>

      {/* Main nav */}
      <div className="flex items-center justify-between px-5" style={{ height: 50 }}>
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(34,211,238,0.22) 0%, rgba(139,92,246,0.22) 100%)',
                border: '1px solid rgba(34,211,238,0.28)',
                boxShadow: '0 0 16px rgba(34,211,238,0.1)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <polygon points="8,1 15,5 15,11 8,15 1,11 1,5" stroke="#22D3EE" strokeWidth="1.5" fill="rgba(34,211,238,0.08)" />
                <circle cx="8" cy="8" r="2" fill="#22D3EE" />
                <line x1="8" y1="1" x2="8" y2="5" stroke="#22D3EE" strokeWidth="0.8" opacity="0.5" />
                <line x1="8" y1="11" x2="8" y2="15" stroke="#22D3EE" strokeWidth="0.8" opacity="0.5" />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', color: '#22D3EE', lineHeight: 1 }}>
                CRIPTO<span style={{ color: '#E2E8F0' }}>SYSTEM</span>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: '#334155', letterSpacing: '0.3em', marginTop: 2 }}>
                NEXUS TERMINAL v2.0
              </div>
            </div>
          </div>

          {/* Mode badge */}
          <div className={`chip ${modeConf.cls} hidden lg:inline-flex`}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: modeConf.dot, boxShadow: `0 0 6px ${modeConf.dot}` }} />
            {modeConf.label}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-5">
          {killSwitchActive && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg animate-pulse"
              style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.4)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
              <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, fontWeight: 700, color: '#FC8181', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                Kill Switch Ativo
              </span>
            </div>
          )}

          {/* Capital & P&L */}
          <div className="hidden md:flex items-center gap-5">
            <div className="header-stat">
              <span className="header-stat-label">{isRealMode ? 'Saldo Binance' : 'Capital'}</span>
              <span className="header-stat-value" style={{ color: '#E2E8F0' }}>${Number(displayCapital).toFixed(2)}</span>
            </div>
            <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <div className="header-stat">
              <span className="header-stat-label">P&L Total</span>
              <span className="header-stat-value" style={{ color: totalPnl >= 0 ? '#10B981' : '#EF4444' }}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(4)}
              </span>
            </div>
          </div>

          <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.07)' }} />

          {/* Connection + Config */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-1.5"
              style={{
                fontFamily: "'JetBrains Mono'",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: connected ? '#10B981' : '#EF4444',
              }}
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'live-dot' : ''}`}
                style={{ background: connected ? '#10B981' : '#EF4444', boxShadow: connected ? '0 0 8px rgba(16,185,129,0.6)' : 'none' }}
              />
              {connected ? 'Online' : 'Offline'}
            </div>
            <button
              onClick={() => setShowApiModal(true)}
              className="btn-cyan text-[9px] font-mono px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all font-semibold"
              style={{ fontFamily: "'JetBrains Mono'" }}
            >
              ⚙ API
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
