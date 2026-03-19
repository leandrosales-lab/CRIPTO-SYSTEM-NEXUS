import { useStore } from '../../store/useStore';
import FlipNumber from '../ui/FlipNumber';
import NeonProgress from '../ui/NeonProgress';

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="stat-section-header">
      <span>{children}</span>
    </div>
  );
}

function MetricRow({
  label, sublabel, children
}: { label: string; sublabel?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 card-hover" style={{ minHeight: 36 }}>
      <div>
        <div className="label-xs">{label}</div>
        {sublabel && <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, color: '#1E293B' }}>{sublabel}</div>}
      </div>
      <div className="value-md">{children}</div>
    </div>
  );
}

const ROBOT_COLORS: Record<string, string> = {
  phantom: '#22D3EE',
  nexus:   '#34D399',
  oracle:  '#FBBF24',
  radar:   '#A78BFA',
};

export default function StatPanel() {
  const { robots, tradeHistory, capital, totalPnl, drawdown, activeTrades } = useStore();
  const initialCapital = capital - totalPnl || 100;
  const totalTrades = tradeHistory.length;
  const wins   = tradeHistory.filter(t => (t.pnl || 0) > 0).length;
  const losses = totalTrades - wins;
  const winRate      = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const totalPnlPct  = initialCapital > 0 ? (totalPnl / initialCapital) * 100 : 0;
  const pnls         = tradeHistory.map(t => t.pnl || 0);
  const avgWin       = wins > 0 ? pnls.filter(p => p > 0).reduce((a, b) => a + b, 0) / wins : 0;
  const avgLoss      = losses > 0 ? Math.abs(pnls.filter(p => p < 0).reduce((a, b) => a + b, 0)) / losses : 0;
  const profitFactor = avgLoss > 0 ? (avgWin * wins) / (avgLoss * losses) : 0;
  const returns      = pnls.map(p => p / 100);
  const avgReturn    = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev       = returns.length > 1 ? Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length) : 0;
  const sharpe       = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  return (
    <div
      className="w-full h-full flex flex-col rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Header */}
      <div
        className="px-3 py-2.5 flex-shrink-0 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(34,211,238,0.07)', background: 'rgba(0,0,0,0.2)' }}
      >
        <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#22D3EE' }}>
          Análise
        </span>
        <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: '#334155' }}>
          {totalTrades} trades
        </span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

        {/* ── Performance ── */}
        <SectionHeader>Performance</SectionHeader>

        <MetricRow label="P&L Total">
          <FlipNumber value={totalPnl} prefix="$" decimals={4} colorize />
        </MetricRow>

        <MetricRow label="Retorno">
          <span style={{ color: totalPnlPct >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
            {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
          </span>
        </MetricRow>

        {/* Win Rate with progress */}
        <div className="px-3 pt-2 pb-2.5">
          <div className="flex justify-between items-center mb-1.5">
            <span className="label-xs">Taxa de Acerto</span>
            <span className="value-md" style={{ color: '#22D3EE' }}>{winRate.toFixed(1)}%</span>
          </div>
          <NeonProgress value={winRate} max={100} color="cyan" height={3} />
          <div className="flex justify-between mt-1.5">
            <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, color: '#10B981' }}>{wins}V</span>
            <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, color: '#334155' }}>{totalTrades}</span>
            <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, color: '#EF4444' }}>{losses}P</span>
          </div>
        </div>

        {/* ── Risco ── */}
        <SectionHeader>Risco</SectionHeader>

        <MetricRow label="Sharpe">
          <span style={{ color: sharpe > 1 ? '#10B981' : sharpe > 0 ? '#F59E0B' : '#EF4444', fontWeight: 700 }}>
            {isFinite(sharpe) ? sharpe.toFixed(2) : '—'}
          </span>
        </MetricRow>

        <MetricRow label="Fator de Lucro">
          <span style={{ color: profitFactor > 1.5 ? '#10B981' : profitFactor > 1 ? '#F59E0B' : '#EF4444', fontWeight: 700 }}>
            {profitFactor > 0 && isFinite(profitFactor) ? profitFactor.toFixed(2) : '—'}
          </span>
        </MetricRow>

        {/* Drawdown progress */}
        <div className="px-3 pt-2 pb-2.5">
          <div className="flex justify-between items-center mb-1.5">
            <span className="label-xs">Drawdown</span>
            <span className="value-md" style={{ color: drawdown > 10 ? '#EF4444' : drawdown > 5 ? '#F59E0B' : '#10B981', fontWeight: 700 }}>
              {drawdown.toFixed(2)}%
            </span>
          </div>
          <NeonProgress value={drawdown} max={15} color={drawdown > 10 ? 'red' : drawdown > 5 ? 'amber' : 'green'} height={3} />
        </div>

        {/* ── Atividade ── */}
        <SectionHeader>Atividade</SectionHeader>

        <MetricRow label="Ganho Médio" sublabel="por trade vencedor">
          <span style={{ color: '#10B981', fontWeight: 700 }}>+${avgWin.toFixed(3)}</span>
        </MetricRow>

        <MetricRow label="Perda Média" sublabel="por trade perdedor">
          <span style={{ color: '#EF4444', fontWeight: 700 }}>-${avgLoss.toFixed(3)}</span>
        </MetricRow>

        <MetricRow label="Posições Abertas">
          <span style={{ color: activeTrades.length > 15 ? '#F59E0B' : '#94A3B8', fontWeight: 700 }}>
            {activeTrades.length}<span style={{ color: '#334155', fontSize: 10, fontWeight: 400 }}>/20</span>
          </span>
        </MetricRow>

        {/* ── Por Robô ── */}
        {robots.length > 0 && (
          <>
            <SectionHeader>Por Robô</SectionHeader>
            <div className="px-3 pb-3 space-y-1.5">
              {robots.map(r => {
                const color = ROBOT_COLORS[r.id] ?? '#94A3B8';
                const total = r.winCount + r.lossCount;
                const wr = total > 0 ? (r.winCount / total) * 100 : 0;
                return (
                  <div
                    key={r.id}
                    className="rounded-lg p-2"
                    style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${color}28` }}
                  >
                    {/* Nome + status dot + P&L */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span style={{
                          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                          background: r.status === 'running' ? '#10B981' : r.status === 'paused' ? '#F59E0B' : '#334155',
                          boxShadow: r.status === 'running' ? '0 0 5px #10B981' : 'none',
                          display: 'inline-block',
                        }} />
                        <span style={{ fontFamily: "'Orbitron'", fontSize: 9, fontWeight: 600, color, letterSpacing: '0.1em' }}>
                          {r.name}
                        </span>
                      </div>
                      <span
                        className="value-md tabular-nums"
                        style={{ color: r.totalPnl >= 0 ? '#10B981' : '#EF4444' }}
                      >
                        {r.totalPnl >= 0 ? '+' : ''}{r.totalPnl.toFixed(4)}
                      </span>
                    </div>
                    {/* Win rate bar */}
                    <div style={{ height: 2, background: '#1E293B', borderRadius: 1, marginBottom: 4 }}>
                      <div style={{ height: '100%', width: `${wr}%`, background: color, borderRadius: 1, opacity: 0.7 }} />
                    </div>
                    <div className="flex justify-between">
                      <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, color: '#334155' }}>
                        {r.winCount}V / {r.lossCount}P
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, color: `${color}BB` }}>
                        {total > 0 ? `${wr.toFixed(0)}% acerto` : 'sem trades'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
