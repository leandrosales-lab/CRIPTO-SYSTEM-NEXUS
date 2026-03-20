import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import TradeHistory, { exportTradesCsv } from '../components/dashboard/TradeHistory';
import EquityChart from '../components/dashboard/EquityChart';

// ─── Paleta Stitch ────────────────────────────────────────────────────────────
const C = {
  bg:          '#111417',
  surface:     '#1d2023',
  surfaceHigh: '#272a2e',
  primary:     '#4cd6ff',
  primaryDim:  '#a4e6ff',
  green:       '#00e297',
  red:         '#ffb4ab',
  text:        '#e1e2e7',
  dim:         '#bbc9cf',
  outline:     '#3c494e',
} as const;

// ─── Opções de filtro ─────────────────────────────────────────────────────────
const PERIOD_OPTIONS = [
  { value: '7d',  label: 'Últimos 7 Dias' },
  { value: '30d', label: 'Últimos 30 Dias' },
  { value: '90d', label: 'Últimos 90 Dias' },
  { value: 'all', label: 'Tudo' },
];

const BOT_OPTIONS = [
  { value: 'all',     label: 'Bot: All Systems' },
  { value: 'nexus',   label: 'Nexus' },
  { value: 'phantom', label: 'Phantom' },
  { value: 'oracle',  label: 'Oracle' },
  { value: 'radar',   label: 'Radar' },
];

// ─── Select estilizado ────────────────────────────────────────────────────────
function FilterSelect({
  icon,
  value,
  options,
  onChange,
}: {
  icon: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const label = options.find(o => o.value === value)?.label ?? value;

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ position: 'absolute', left: 10, fontSize: 16, color: C.outline, pointerEvents: 'none', zIndex: 1 }}
      >
        {icon}
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          background: C.surfaceHigh,
          border: `1px solid rgba(60,73,78,0.35)`,
          borderRadius: 8,
          padding: '7px 32px 7px 34px',
          fontSize: 12,
          fontWeight: 500,
          color: C.text,
          cursor: 'pointer',
          outline: 'none',
          fontFamily: 'Inter, sans-serif',
          minWidth: 150,
          transition: 'border-color 0.15s',
        }}
        onFocus={e => { (e.target as HTMLSelectElement).style.borderColor = `rgba(76,214,255,0.45)`; }}
        onBlur={e  => { (e.target as HTMLSelectElement).style.borderColor = `rgba(60,73,78,0.35)`; }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: C.surface }}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        className="material-symbols-outlined"
        style={{ position: 'absolute', right: 8, fontSize: 14, color: C.outline, pointerEvents: 'none' }}
      >
        expand_more
      </span>
      {/* label visível (sobrepõe o select nativo, apenas decorativo) — mantemos select nativo funcional */}
    </div>
  );
}

