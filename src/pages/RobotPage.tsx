import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useStore } from '../store/useStore';
import RobotModal from '../components/dashboard/RobotModal';

// ─── Paleta (fiel ao Stitch) ────────────────────────────────────────────────
const C = {
  bg:          '#111417',
  surface:     '#1d2023',
  surfaceLow:  '#191c1f',
  surfaceHigh: '#272a2e',
  surfaceTop:  '#323538',
  primary:     '#4cd6ff',
  green:       '#00e297',
  greenDim:    '#00ffab',
  red:         '#ffb4ab',
  amber:       '#ffd1d5',
  text:        '#e1e2e7',
  dim:         '#bbc9cf',
  outline:     '#3c494e',
};

// ─── Props ───────────────────────────────────────────────────────────────────
interface RobotPageProps {
  robotId?: 'nexus' | 'phantom' | 'oracle';
}

// ─── Config estático por robô ─────────────────────────────────────────────────
type RobotId = 'nexus' | 'phantom' | 'oracle';

interface RobotConfig {
  name:          string;
  moduleLabel:   string;
  strategy:      string;
  allocation:    string;
  leverage:      string;
  leverageType:  string;
  color:         string;       // accentHex
  borderColor:   string;
  glowColor:     string;
  chartLabel:    string;
  chartFill:     string;
  chartStroke:   string;
  chartPath:     string;      // SVG path estático (fallback quando sem dados)
}

const ROBOT_CONFIG: Record<RobotId, RobotConfig> = {
  nexus: {
    name:         'NEXUS',
    moduleLabel:  'Núcleo Neural',
    strategy:     'Scalpel V4 (HFT)',
    allocation:   '5,00 USDT',
    leverage:     '2x',
    leverageType: 'ISOLADA',
    color:        '#4cd6ff',
    borderColor:  '#4cd6ff',
    glowColor:    'rgba(164,230,255,0.15)',
    chartLabel:   'MATRIZ_VOLATILIDADE_PNL',
    chartFill:    'rgba(164,230,255,0.20)',
    chartStroke:  '#a4e6ff',
    chartPath:    'M0 40 L10 35 L20 38 L30 20 L40 25 L50 10 L60 15 L70 5 L80 12 L90 2 L100 8 V40 H0 Z',
  },
  phantom: {
    name:         'PHANTOM',
    moduleLabel:  'Módulo Furtivo',
    strategy:     'Trend Follower',
    allocation:   '5,00 USDT',
    leverage:     '2x',
    leverageType: 'ISOLADA',
    color:        '#00e297',
    borderColor:  '#00ffab',
    glowColor:    'rgba(0,255,171,0.15)',
    chartLabel:   'ANÁLISE_FLUXO_TENDÊNCIA',
    chartFill:    'rgba(0,255,171,0.20)',
    chartStroke:  '#00ffab',
    chartPath:    'M0 38 L15 30 L30 32 L45 18 L60 20 L75 10 L90 12 L100 5 V40 H0 Z',
  },
  oracle: {
    name:         'ORACLE',
    moduleLabel:  'Motor de Análise',
    strategy:     'Reversão à Média',
    allocation:   '5,00 USDT',
    leverage:     '2x',
    leverageType: 'ISOLADA',
    color:        '#ffd1d5',
    borderColor:  '#ffa9b2',
    glowColor:    'rgba(255,169,178,0.15)',
    chartLabel:   'DINÂMICA_DE_REVERSÃO',
    chartFill:    'rgba(255,169,178,0.20)',
    chartStroke:  '#ffa9b2',
    chartPath:    'M0 10 L20 25 L40 15 L60 35 L80 20 L100 30 V40 H0 Z',
  },
};

// ─── Status label / cor ───────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  running: 'EXECUTANDO',
  paused:  'PAUSADO',
  stopped: 'PARADO',
  idle:    'AGUARDANDO',
  error:   'ERRO',
};
const STATUS_COLOR: Record<string, string> = {
  running: '#00e297',
  paused:  '#ffd1d5',
  stopped: '#ffb4ab',
  idle:    '#4cd6ff',
  error:   '#ffb4ab',
};

