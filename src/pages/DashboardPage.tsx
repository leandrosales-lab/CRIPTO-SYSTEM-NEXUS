import { useStore } from '../store/useStore';
import RobotCard from '../components/dashboard/RobotCard';
import ActiveTrades from '../components/dashboard/ActiveTrades';
import EquityChart from '../components/dashboard/EquityChart';
import TradeHistoryTable from '../components/dashboard/TradeHistoryTable';

// ─── Paleta fiel ao Stitch ───────────────────────────────────────────────────
const C = {
  bg:          '#111417',
  surface:     '#1d2023',
  surfaceHigh: '#272a2e',
  surfaceLow:  '#191c1f',
  surfaceLowest: '#0b0e11',
  primary:     '#4cd6ff',
  primarySoft: '#a4e6ff',
  green:       '#00e297',
  greenSoft:   '#4dffb2',
  red:         '#ffb4ab',
  text:        '#e1e2e7',
  dim:         '#bbc9cf',
  outline:     '#3c494e',
  outlineSoft: 'rgba(60,73,78,0.3)',
};

// ─── PortfolioCard ───────────────────────────────────────────────────────────
function PortfolioCard() {
  const { capital, totalPnl, todayPnl, activeTrades, robots, mode, accountBalance } = useStore();

  const bal = accountBalance as Record<string, number | string> | null;
  const isRealMode     = (mode === 'live' || mode === 'testnet') && bal;
  const displayCapital = isRealMode
    ? Number(bal!.totalWalletBalance ?? capital)
    : capital;

  const totalTrades  = activeTrades.length;

  // taxa de acerto global
  const allRobots = robots;
  const totalWins  = allRobots.reduce((acc, r) => acc + r.winCount, 0);
  const totalLoses = allRobots.reduce((acc, r) => acc + r.lossCount, 0);
  const winRate    = totalWins + totalLoses > 0
    ? (totalWins / (totalWins + totalLoses)) * 100
    : 0;

  const todayColor = todayPnl >= 0 ? C.green : C.red;

  // Capital inicial heurístico: menor ponto da curva de equity ou capital - totalPnl
  const initialCapital = capital - totalPnl > 0 ? capital - totalPnl : 10000;

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    // col-span-8
    <div
      className="relative rounded-xl p-8 overflow-hidden group flex flex-col justify-between"
      style={{
        background: 'linear-gradient(135deg, rgba(39,42,46,0.4) 0%, rgba(25,28,31,0.4) 100%)',
        backdropFilter: 'blur(10px)',
        border: `1px solid ${C.outlineSoft}`,
        minHeight: 220,
      }}
    >
      {/* Ícone decorativo de fundo */}
      <div
        className="absolute top-0 right-0 p-8 select-none pointer-events-none transition-opacity duration-300 opacity-10 group-hover:opacity-20"
        style={{ fontSize: 120, lineHeight: 1, color: C.primary }}
      >
        ◈
      </div>

      {/* Conteúdo */}
      <div className="relative z-10">
        <p
          className="font-mono text-xs uppercase mb-2"
          style={{ color: C.dim, letterSpacing: '0.3em' }}
        >
          Valor Atual do Portfólio
        </p>
        <h2
          className="font-bold tracking-tighter"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 48,
            lineHeight: 1,
            color: C.text,
          }}
        >
          {fmt(displayCapital)}
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 24,
              fontWeight: 400,
              color: C.primary,
              letterSpacing: 'normal',
              marginLeft: 8,
            }}
          >
            USDT
          </span>
        </h2>
      </div>

      {/* Grade 4 colunas de métricas */}
      <div className="relative z-10 mt-8 grid grid-cols-2 md:grid-cols-4 gap-8">
        {/* Capital Inicial */}
        <div>
          <p className="font-mono text-[10px] uppercase mb-2" style={{ color: C.dim, letterSpacing: '0.15em' }}>
            Capital Inicial
          </p>
          <p
            className="font-bold text-xl"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.text }}
          >
            ${fmt(initialCapital)}
          </p>
        </div>

        {/* Variação Diária */}
        <div>
          <p className="font-mono text-[10px] uppercase mb-2" style={{ color: C.dim, letterSpacing: '0.15em' }}>
            Variação Diária
          </p>
          <div
            className="inline-flex items-center px-3 py-1 rounded"
            style={{
              background: `${todayColor}20`,
              border: `1px solid ${todayColor}30`,
            }}
          >
            <span
              className="font-bold text-lg"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: todayColor }}
            >
              {todayPnl >= 0 ? '+' : ''}${fmt(Math.abs(todayPnl))}
              <span className="text-xs font-normal opacity-80 ml-1">
                ({todayPnl >= 0 ? '+' : ''}{initialCapital > 0 ? ((todayPnl / initialCapital) * 100).toFixed(1) : '0.0'}%)
              </span>
            </span>
          </div>
        </div>

        {/* Posições Ativas */}
        <div>
          <p className="font-mono text-[10px] uppercase mb-2" style={{ color: C.dim, letterSpacing: '0.15em' }}>
            Posições Ativas
          </p>
          <p
            className="font-bold text-xl"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.primary }}
          >
            {totalTrades}{' '}
            <span className="text-xs font-normal" style={{ color: C.dim }}>
              Tokens
            </span>
          </p>
        </div>

        {/* Taxa de Acerto */}
        <div>
          <p className="font-mono text-[10px] uppercase mb-2" style={{ color: C.dim, letterSpacing: '0.15em' }}>
            Taxa de Acerto
          </p>
          <p
            className="font-bold text-xl"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.green }}
          >
            {winRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Badge de modo — canto inferior direito */}
      <div
        className="absolute bottom-6 right-6 px-3 py-1 rounded-full font-mono text-[9px] font-bold uppercase tracking-widest"
        style={{
          background: mode === 'live'
            ? `${C.green}15`
            : mode === 'testnet'
            ? 'rgba(251,191,36,0.12)'
            : `${C.primary}12`,
          border: `1px solid ${mode === 'live' ? `${C.green}35` : mode === 'testnet' ? 'rgba(251,191,36,0.3)' : `${C.primary}30`}`,
          color: mode === 'live' ? C.green : mode === 'testnet' ? '#fbbf24' : C.primary,
        }}
      >
        ● {mode === 'live' ? 'LIVE' : mode === 'testnet' ? 'TESTNET' : 'PAPER'}
      </div>
    </div>
  );
}

