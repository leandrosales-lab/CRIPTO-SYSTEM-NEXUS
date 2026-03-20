import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import GlowBadge from '../ui/GlowBadge';
import NeonProgress from '../ui/NeonProgress';
import FlipNumber from '../ui/FlipNumber';
import RobotModal from './RobotModal';
import axios from 'axios';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Color = 'cyan' | 'green' | 'amber';

interface RobotCardProps {
  robotId: string;
  color: Color;
  showMiniChart?: boolean;
}

// ─── Config por robô (fiel ao Stitch) ─────────────────────────────────────────

interface RobotMeta {
  moduleLabel: string;     // ex: "NÚCLEO NEURAL"
  strategyLabel: string;   // ex: "Scalpel V4 (HFT)"
  allocation: string;      // ex: "5.000,00 USDT"
  leverage: string;        // ex: "10x CRUZADA"
  chartLabel: string;      // label no mini-chart
  accentHex: string;       // cor do SVG sparkline
}

const ROBOT_META: Record<string, RobotMeta> = {
  nexus: {
    moduleLabel:   'Núcleo Neural',
    strategyLabel: 'Scalpel V4 (HFT)',
    allocation:    '5,00 USDT',
    leverage:      '2x ISOLADA',
    chartLabel:    'MATRIZ_VOLATILIDADE_PNL',
    accentHex:     '#4cd6ff',
  },
  phantom: {
    moduleLabel:   'Módulo Furtivo',
    strategyLabel: 'Trend Follower',
    allocation:    '5,00 USDT',
    leverage:      '2x ISOLADA',
    chartLabel:    'ANÁLISE_FLUXO_TENDÊNCIA',
    accentHex:     '#00e297',
  },
  oracle: {
    moduleLabel:   'Motor de Análise',
    strategyLabel: 'Reversão à Média',
    allocation:    '5,00 USDT',
    leverage:      '2x ISOLADA',
    chartLabel:    'DINÂMICA_DE_REVERSÃO',
    accentHex:     '#ffd1d5',
  },
};

// ─── Paleta do Stitch ─────────────────────────────────────────────────────────

const COLOR_CFG: Record<Color, {
  accent: string;
  border: string;
  glow: string;
  badgeColor: 'cyan' | 'green' | 'amber';
}> = {
  cyan: {
    accent:      '#4cd6ff',
    border:      '#4cd6ff',
    glow:        'rgba(164,230,255,0.15)',
    badgeColor:  'cyan',
  },
  green: {
    accent:      '#00e297',
    border:      '#00e297',
    glow:        'rgba(0,255,171,0.15)',
    badgeColor:  'green',
  },
  amber: {
    accent:      '#ffd1d5',
    border:      '#ffd1d5',
    glow:        'rgba(255,169,178,0.15)',
    badgeColor:  'amber',
  },
};

const STATUS_MAP: Record<string, { label: string; color: 'cyan' | 'green' | 'red' | 'amber' }> = {
  running: { label: 'EXECUTANDO', color: 'green' },
  paused:  { label: 'PAUSADO',    color: 'amber' },
  stopped: { label: 'PARADO',     color: 'red'   },
  idle:    { label: 'AGUARDANDO', color: 'cyan'  },
  error:   { label: 'ERRO',       color: 'red'   },
};

const CAPITAL_PRESETS = [
  { label: '$5',  value: 5  },
  { label: '$10', value: 10 },
  { label: '$50', value: 50 },
];

// ─── Mini Sparkline SVG ────────────────────────────────────────────────────────

function MiniSparkline({
  points,
  accent,
  pnlPositive,
}: {
  points: number[];
  accent: string;
  pnlPositive: boolean;
}) {
  const color = pnlPositive ? '#00e297' : '#ffb4ab';
  const fillColor = pnlPositive ? 'rgba(0,226,151,0.15)' : 'rgba(255,180,171,0.15)';

  const path = useMemo(() => {
    if (points.length < 2) {
      // linha flat no meio
      return {
        stroke: 'M0 20 L100 20',
        fill: 'M0 20 L100 20 V40 H0 Z',
      };
    }
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const step = 100 / (points.length - 1);

    const coords = points.map((v, i) => {
      const x = i * step;
      const y = 38 - ((v - min) / range) * 34; // 4..38
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });

    const strokeD = `M${coords.join(' L')}`;
    const fillD   = `M${coords.join(' L')} V40 H0 Z`;
    return { stroke: strokeD, fill: fillD };
  }, [points]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg"
      style={{ height: 48, background: '#191c1f' }}
    >
      {/* gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to top, ${pnlPositive ? 'rgba(0,226,151,0.18)' : 'rgba(255,180,171,0.12)'}, transparent)`,
          pointerEvents: 'none',
        }}
      />
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
      >
        <path d={path.fill}   fill={fillColor} />
        <path d={path.stroke} fill="none" stroke={color} strokeWidth="0.8" />
      </svg>
      {/* label */}
      <span
        className="absolute top-1.5 left-2 font-mono"
        style={{ fontSize: 8, color: `${accent}99`, letterSpacing: '0.04em' }}
      >
        {/* deixamos o label vazio aqui — passado externamente */}
      </span>
    </div>
  );
}

