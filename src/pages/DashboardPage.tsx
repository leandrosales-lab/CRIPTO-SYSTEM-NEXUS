import { useStore } from '../store/useStore';
import RobotCard from '../components/dashboard/RobotCard';
import ActiveTrades from '../components/dashboard/ActiveTrades';
import EquityChart from '../components/dashboard/EquityChart';
import RadarPanel from '../components/dashboard/RadarPanel';

// ─── Paleta inline ─────────────────────────────────────────────────────────────
const C = {
  bg:      '#111417',
  surface: '#1d2023',
  primary: '#4cd6ff',
  green:   '#00e297',
  text:    '#e1e2e7',
  outline: '#3c494e',
  dim:     '#8a9ba8',
};

// ─── Card de Portfólio ─────────────────────────────────────────────────────────
function PortfolioCard() {
  const { capital, totalPnl, todayPnl, drawdown, activeTrades, robots, mode, accountBalance } = useStore();

  const bal = accountBalance as Record<string, number> | null;
  const isRealMode    = (mode === 'live' || mode === 'testnet') && bal;
  const displayCapital = isRealMode ? (bal!.totalWalletBalance ?? capital) : capital;
  const activeRobots   = robots.filter(r => r.status === 'running').length;
  const totalTrades    = activeTrades.length;

  const pnlColor   = totalPnl >= 0 ? C.green : '#f87171';
  const todayColor = todayPnl >= 0 ? C.green : '#f87171';

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ background: C.surface, border: `1px solid ${C.outline}` }}
    >
      {/* Título + modo */}
      <div className="flex items-center justify-between">
        <div>
          <div
            className="text-[10px] font-mono uppercase tracking-[0.2em] mb-1"
            style={{ color: C.dim }}
          >
            {isRealMode ? 'Saldo Binance' : 'Valor do Portfólio'}
          </div>
          <div
            className="text-4xl font-bold tabular-nums"
            style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
          >
            ${Number(displayCapital).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-sm ml-1" style={{ color: C.dim }}>USDT</span>
          </div>
        </div>

        {/* Badge de modo */}
        <div
          className="px-3 py-1.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-widest"
          style={{
            background: mode === 'live' ? 'rgba(0,226,151,0.1)' : mode === 'testnet' ? 'rgba(251,191,36,0.1)' : 'rgba(76,214,255,0.1)',
            border: `1px solid ${mode === 'live' ? 'rgba(0,226,151,0.35)' : mode === 'testnet' ? 'rgba(251,191,36,0.35)' : 'rgba(76,214,255,0.35)'}`,
            color: mode === 'live' ? C.green : mode === 'testnet' ? '#fbbf24' : C.primary,
          }}
        >
          {mode === 'live' ? '● LIVE' : mode === 'testnet' ? '● Testnet' : '● Paper'}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'P&L Total',   value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(4)}`,  color: pnlColor   },
          { label: 'P&L Hoje',    value: `${todayPnl >= 0 ? '+' : ''}$${todayPnl.toFixed(4)}`,  color: todayColor },
          { label: 'Posições',    value: `${totalTrades}`,    color: totalTrades > 15 ? '#fbbf24' : C.text },
          { label: 'Robôs Ativos',value: `${activeRobots}/3`, color: activeRobots > 0 ? C.primary : C.dim  },
        ].map(m => (
          <div
            key={m.label}
            className="rounded-xl p-3"
            style={{ background: C.bg, border: `1px solid ${C.outline}` }}
          >
            <div className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: C.dim }}>
              {m.label}
            </div>
            <div className="text-sm font-bold font-mono tabular-nums" style={{ color: m.color }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Drawdown bar */}
      <div>
        <div className="flex justify-between text-[9px] font-mono mb-1.5" style={{ color: C.dim }}>
          <span>Drawdown</span>
          <span style={{ color: drawdown > 10 ? '#f87171' : drawdown > 5 ? '#fbbf24' : C.green }}>
            {drawdown.toFixed(1)}%
          </span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: C.outline }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(drawdown * (100 / 15), 100)}%`,
              background: drawdown > 10 ? '#f87171' : drawdown > 5 ? '#fbbf24' : C.green,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Grid de Robots ────────────────────────────────────────────────────────────
function RobotsGrid() {
  return (
    <div>
      <div
        className="text-[10px] font-mono uppercase tracking-[0.2em] mb-3"
        style={{ color: C.dim }}
      >
        Agentes Sintéticos
      </div>
      <div className="grid grid-cols-3 gap-3" style={{ minHeight: 220 }}>
        <RobotCard robotId="phantom" color="cyan"  />
        <RobotCard robotId="nexus"   color="green" />
        <RobotCard robotId="oracle"  color="amber" />
      </div>
    </div>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  return (
    <div
      className="flex gap-4 p-4 h-full"
      style={{ minHeight: 0 }}
    >
      {/* Coluna principal */}
      <div className="flex flex-col gap-4 flex-1 min-w-0 overflow-auto">
        {/* Portfólio */}
        <PortfolioCard />

        {/* Robôs */}
        <RobotsGrid />

        {/* Operações ativas */}
        <div
          className="rounded-2xl overflow-hidden flex-1"
          style={{
            border: `1px solid ${C.outline}`,
            background: C.surface,
            minHeight: 200,
          }}
        >
          <ActiveTrades />
        </div>
      </div>

      {/* Coluna lateral direita */}
      <div className="flex flex-col gap-4 w-80 flex-shrink-0">
        {/* Gráfico de equity */}
        <div
          className="rounded-2xl p-4 flex flex-col"
          style={{
            background: C.surface,
            border: `1px solid ${C.outline}`,
            height: 280,
          }}
        >
          <div
            className="text-[10px] font-mono uppercase tracking-[0.2em] mb-3"
            style={{ color: C.dim }}
          >
            Curva de Capital
          </div>
          <div className="flex-1 min-h-0">
            <EquityChart />
          </div>
        </div>

        {/* Radar */}
        <div
          className="rounded-2xl overflow-hidden flex-1"
          style={{
            background: C.surface,
            border: `1px solid ${C.outline}`,
            minHeight: 300,
          }}
        >
          <RadarPanel />
        </div>
      </div>
    </div>
  );
}