// ─── Badge de status tipo Stitch ──────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? C.dim;
  const label = STATUS_LABEL[status] ?? 'DESCONHECIDO';
  return (
    <span
      className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
      style={{
        background: `${color}18`,
        border:     `1px solid ${color}40`,
        color,
      }}
    >
      ● {label}
    </span>
  );
}

// ─── Mini Sparkline SVG ───────────────────────────────────────────────────────
function MiniSparkline({
  points,
  cfg,
  pnlPositive,
}: {
  points: number[];
  cfg:    RobotConfig;
  pnlPositive: boolean;
}) {
  const strokeColor = pnlPositive ? cfg.chartStroke : '#ffb4ab';
  const fillColor   = pnlPositive ? cfg.chartFill   : 'rgba(255,180,171,0.15)';

  const svgPath = useMemo(() => {
    if (points.length < 2) return { stroke: cfg.chartPath, fill: cfg.chartPath };
    const min  = Math.min(...points);
    const max  = Math.max(...points);
    const rng  = max - min || 1;
    const step = 100 / (points.length - 1);
    const coords = points.map((v, i) => {
      const x = i * step;
      const y = 38 - ((v - min) / rng) * 34;
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return {
      stroke: `M${coords.join(' L')}`,
      fill:   `M${coords.join(' L')} V40 H0 Z`,
    };
  }, [points, cfg.chartPath]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg"
      style={{ height: 96, background: C.surfaceLow }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to top, ${pnlPositive ? cfg.chartFill : 'rgba(255,180,171,0.12)'}, transparent)`,
          pointerEvents: 'none',
        }}
      />
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
      >
        <path d={svgPath.fill}   fill={fillColor} />
        <path d={svgPath.stroke} fill="none" stroke={strokeColor} strokeWidth="0.5" />
      </svg>
      <span
        className="absolute top-2 left-2 font-mono pointer-events-none"
        style={{ fontSize: 8, color: `${cfg.color}80`, letterSpacing: '0.05em' }}
      >
        {cfg.chartLabel}
      </span>
    </div>
  );
}

// ─── Card de robô individual ──────────────────────────────────────────────────
function FleetRobotCard({ id }: { id: RobotId }) {
  const cfg          = ROBOT_CONFIG[id];
  const robot        = useStore(s => s.robots.find(r => r.id === id));
  const tradeHistory = useStore(s => s.tradeHistory);
  const [showModal, setShowModal] = useState(false);
  const [starting,  setStarting]  = useState(false);
  const [capitalInput, setCapitalInput] = useState(5);

  const r = robot ?? {
    id,
    name:         cfg.name,
    symbol:       '—',
    status:       'idle' as const,
    strategy:     cfg.strategy,
    totalPnl:     0,
    todayPnl:     0,
    winCount:     0,
    lossCount:    0,
    activeTrades: [],
    drawdown:     0,
    capital:      0,
  };

  const status     = r.status;
  const isRunning  = status === 'running';
  const isPaused   = status === 'paused';
  const isStopped  = status === 'stopped' || status === 'idle';
  const pnlPos     = r.todayPnl >= 0;
  const pnlSign    = pnlPos ? '+' : '';

  const allocationStr = r.capital > 0
    ? r.capital.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDT'
    : cfg.allocation;

  const sparkPoints = useMemo(() => {
    const my = tradeHistory
      .filter(t => t.robotId === id && t.status === 'closed' && t.pnl !== undefined)
      .slice(-30);
    if (my.length === 0) return [];
    let acc = 0;
    return my.map(t => { acc += t.pnl!; return acc; });
  }, [tradeHistory, id]);

  async function startRobot() {
    setStarting(true);
    try { await axios.post(`/api/robot/${id}/start`, { capital: capitalInput }); }
    catch (e) { console.error(e); }
    finally   { setStarting(false); }
  }

  async function stopRobot() {
    try { await axios.post(`/api/robot/${id}/command`, { command: 'stop' }); } catch (_) {}
  }

  async function sendCommand(cmd: string) {
    try { await axios.post(`/api/robot/${id}/command`, { command: cmd }); } catch (_) {}
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col rounded-xl group transition-all duration-300 cursor-pointer"
        style={{
          background:    'linear-gradient(135deg, rgba(39,42,46,0.85) 0%, rgba(25,28,31,0.92) 100%)',
          backdropFilter: 'blur(12px)',
          border:        `1px solid ${C.outline}`,
          borderLeft:    `4px solid ${cfg.borderColor}`,
          boxShadow:     isRunning ? `0 0 40px -10px ${cfg.glowColor}` : 'none',
          padding:       '2rem',
        }}
        onClick={() => robot && setShowModal(true)}
      >
        {/* ── Cabeçalho: módulo + nome | PnL + status ── */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <span
              className="text-[10px] font-bold tracking-[0.2em] px-2 py-1 rounded uppercase"
              style={{ background: `${cfg.color}18`, color: cfg.color }}
            >
              {cfg.moduleLabel}
            </span>
            <h3
              className="mt-2 text-3xl font-black uppercase tracking-tight"
              style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {cfg.name}
            </h3>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span
              className="text-xl font-bold tabular-nums"
              style={{
                color:      pnlPos ? C.green : C.red,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {pnlSign}{r.todayPnl.toFixed(1)}%
            </span>
            <span
              className="text-[10px] uppercase tracking-widest"
              style={{ color: C.dim }}
            >
              Desempenho 24H
            </span>
            <StatusBadge status={status} />
          </div>
        </div>

        {/* ── Linhas de info ── */}
        <div className="space-y-6 mb-10">
          <div
            className="flex justify-between items-center pb-4"
            style={{ borderBottom: `1px solid ${C.outline}20` }}
          >
            <span className="text-xs uppercase tracking-wider font-medium" style={{ color: C.dim }}>
              Estratégia
            </span>
            <span className="text-sm font-bold" style={{ color: cfg.color }}>
              {cfg.strategy}
            </span>
          </div>

          <div
            className="flex justify-between items-center pb-4"
            style={{ borderBottom: `1px solid ${C.outline}20` }}
          >
            <span className="text-xs uppercase tracking-wider font-medium" style={{ color: C.dim }}>
              Alocação de Banca
            </span>
            <span className="text-sm font-bold" style={{ color: C.text }}>
              {allocationStr}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs uppercase tracking-wider font-medium" style={{ color: C.dim }}>
              Alavancagem Binance
            </span>
            <span
              className="text-sm font-bold px-2 py-0.5 rounded"
              style={{ color: cfg.color, background: `${cfg.color}18` }}
            >
              {cfg.leverage} {cfg.leverageType}
            </span>
          </div>
        </div>

        {/* ── Seção condicional: parado vs. ativo ── */}
        {isStopped ? (
          <div
            className="mb-8 p-4 rounded-lg space-y-3"
            style={{ background: C.surfaceLow, border: `1px solid ${C.outline}` }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: C.dim }}>
              Capital de Alocação
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-2 rounded"
              style={{ background: C.bg, border: `1px solid ${cfg.color}40` }}
            >
              <span className="text-sm font-mono font-bold" style={{ color: cfg.color }}>$</span>
              <input
                type="number"
                min={1}
                step={1}
                value={capitalInput}
                onChange={e => setCapitalInput(Math.max(1, Number(e.target.value)))}
                className="flex-1 bg-transparent font-mono text-sm font-bold outline-none tabular-nums w-0"
                style={{ color: C.text }}
              />
            </div>
            <div className="flex gap-2">
              {[{ label: '$5', value: 5 }, { label: '$10', value: 10 }, { label: '$50', value: 50 }].map(p => (
                <button
                  key={p.value}
                  onClick={() => setCapitalInput(p.value)}
                  className="flex-1 py-1 rounded text-xs font-mono font-bold transition-all"
                  style={{
                    border:     capitalInput === p.value ? `1px solid ${cfg.color}70` : `1px solid ${C.outline}`,
                    background: capitalInput === p.value ? `${cfg.color}18` : 'transparent',
                    color:      capitalInput === p.value ? cfg.color : C.dim,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Modo ativo: PnL diário em destaque */
          <div className="mb-8 space-y-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: C.dim }}>
                PNL Diário
              </div>
              <div
                className="font-mono text-2xl font-bold tabular-nums"
                style={{ color: pnlPos ? C.green : C.red, fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {pnlPos ? '+' : '-'}${Math.abs(r.todayPnl).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div
              className="grid grid-cols-3 gap-2 text-[10px] font-mono pt-2"
              style={{ borderTop: `1px solid ${C.outline}30` }}
            >
              <div>
                <div style={{ color: C.dim }}>Ativas</div>
                <div className="font-bold" style={{ color: C.text }}>{r.activeTrades.length}</div>
              </div>
              <div>
                <div style={{ color: C.dim }}>Drawdown</div>
                <div className="font-bold" style={{ color: r.drawdown > 3 ? C.amber : C.green }}>
                  {r.drawdown.toFixed(1)}%
                </div>
              </div>
              <div>
                <div style={{ color: C.dim }}>PnL Total</div>
                <div className="font-bold tabular-nums" style={{ color: r.totalPnl >= 0 ? C.green : C.red }}>
                  {r.totalPnl >= 0 ? '+' : ''}{r.totalPnl.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Mini Sparkline ── */}
        <div className="relative mb-8" onClick={e => e.stopPropagation()}>
          <MiniSparkline points={sparkPoints} cfg={cfg} pnlPositive={pnlPos} />
        </div>

        {/* ── Botões de ação ── */}
        <div className="flex gap-3" onClick={e => e.stopPropagation()}>
          {isStopped ? (
            <button
              onClick={startRobot}
              disabled={starting}
              className="flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 hover:opacity-90 active:scale-95"
              style={{
                border:     `1px solid ${cfg.color}50`,
                background: `${cfg.color}18`,
                color:      cfg.color,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {starting ? '···' : 'ATIVAR ROBÔ'}
            </button>
          ) : (
            <>
              {/* Configurações */}
              <button
                onClick={() => robot && setShowModal(true)}
                className="flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-colors hover:bg-white/5"
                style={{
                  border:     `1px solid ${C.outline}40`,
                  background: 'transparent',
                  color:      C.text,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                CONFIGURAÇÕES
              </button>

              {/* Play / Pause */}
              {isRunning ? (
                <button
                  onClick={() => sendCommand('pause')}
                  className="w-12 h-10 flex items-center justify-center rounded-md hover:opacity-90 active:scale-95 transition-all"
                  style={{ background: '#00d1ff', color: '#003543' }}
                  title="Pausar"
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}
                  >
                    pause
                  </span>
                </button>
              ) : isPaused ? (
                <button
                  onClick={() => sendCommand('resume')}
                  className="w-12 h-10 flex items-center justify-center rounded-md hover:opacity-90 active:scale-95 transition-all"
                  style={{ background: '#00d1ff', color: '#003543' }}
                  title="Retomar"
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}
                  >
                    play_arrow
                  </span>
                </button>
              ) : null}

              {/* Parar */}
              <button
                onClick={stopRobot}
                className="w-12 h-10 flex items-center justify-center rounded-md hover:opacity-90 active:scale-95 transition-all"
                style={{ background: 'rgba(255,180,171,0.12)', border: '1px solid #ffb4ab40', color: '#ffb4ab' }}
                title="Parar robô"
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}
                >
                  stop
                </span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      {showModal && robot && (
        <RobotModal
          robot={robot}
          accentColor={cfg.color}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ─── Seção Saúde do Sistema ───────────────────────────────────────────────────
function SystemHealth() {
  const activeTrades  = useStore(s => s.activeTrades);
  const tradeHistory  = useStore(s => s.tradeHistory);
  const drawdown      = useStore(s => s.drawdown);

  const wins         = tradeHistory.filter(t => t.status === 'closed' && (t.pnl ?? 0) > 0).length;
  const totalClosed  = tradeHistory.filter(t => t.status === 'closed').length;
  const successRate  = totalClosed > 0 ? (wins / totalClosed) * 100 : 99.98;
  const safeMargin   = Math.max(0, (1 - drawdown / 100) * 100);
  const activeCount  = activeTrades.length;

  const metrics = [
    {
      label:      'Latência de API',
      value:      '12ms',
      barColor:   C.green,
      barWidth:   '15%',
    },
    {
      label:      'Taxa de Sucesso',
      value:      `${successRate.toFixed(2)}%`,
      barColor:   C.green,
      barWidth:   `${successRate.toFixed(0)}%`,
    },
    {
      label:      'Posições Ativas',
      value:      `${activeCount} Abertas`,
      barColor:   C.primary,
      barWidth:   `${Math.min(100, activeCount * 4)}%`,
    },
    {
      label:      'Margem de Segurança',
      value:      `${safeMargin.toFixed(1)}%`,
      barColor:   C.primary,
      barWidth:   `${safeMargin.toFixed(0)}%`,
    },
  ];

  return (
    <section
      className="mt-12 rounded-xl p-8"
      style={{
        background: C.surfaceLow,
        border:     `1px solid rgba(255,255,255,0.05)`,
      }}
    >
      <h4
        className="font-bold text-lg mb-6 uppercase tracking-tight"
        style={{ color: C.primary, fontFamily: "'Space Grotesk', sans-serif" }}
      >
        Saúde do Sistema e Latência
      </h4>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {metrics.map(m => (
          <div key={m.label} className="flex flex-col">
            <span
              className="text-[10px] uppercase tracking-widest mb-1"
              style={{ color: C.dim }}
            >
              {m.label}
            </span>
            <span
              className="text-xl font-bold"
              style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {m.value}
            </span>
            <div
              className="h-1 mt-2 rounded-full overflow-hidden"
              style={{ background: C.surfaceTop }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: m.barWidth, background: m.barColor }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── RobotPage ────────────────────────────────────────────────────────────────
const ALL_ROBOTS: RobotId[] = ['nexus', 'phantom', 'oracle'];

export default function RobotPage({ robotId }: RobotPageProps) {
  const robotsToShow: RobotId[] = robotId ? [robotId] : ALL_ROBOTS;

  return (
    <div
      className="flex flex-col p-8 min-h-full overflow-auto"
      style={{ background: C.bg }}
    >
      {/* ── Header da página ── */}
      <div className="mb-10">
        <h1
          className="text-4xl font-bold tracking-tight"
          style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Gestão de Robôs
        </h1>
        <p
          className="mt-2 text-sm max-w-2xl"
          style={{ color: C.dim }}
        >
          Monitoramento de automação de precisão para execução de Binance Futures em alta
          frequência. Controle estratégias neurais ativas e alocação de capital.
        </p>
      </div>

      {/* ── Grid de robôs ── */}
      <div
        className="grid gap-8"
        style={{
          gridTemplateColumns: robotsToShow.length === 1
            ? '1fr'
            : `repeat(${robotsToShow.length}, minmax(0, 1fr))`,
        }}
      >
        {robotsToShow.map(id => (
          <FleetRobotCard key={id} id={id} />
        ))}
      </div>

      {/* ── Saúde do Sistema ── */}
      <SystemHealth />
    </div>
  );
}
