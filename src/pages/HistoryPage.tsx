import { useStore } from '../store/useStore';
import TradeHistory from '../components/dashboard/TradeHistory';

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

// ─── Resumo de P&L cumulativo ──────────────────────────────────────────────────
function HistorySummary() {
  const tradeHistory = useStore(s => s.tradeHistory);

  const closed      = tradeHistory.filter(t => t.status === 'closed');
  const wins        = closed.filter(t => (t.pnl ?? 0) > 0);
  const losses      = closed.filter(t => (t.pnl ?? 0) <= 0);
  const totalPnl    = closed.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
  const winRate     = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const avgWin      = wins.length > 0   ? wins.reduce((a, t) => a + (t.pnl ?? 0), 0) / wins.length : 0;
  const avgLoss     = losses.length > 0 ? losses.reduce((a, t) => a + (t.pnl ?? 0), 0) / losses.length : 0;
  const profitFactor = losses.length > 0 && Math.abs(avgLoss) > 0
    ? Math.abs(avgWin / avgLoss)
    : null;

  // Por robô
  const byRobot: Record<string, { pnl: number; count: number }> = {};
  closed.forEach(t => {
    if (!byRobot[t.robotId]) byRobot[t.robotId] = { pnl: 0, count: 0 };
    byRobot[t.robotId].pnl   += t.pnl ?? 0;
    byRobot[t.robotId].count += 1;
  });

  const ROBOT_COLORS: Record<string, string> = {
    phantom: '#22D3EE',
    nexus:   '#34D399',
    oracle:  '#FBBF24',
    radar:   '#8B5CF6',
  };

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: C.surface, border: `1px solid ${C.outline}` }}
    >
      {/* Linha de métricas principais */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {[
          {
            label: 'P&L Cumulativo',
            value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(4)}`,
            color: totalPnl >= 0 ? C.green : '#f87171',
          },
          {
            label: 'Total de Trades',
            value: String(closed.length),
            color: C.text,
          },
          {
            label: 'Win Rate',
            value: `${winRate.toFixed(1)}%`,
            color: winRate >= 60 ? C.green : winRate >= 40 ? '#fbbf24' : '#f87171',
          },
          {
            label: 'P&L Médio Vitória',
            value: wins.length > 0 ? `+$${avgWin.toFixed(4)}` : '—',
            color: C.green,
          },
          {
            label: 'Profit Factor',
            value: profitFactor !== null ? profitFactor.toFixed(2) : '—',
            color: profitFactor !== null
              ? profitFactor >= 1.5 ? C.green : profitFactor >= 1 ? '#fbbf24' : '#f87171'
              : C.dim,
          },
        ].map(m => (
          <div
            key={m.label}
            className="rounded-xl p-3"
            style={{ background: C.bg, border: `1px solid ${C.outline}` }}
          >
            <div
              className="text-[9px] font-mono uppercase tracking-widest mb-1"
              style={{ color: C.dim }}
            >
              {m.label}
            </div>
            <div
              className="text-sm font-bold font-mono tabular-nums"
              style={{ color: m.color }}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Por robô */}
      {Object.keys(byRobot).length > 0 && (
        <div>
          <div
            className="text-[9px] font-mono uppercase tracking-[0.2em] mb-2"
            style={{ color: C.dim }}
          >
            Desempenho por Agente
          </div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(byRobot).map(([id, data]) => {
              const color = ROBOT_COLORS[id] ?? C.dim;
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                  style={{
                    background: `${color}10`,
                    border: `1px solid ${color}30`,
                  }}
                >
                  <span
                    className="text-[9px] font-mono font-bold uppercase tracking-widest"
                    style={{ color }}
                  >
                    {id}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: C.dim }}>
                    {data.count} trades
                  </span>
                  <span
                    className="text-[9px] font-mono font-bold tabular-nums"
                    style={{ color: data.pnl >= 0 ? C.green : '#f87171' }}
                  >
                    {data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(4)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HistoryPage ───────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const tradeCount = useStore(s => s.tradeHistory.length);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1
            className="text-xl font-bold tracking-widest mb-0.5"
            style={{ fontFamily: "'Orbitron', sans-serif", color: C.primary }}
          >
            HISTÓRICO
          </h1>
          <p className="text-xs font-mono" style={{ color: C.dim }}>
            Registro detalhado de todas as operações — {tradeCount} trade{tradeCount !== 1 ? 's' : ''} registrado{tradeCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Sumário de performance */}
      <HistorySummary />

      {/* Tabela full-width com mais espaço */}
      <div
        className="rounded-2xl overflow-hidden flex-1"
        style={{
          background: C.surface,
          border: `1px solid ${C.outline}`,
          minHeight: 400,
        }}
      >
        <TradeHistory />
      </div>
    </div>
  );
}
