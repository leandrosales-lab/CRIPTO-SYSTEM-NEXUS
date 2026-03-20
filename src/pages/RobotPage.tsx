import { useStore } from '../store/useStore';
import RobotCard from '../components/dashboard/RobotCard';
import ActiveTrades from '../components/dashboard/ActiveTrades';
import EquityChart from '../components/dashboard/EquityChart';

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

// ─── Props ─────────────────────────────────────────────────────────────────────
interface RobotPageProps {
  robotId: 'nexus' | 'phantom' | 'oracle';
}

// ─── Config por robô ───────────────────────────────────────────────────────────
const ROBOT_CONFIG: Record<RobotPageProps['robotId'], {
  name: string;
  color: 'cyan' | 'green' | 'amber';
  accent: string;
  strategy: string;
  description: string;
}> = {
  phantom: {
    name:        'PHANTOM',
    color:       'cyan',
    accent:      '#22D3EE',
    strategy:    'RSI(14) Scalping + BB Dinâmico',
    description: 'Robô de scalping de alta frequência baseado em RSI e Bandas de Bollinger dinâmicas. Opera em janelas curtas com foco em reversão à média.',
  },
  nexus: {
    name:        'NEXUS',
    color:       'green',
    accent:      '#34D399',
    strategy:    'RSI(14) + EMA Trend + MACD',
    description: 'Robô de seguimento de tendência combinando RSI, alinhamento de EMAs e confirmação MACD. Busca operações com momentum claro.',
  },
  oracle: {
    name:        'ORACLE',
    color:       'amber',
    accent:      '#FBBF24',
    strategy:    'VWAP Intraday Mean Reversion',
    description: 'Robô de reversão à média usando VWAP como referência intraday. Detecta desvios extremos de preço com alto grau de probabilidade estatística.',
  },
};