// ─── EquityCard (col-span-4) ─────────────────────────────────────────────────
function EquityCard() {
  const { totalPnl } = useStore();
  const pnlColor = totalPnl >= 0 ? C.green : C.red;

  return (
    <div
      className="rounded-xl p-6 flex flex-col justify-between"
      style={{
        background: C.surfaceHigh,
        borderLeft: `2px solid ${C.primary}`,
        border: `1px solid ${C.outlineSoft}`,
        borderLeftWidth: 2,
        borderLeftColor: C.primary,
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <h3
          className="font-bold text-sm uppercase"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.text, letterSpacing: '0.2em' }}
        >
          Curva de Performance
        </h3>
        <span
          className="font-mono font-bold text-[10px] px-2 py-0.5 rounded uppercase"
          style={{ background: `${C.primary}15`, color: C.primary }}
        >
          Mensal
        </span>
      </div>

      {/* Chart */}
      <div className="flex-1" style={{ minHeight: 128 }}>
        <EquityChart />
      </div>

      {/* Footer */}
      <div className="pt-4 flex justify-between items-end">
        <p className="text-xs" style={{ color: C.dim }}>Últimos 30 Dias</p>
        <p
          className="text-lg font-bold"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: pnlColor }}
        >
          {totalPnl >= 0 ? '+' : ''}$
          {Math.abs(totalPnl).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}

// ─── RobotsGrid ──────────────────────────────────────────────────────────────
function RobotsGrid() {
  const robots = useStore(s => s.robots);
  const activeCount = robots.filter(r => r.status === 'running').length;

  return (
    <section>
      {/* Título da seção */}
      <div className="flex items-center justify-between mb-6">
        <h2
          className="font-black text-2xl uppercase tracking-tighter"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.text }}
        >
          Robôs Ativos
        </h2>
        <div className="flex items-center gap-6 flex-1 mx-8">
          <div className="h-px flex-1" style={{ background: C.outlineSoft }} />
        </div>
        <p
          className="font-mono text-[10px] uppercase whitespace-nowrap"
          style={{ color: C.dim, letterSpacing: '0.15em' }}
        >
          {activeCount} Sistemas Ativos
        </p>
      </div>

      {/* 3 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RobotCard robotId="nexus"   color="cyan"  />
        <RobotCard robotId="phantom" color="green" />
        <RobotCard robotId="oracle"  color="amber" />
      </div>
    </section>
  );
}

// ─── OrdersTable wrapper ─────────────────────────────────────────────────────
function OrdersSection() {
  function handleExport() {
    // lógica de exportação futura
    console.log('[Dashboard] Exportar histórico');
  }

  return (
    <section
      className="rounded-xl overflow-hidden"
      style={{ background: C.surfaceLow, border: `1px solid rgba(255,255,255,0.05)` }}
    >
      {/* Cabeçalho da seção */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-3">
          {/* Ícone */}
          <span style={{ color: C.primary, fontSize: 20, lineHeight: 1 }}>⏱</span>
          <h2
            className="font-bold text-sm uppercase"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.text, letterSpacing: '0.2em' }}
          >
            Registro de Ordens em Tempo Real
          </h2>
        </div>
        <button
          onClick={handleExport}
          className="font-mono text-[10px] uppercase hover:underline transition-all"
          style={{ color: C.primary, letterSpacing: '0.15em' }}
        >
          Exportar Histórico
        </button>
      </div>

      {/* Tabela via componente existente */}
      <ActiveTrades />
    </section>
  );
}

// ─── DashboardPage ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  return (
    <div
      className="min-h-full p-8"
      style={{ background: C.bg, maxWidth: '100%' }}
    >
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── Linha 1: Portfólio (8 cols) + Curva (4 cols) ── */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <PortfolioCard />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <EquityCard />
          </div>
        </div>

        {/* ── Linha 2: Grid de 4 robots ── */}
        <RobotsGrid />

        {/* ── Linha 3: Ordens ativas ── */}
        <OrdersSection />

        {/* ── Linha 4: Histórico de trades fechados ── */}
        <TradeHistoryTable />

      </div>
    </div>
  );
}