// ─── HistoryPage ──────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const tradeHistory   = useStore(s => s.tradeHistory);
  const capital        = useStore(s => s.capital);
  const accountBalance = useStore(s => s.accountBalance);

  // ── Estado de filtros ──────────────────────────────────────────────────────
  const [filterPeriod, setFilterPeriod] = useState('30d');
  const [filterBot,    setFilterBot]    = useState('all');
  const [filterPair,   setFilterPair]   = useState('all');
  const [page,         setPage]         = useState(1);
  const [totalShown,   setTotalShown]   = useState(0);

  // Ao mudar filtro, volta para página 1
  function handlePeriod(v: string) { setFilterPeriod(v); setPage(1); }
  function handleBot(v: string)    { setFilterBot(v);    setPage(1); }
  function handlePair(v: string)   { setFilterPair(v);   setPage(1); }

  function handleReset() {
    setFilterPeriod('30d');
    setFilterBot('all');
    setFilterPair('all');
    setPage(1);
  }

  // ── Pares únicos do histórico ──────────────────────────────────────────────
  const pairOptions = useMemo(() => {
    const closed = tradeHistory.filter(t => t.status === 'closed');
    const unique  = Array.from(new Set(closed.map(t => t.symbol))).sort();
    return [
      { value: 'all', label: 'Par: All' },
      ...unique.map(sym => ({ value: sym, label: sym.replace('USDT', '') + '/USDT' })),
    ];
  }, [tradeHistory]);

  // ── Métricas PnL cumulativo ───────────────────────────────────────────────
  const { totalPnl, totalPnlPct, initialCapital } = useMemo(() => {
    const closed = tradeHistory.filter(t => t.status === 'closed');
    const tp     = closed.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
    const init   = 20000; // capital inicial referência do mockup
    const pct    = init > 0 ? (tp / init) * 100 : 0;
    return { totalPnl: tp, totalPnlPct: pct, initialCapital: init };
  }, [tradeHistory]);

  const isProfit = totalPnl >= 0;

  // ── Saldo exibido no header ───────────────────────────────────────────────
  const balanceDisplay = accountBalance?.totalWalletBalance
    ? `$${Number(accountBalance.totalWalletBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${capital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── Export CSV ─────────────────────────────────────────────────────────────
  function handleExportCsv() {
    const now    = Date.now();
    const cutoff: Record<string, number> = {
      '7d':  now - 7  * 864e5,
      '30d': now - 30 * 864e5,
      '90d': now - 90 * 864e5,
      'all': 0,
    };
    const cut = cutoff[filterPeriod] ?? 0;
    const filtered = tradeHistory
      .filter(t => t.status === 'closed')
      .filter(t => filterBot  === 'all' || t.robotId.toLowerCase() === filterBot)
      .filter(t => filterPair === 'all' || t.symbol === filterPair)
      .filter(t => cut === 0 || (t.closeTime ?? 0) >= cut);
    exportTradesCsv(filtered);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        padding: 0,
        minHeight: '100%',
        background: C.bg,
        overflow: 'auto',
      }}
    >
      {/* ── Header breadcrumb ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 32px 16px',
          borderBottom: `1px solid rgba(60,73,78,0.15)`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16, color: C.dim, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.01em' }}>
            System /
          </span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: C.primaryDim,
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '-0.01em',
            }}
          >
            Detailed Trade History
          </span>
        </div>

        {/* Saldo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: C.primary }}>account_balance_wallet</span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: C.primaryDim,
              fontFamily: "'Space Grotesk', sans-serif",
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.01em',
            }}
          >
            {balanceDisplay} USDT
          </span>
        </div>
      </div>

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Seção 1: Cumulative PnL chart ── */}
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(135deg, rgba(39,42,46,0.8) 0%, rgba(17,20,23,0.9) 100%)',
            backdropFilter: 'blur(12px)',
            border: `1px solid rgba(60,73,78,0.15)`,
            borderRadius: 12,
            padding: '28px 28px 20px',
            overflow: 'hidden',
          }}
        >
          {/* Barra accent lateral */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 3,
              height: '100%',
              background: C.primary,
              boxShadow: `0 0 15px rgba(164,230,255,0.5)`,
            }}
          />

          {/* Topo: título + valor PnL */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  textTransform: 'uppercase',
                  color: C.text,
                  fontFamily: "'Space Grotesk', sans-serif",
                  marginBottom: 4,
                }}
              >
                Cumulative P&amp;L
              </h2>
              <p style={{ fontSize: 11, color: `${C.dim}99`, fontFamily: 'Inter, sans-serif' }}>
                30-Day Aggregated Intelligence Stream
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: isProfit ? C.green : C.red,
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                {isProfit ? '+' : ''}${Math.abs(totalPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, color: isProfit ? C.green : C.red }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  {isProfit ? 'trending_up' : 'trending_down'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'Inter, sans-serif' }}>
                  {isProfit ? '+' : ''}{totalPnlPct.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Gráfico EquityChart */}
          <EquityChart height={180} />
        </div>

        {/* ── Seção 2: Filtros ── */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            background: '#191c1f',
            border: `1px solid rgba(60,73,78,0.18)`,
            borderRadius: 10,
            padding: '12px 16px',
          }}
        >
          {/* Label filtros */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: C.primary }}>filter_list</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: C.dim,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Filtros:
            </span>
          </div>

          {/* Período */}
          <FilterSelect
            icon="calendar_today"
            value={filterPeriod}
            options={PERIOD_OPTIONS}
            onChange={handlePeriod}
          />

          {/* Bot */}
          <FilterSelect
            icon="smart_toy"
            value={filterBot}
            options={BOT_OPTIONS}
            onChange={handleBot}
          />

          {/* Par */}
          <FilterSelect
            icon="currency_bitcoin"
            value={filterPair}
            options={pairOptions}
            onChange={handlePair}
          />

          {/* Botões direita */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              onClick={handleReset}
              style={{
                background: C.surfaceHigh,
                border: `1px solid rgba(60,73,78,0.4)`,
                borderRadius: 8,
                padding: '7px 16px',
                fontSize: 11,
                fontWeight: 700,
                color: C.text,
                cursor: 'pointer',
                letterSpacing: '0.04em',
                fontFamily: 'Inter, sans-serif',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#323538'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.surfaceHigh; }}
            >
              RESET
            </button>

            <button
              onClick={handleExportCsv}
              style={{
                background: '#00d1ff',
                border: 'none',
                borderRadius: 8,
                padding: '7px 16px',
                fontSize: 11,
                fontWeight: 700,
                color: '#003543',
                cursor: 'pointer',
                letterSpacing: '0.04em',
                fontFamily: 'Inter, sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 12px rgba(0,209,255,0.15)',
                transition: 'filter 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'none'; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
              EXPORT CSV
            </button>
          </div>
        </div>

        {/* ── Seção 3: Tabela ── */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(39,42,46,0.8) 0%, rgba(17,20,23,0.9) 100%)',
            backdropFilter: 'blur(12px)',
            border: `1px solid rgba(60,73,78,0.15)`,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <TradeHistory
            filterBot={filterBot}
            filterPeriod={filterPeriod}
            filterPair={filterPair}
            page={page}
            pageSize={25}
            onPageChange={setPage}
            onTotalChange={setTotalShown}
          />
        </div>

      </div>
    </div>
  );
}