// ─── Card principal ────────────────────────────────────────────────────────────

export default function RobotCard({
  robotId,
  color,
  showMiniChart = true,
}: RobotCardProps) {
  const robot        = useStore(s => s.robots.find(r => r.id === robotId));
  const tradeHistory = useStore(s => s.tradeHistory);

  const cfg  = COLOR_CFG[color];
  const meta = ROBOT_META[robotId] ?? {
    moduleLabel:   robotId.toUpperCase(),
    strategyLabel: robot?.strategy ?? '—',
    allocation:    '—',
    leverage:      '—',
    chartLabel:    '',
    accentHex:     cfg.accent,
  };

  const [showModal,    setShowModal]    = useState(false);
  const [capitalInput, setCapitalInput] = useState(5);
  const [starting,     setStarting]     = useState(false);

  // dados do robô (fallback)
  const r = robot ?? {
    id: robotId,
    name: robotId.charAt(0).toUpperCase() + robotId.slice(1),
    symbol: '—',
    status: 'idle' as const,
    strategy: meta.strategyLabel,
    totalPnl: 0, todayPnl: 0, winCount: 0, lossCount: 0,
    activeTrades: [], drawdown: 0, capital: 0,
    lastSignal: undefined,
  };

  const statusInfo = STATUS_MAP[r.status] ?? STATUS_MAP.idle;
  const total      = r.winCount + r.lossCount;
  const winRate    = total > 0 ? (r.winCount / total) * 100 : 0;
  const isRunning  = r.status === 'running';
  const isPaused   = r.status === 'paused';
  const isStopped  = r.status === 'stopped' || r.status === 'idle';
  const pnlPos     = r.todayPnl >= 0;

  // pontos do sparkline: PnL acumulado por trade fechado deste robô (últimos 30)
  const sparkPoints = useMemo(() => {
    const myTrades = tradeHistory
      .filter(t => t.robotId === robotId && t.status === 'closed' && t.pnl !== undefined)
      .slice(-30);
    if (myTrades.length === 0) return [];
    let acc = 0;
    return myTrades.map(t => { acc += t.pnl!; return acc; });
  }, [tradeHistory, robotId]);

  // allocation exibida: prefere capital real do robô se disponível, senão fallback do meta
  const allocationStr = r.capital > 0
    ? r.capital.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDT'
    : meta.allocation;

  // ações
  async function startRobot() {
    setStarting(true);
    try { await axios.post(`/api/robot/${robotId}/start`, { capital: capitalInput }); }
    catch (e) { console.error(e); }
    finally   { setStarting(false); }
  }

  async function sendCommand(cmd: string) {
    try { await axios.post(`/api/robot/${robotId}/command`, { command: cmd }); } catch (_) {}
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="flex flex-col rounded-xl cursor-pointer group transition-all duration-300"
        onClick={() => robot && setShowModal(true)}
        style={{
          background:   'linear-gradient(135deg, rgba(39,42,46,0.85) 0%, rgba(25,28,31,0.92) 100%)',
          backdropFilter: 'blur(12px)',
          border:       `1px solid #3c494e`,
          borderLeft:   `4px solid ${cfg.border}`,
          boxShadow:    isRunning ? `0 0 40px -10px ${cfg.glow}` : 'none',
          padding:      '1rem',
        }}
      >
        {/* ── Cabeçalho ── */}
        <div className="flex justify-between items-start mb-4">
          {/* esquerda: módulo + nome */}
          <div>
            <span
              className="text-[9px] font-bold tracking-[0.15em] px-1.5 py-0.5 rounded uppercase"
              style={{
                background: `${cfg.accent}18`,
                color:      cfg.accent,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {meta.moduleLabel}
            </span>
            <h3
              className="mt-1 text-lg font-black uppercase tracking-tight"
              style={{
                color:      '#e1e2e7',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {r.name.toUpperCase()}
            </h3>
          </div>

          {/* direita: PnL 24h + status badge */}
          <div className="flex flex-col items-end gap-0.5">
            <span style={{ color: pnlPos ? '#00e297' : '#ffb4ab', fontFamily: "'Space Grotesk', sans-serif" }}>
              <FlipNumber
                value={r.todayPnl}
                prefix={r.todayPnl >= 0 ? '+' : ''}
                suffix="%"
                decimals={1}
                className="text-sm font-bold"
              />
            </span>
            <span
              className="text-[9px] uppercase tracking-widest"
              style={{ color: '#bbc9cf' }}
            >
              24H
            </span>
            <GlowBadge label={statusInfo.label} color={statusInfo.color} dot={isRunning} />
          </div>
        </div>

        {/* ── Linhas de info ── */}
        <div className="space-y-2 mb-4">
          {/* Estratégia */}
          <div
            className="flex justify-between items-center pb-2"
            style={{ borderBottom: '1px solid rgba(60,73,78,0.4)' }}
          >
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: '#bbc9cf' }}>
              Estratégia
            </span>
            <span className="text-xs font-bold" style={{ color: cfg.accent }}>
              {meta.strategyLabel}
            </span>
          </div>

          {/* Alocação + Alavancagem na mesma linha */}
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: '#bbc9cf' }}>
              Banca / Alavancagem
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold" style={{ color: '#e1e2e7' }}>
                {allocationStr}
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ color: cfg.accent, background: `${cfg.accent}18` }}
              >
                {meta.leverage}
              </span>
            </div>
          </div>
        </div>

        {/* ── Seção condicional: parado vs. rodando ── */}
        {isStopped ? (
          /* Modo parado: input de capital */
          <div
            className="mb-4 p-3 rounded-lg space-y-2"
            style={{ background: '#191c1f', border: '1px solid #3c494e' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="text-[10px] font-mono uppercase tracking-widest mb-1"
              style={{ color: '#bbc9cf' }}
            >
              Capital de Alocação
            </div>

            {/* input */}
            <div
              className="flex items-center gap-1.5 px-3 py-2 rounded"
              style={{
                background: '#111417',
                border:     `1px solid ${cfg.accent}40`,
              }}
            >
              <span className="text-sm font-mono font-bold" style={{ color: cfg.accent }}>$</span>
              <input
                type="number"
                min={1}
                step={1}
                value={capitalInput}
                onChange={e => setCapitalInput(Math.max(1, Number(e.target.value)))}
                className="flex-1 bg-transparent font-mono text-sm font-bold outline-none tabular-nums w-0"
                style={{ color: '#e1e2e7' }}
              />
            </div>

            {/* presets */}
            <div className="flex gap-2">
              {CAPITAL_PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setCapitalInput(p.value)}
                  className="flex-1 py-1 rounded text-xs font-mono font-bold transition-all"
                  style={{
                    border:     capitalInput === p.value ? `1px solid ${cfg.accent}70` : '1px solid #3c494e',
                    background: capitalInput === p.value ? `${cfg.accent}18` : 'transparent',
                    color:      capitalInput === p.value ? cfg.accent : '#bbc9cf',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Modo ativo: PnL diário + win rate */
          <div className="mb-4 space-y-2">
            {/* PnL diário destaque */}
            <div>
              <div
                className="text-[10px] font-mono uppercase tracking-widest mb-1"
                style={{ color: '#bbc9cf' }}
              >
                PNL Diário
              </div>
              <div
                className="font-mono text-base font-bold tabular-nums"
                style={{ color: pnlPos ? '#00e297' : '#ffb4ab', fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {pnlPos ? '+' : '-'}${Math.abs(r.todayPnl).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Win rate */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#bbc9cf' }}>
                  Taxa de Acerto
                </span>
                <span className="text-xs font-mono font-bold" style={{ color: cfg.accent }}>
                  {winRate.toFixed(0)}% · {r.winCount}V/{r.lossCount}P
                </span>
              </div>
              <NeonProgress value={winRate} max={100} color={color === 'amber' ? 'amber' : color === 'green' ? 'green' : 'cyan'} height={3} />
            </div>

            {/* stats secundários */}
            <div
              className="grid grid-cols-3 gap-2 text-[10px] font-mono pt-2"
              style={{ borderTop: '1px solid rgba(60,73,78,0.3)' }}
            >
              <div>
                <div style={{ color: '#bbc9cf' }}>Ativas</div>
                <div className="font-bold" style={{ color: '#e1e2e7' }}>{r.activeTrades.length}</div>
              </div>
              <div>
                <div style={{ color: '#bbc9cf' }}>Drawdown</div>
                <div
                  className="font-bold"
                  style={{ color: r.drawdown > 3 ? '#ffd1d5' : '#00e297' }}
                >
                  {r.drawdown.toFixed(1)}%
                </div>
              </div>
              <div>
                <div style={{ color: '#bbc9cf' }}>PnL Total</div>
                <div
                  className="font-bold tabular-nums"
                  style={{ color: r.totalPnl >= 0 ? '#00e297' : '#ffb4ab' }}
                >
                  {r.totalPnl >= 0 ? '+' : ''}{r.totalPnl.toFixed(2)}
                </div>
              </div>
            </div>

            {/* último sinal */}
            {r.lastSignal && (
              <div
                className="px-2 py-1 rounded text-[9px] font-mono truncate"
                style={{
                  background:  '#191c1f',
                  borderLeft:  `2px solid ${cfg.accent}40`,
                  color:       '#bbc9cf',
                }}
              >
                {r.lastSignal}
              </div>
            )}
          </div>
        )}

        {/* ── Mini Sparkline ── */}
        {showMiniChart && (
          <div className="relative mb-3" onClick={e => e.stopPropagation()}>
            <MiniSparkline
              points={sparkPoints}
              accent={meta.accentHex}
              pnlPositive={pnlPos}
            />
            {/* label flutuante */}
            <span
              className="absolute top-1.5 left-2 font-mono pointer-events-none"
              style={{ fontSize: 8, color: `${meta.accentHex}80`, letterSpacing: '0.05em' }}
            >
              {meta.chartLabel}
            </span>
          </div>
        )}

        {/* ── Botões de ação ── */}
        <div className="flex gap-3" onClick={e => e.stopPropagation()}>
          {isStopped ? (
            /* Modo parado: botão único de ativar */
            <button
              onClick={startRobot}
              disabled={starting}
              className="flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 hover:opacity-90 active:scale-95"
              style={{
                border:     `1px solid rgba(60,73,78,0.4)`,
                background: 'transparent',
                color:      '#e1e2e7',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {starting ? '···' : 'ATIVAR ROBÔ'}
            </button>
          ) : isRunning ? (
            <>
              {/* Configurações */}
              <button
                onClick={() => robot && setShowModal(true)}
                className="flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-colors hover:bg-white/5"
                style={{
                  border:     `1px solid rgba(60,73,78,0.4)`,
                  background: 'transparent',
                  color:      '#e1e2e7',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Configurações
              </button>
              {/* Play/Pause btn */}
              <button
                onClick={() => sendCommand('pause')}
                className="w-12 h-10 flex items-center justify-center rounded-md hover:opacity-90 active:scale-95 transition-all"
                style={{ background: '#272a2e', color: '#e1e2e7' }}
                title="Pausar"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>pause</span>
              </button>
              {/* Stop btn */}
              <button
                onClick={() => sendCommand('stop')}
                className="w-10 h-10 flex items-center justify-center rounded-md hover:opacity-90 active:scale-95 transition-all"
                style={{ background: 'rgba(255,180,171,0.15)', color: '#ffb4ab', border: '1px solid rgba(255,180,171,0.3)' }}
                title="Parar"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>stop</span>
              </button>
            </>
          ) : isPaused ? (
            <>
              <button
                onClick={() => robot && setShowModal(true)}
                className="flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-colors hover:bg-white/5"
                style={{
                  border:     `1px solid rgba(60,73,78,0.4)`,
                  background: 'transparent',
                  color:      '#e1e2e7',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Configurações
              </button>
              {/* Resume btn */}
              <button
                onClick={() => sendCommand('resume')}
                className="w-12 h-10 flex items-center justify-center rounded-md hover:opacity-90 active:scale-95 transition-all"
                style={{ background: '#272a2e', color: '#e1e2e7' }}
                title="Retomar"
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}
                >
                  play_arrow
                </span>
              </button>
              <button
                onClick={() => sendCommand('stop')}
                className="w-10 h-10 flex items-center justify-center rounded-md hover:opacity-90 active:scale-95 transition-all"
                style={{ background: 'rgba(255,180,171,0.15)', color: '#ffb4ab', border: '1px solid rgba(255,180,171,0.3)' }}
                title="Parar"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>stop</span>
              </button>
            </>
          ) : null}
        </div>
      </motion.div>

      {showModal && robot && (
        <RobotModal
          robot={robot}
          accentColor={cfg.accent}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