// ─── Stat Box ──────────────────────────────────────────────────────────────────
function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1"
      style={{ background: C.bg, border: `1px solid ${C.outline}` }}
    >
      <div className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.dim }}>
        {label}
      </div>
      <div
        className="text-base font-bold font-mono tabular-nums"
        style={{ color: color ?? C.text }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── RobotPage ─────────────────────────────────────────────────────────────────
export default function RobotPage({ robotId }: RobotPageProps) {
  const cfg    = ROBOT_CONFIG[robotId];
  const robot  = useStore(s => s.robots.find(r => r.id === robotId));
  const trades = useStore(s => s.activeTrades.filter(t => t.robotId === robotId));

  const winRate = robot
    ? ((robot.winCount + robot.lossCount) > 0
      ? (robot.winCount / (robot.winCount + robot.lossCount)) * 100
      : 0)
    : 0;

  const statusColors: Record<string, string> = {
    running: C.green,
    paused:  '#fbbf24',
    stopped: '#f87171',
    idle:    C.primary,
    error:   '#f87171',
  };

  const statusLabels: Record<string, string> = {
    running: 'EXECUTANDO',
    paused:  'PAUSADO',
    stopped: 'PARADO',
    idle:    'AGUARDANDO',
    error:   'ERRO',
  };

  const status      = robot?.status ?? 'idle';
  const statusColor = statusColors[status] ?? C.dim;
  const statusLabel = statusLabels[status] ?? 'DESCONHECIDO';

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      {/* Cabeçalho da página */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1
              className="text-2xl font-bold tracking-wider"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                color: cfg.accent,
              }}
            >
              {cfg.name}
            </h1>
            {/* Badge de status */}
            <span
              className="px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-widest"
              style={{
                background: `${statusColor}15`,
                border: `1px solid ${statusColor}40`,
                color: statusColor,
              }}
            >
              ● {statusLabel}
            </span>
          </div>
          <p className="text-sm" style={{ color: C.dim, maxWidth: 500 }}>
            {cfg.description}
          </p>
          <div
            className="mt-2 text-[10px] font-mono px-2 py-1 rounded inline-block"
            style={{
              background: `${cfg.accent}10`,
              borderLeft: `2px solid ${cfg.accent}40`,
              color: C.dim,
            }}
          >
            {cfg.strategy}
          </div>
        </div>
      </div>

      {/* Métricas do robô */}
      <div className="grid grid-cols-5 gap-3">
        <StatBox
          label="Capital"
          value={robot ? `$${robot.capital.toFixed(2)}` : '$0.00'}
          color={C.text}
        />
        <StatBox
          label="P&L Total"
          value={robot ? `${robot.totalPnl >= 0 ? '+' : ''}$${robot.totalPnl.toFixed(4)}` : '$0.0000'}
          color={robot ? (robot.totalPnl >= 0 ? C.green : '#f87171') : C.dim}
        />
        <StatBox
          label="P&L Hoje"
          value={robot ? `${robot.todayPnl >= 0 ? '+' : ''}$${robot.todayPnl.toFixed(4)}` : '$0.0000'}
          color={robot ? (robot.todayPnl >= 0 ? C.green : '#f87171') : C.dim}
        />
        <StatBox
          label="Win Rate"
          value={`${winRate.toFixed(1)}%`}
          color={winRate >= 60 ? C.green : winRate >= 40 ? '#fbbf24' : '#f87171'}
        />
        <StatBox
          label="Drawdown"
          value={robot ? `${robot.drawdown.toFixed(1)}%` : '0.0%'}
          color={robot ? (robot.drawdown > 10 ? '#f87171' : robot.drawdown > 5 ? '#fbbf24' : C.green) : C.dim}
        />
      </div>

      {/* Linha: Card do robô + Gráfico de equity */}
      <div className="grid grid-cols-3 gap-4">
        {/* Card de controle */}
        <div
          className="rounded-2xl p-4 flex flex-col"
          style={{
            background: C.surface,
            border: `1px solid ${C.outline}`,
            minHeight: 280,
          }}
        >
          <div
            className="text-[10px] font-mono uppercase tracking-[0.2em] mb-3"
            style={{ color: C.dim }}
          >
            Controle
          </div>
          <RobotCard robotId={robotId} color={cfg.color} />
        </div>

        {/* Histograma de vitórias/derrotas */}
        <div
          className="rounded-2xl p-4 flex flex-col"
          style={{ background: C.surface, border: `1px solid ${C.outline}` }}
        >
          <div
            className="text-[10px] font-mono uppercase tracking-[0.2em] mb-3"
            style={{ color: C.dim }}
          >
            Histórico de Operações
          </div>
          {robot ? (
            <div className="flex flex-col gap-3">
              {/* Win/loss bar */}
              <div>
                <div className="flex justify-between text-[9px] font-mono mb-1.5" style={{ color: C.dim }}>
                  <span>Vitórias: <span style={{ color: C.green }}>{robot.winCount}</span></span>
                  <span>Derrotas: <span style={{ color: '#f87171' }}>{robot.lossCount}</span></span>
                </div>
                <div className="h-2 rounded-full overflow-hidden flex" style={{ background: C.outline }}>
                  {(robot.winCount + robot.lossCount) > 0 && (
                    <>
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${winRate}%`,
                          background: `linear-gradient(90deg, #059669, ${C.green})`,
                        }}
                      />
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${100 - winRate}%`,
                          background: 'linear-gradient(90deg, #be123c, #f87171)',
                        }}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Stats adicionais */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[
                  { label: 'Total trades',   value: String(robot.winCount + robot.lossCount) },
                  { label: 'Ativas agora',   value: String(robot.activeTrades.length) },
                  { label: 'Símbolo',        value: robot.symbol || '—' },
                  { label: 'Último sinal',   value: robot.lastSignal || '—' },
                ].map(item => (
                  <div
                    key={item.label}
                    className="rounded-lg p-2"
                    style={{ background: C.bg, border: `1px solid ${C.outline}` }}
                  >
                    <div className="text-[8px] font-mono uppercase tracking-widest mb-0.5" style={{ color: C.dim }}>
                      {item.label}
                    </div>
                    <div className="text-xs font-mono font-semibold truncate" style={{ color: C.text }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[11px] font-mono" style={{ color: C.dim }}>
              Robô não inicializado
            </div>
          )}
        </div>

        {/* Curva de capital */}
        <div
          className="rounded-2xl p-4 flex flex-col"
          style={{ background: C.surface, border: `1px solid ${C.outline}` }}
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
      </div>

      {/* Posições ativas filtradas por robô */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: C.surface, border: `1px solid ${C.outline}` }}
      >
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: C.outline }}
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: C.dim }}>
            Posições Ativas — {cfg.name}
          </div>
          <span
            className="text-[9px] font-mono px-2 py-0.5 rounded-full"
            style={{ background: `${cfg.accent}15`, color: cfg.accent }}
          >
            {trades.length} posição{trades.length !== 1 ? 'ões' : ''}
          </span>
        </div>

        {trades.length === 0 ? (
          <div
            className="flex items-center justify-center py-12 text-[11px] font-mono"
            style={{ color: C.dim }}
          >
            Nenhuma posição ativa para {cfg.name}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.outline}` }}>
                  {['Par', 'Dir', 'Entrada', 'Tamanho', 'TP', 'SL', 'Notional'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left font-semibold uppercase tracking-widest"
                      style={{ color: C.dim }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr
                    key={t.id}
                    style={{ borderBottom: `1px solid ${C.outline}22` }}
                  >
                    <td className="px-4 py-2.5 font-semibold" style={{ color: C.text }}>{t.symbol}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="px-2 py-0.5 rounded text-[9px] font-bold"
                        style={{
                          background: t.direction === 'LONG' ? 'rgba(0,226,151,0.12)' : 'rgba(248,113,113,0.12)',
                          color: t.direction === 'LONG' ? C.green : '#f87171',
                        }}
                      >
                        {t.direction}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: C.text }}>
                      ${t.entryPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: C.dim }}>
                      {t.size.toFixed(4)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: C.green }}>
                      ${t.tpPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: '#f87171' }}>
                      ${t.slPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: C.dim }}>
                      ${t.notional.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
