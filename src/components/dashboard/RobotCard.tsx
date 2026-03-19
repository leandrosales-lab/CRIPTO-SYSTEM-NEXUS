import { motion } from 'framer-motion';
import { useState } from 'react';
import { useStore } from '../../store/useStore';
import GlowBadge from '../ui/GlowBadge';
import NeonProgress from '../ui/NeonProgress';
import FlipNumber from '../ui/FlipNumber';
import RobotModal from './RobotModal';
import axios from 'axios';

type Color = 'cyan' | 'green' | 'amber';

interface RobotCardProps {
  robotId: string;
  color: Color;
}

const colorCfg: Record<Color, { accent: string; glowBorder: string; badgeColor: 'cyan' | 'green' | 'amber'; icon: string }> = {
  cyan:  { accent: '#22D3EE', glowBorder: 'rgba(34,211,238,0.22)', badgeColor: 'cyan',  icon: '◈' },
  green: { accent: '#34D399', glowBorder: 'rgba(52,211,153,0.22)', badgeColor: 'green', icon: '⬡' },
  amber: { accent: '#FBBF24', glowBorder: 'rgba(251,191,36,0.18)', badgeColor: 'amber', icon: '◎' },
};

const statusMap: Record<string, { label: string; color: 'cyan' | 'green' | 'red' | 'amber' }> = {
  running: { label: 'EXECUTANDO', color: 'green' },
  paused:  { label: 'PAUSADO',    color: 'amber' },
  stopped: { label: 'PARADO',     color: 'red'   },
  idle:    { label: 'AGUARDANDO', color: 'cyan'  },
  error:   { label: 'ERRO',       color: 'red'   },
};

const CAPITAL_PRESETS = [10, 25, 33, 50];

function RobotCardSkeleton({ color }: { color: Color }) {
  const cfg = colorCfg[color];
  return (
    <div
      className="flex-1 flex flex-col gap-2 p-3 rounded-xl animate-pulse"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg" style={{ background: `${cfg.accent}10` }} />
          <div className="space-y-1.5">
            <div className="h-2.5 w-14 rounded" style={{ background: `${cfg.accent}15` }} />
            <div className="h-2 w-10 rounded bg-white/5" />
          </div>
        </div>
        <div className="h-4 w-16 rounded-full bg-white/5" />
      </div>
      <div className="h-2 w-full rounded bg-white/5" />
      <div className="h-14 w-full rounded-lg bg-white/5" />
      <div className="h-2 w-full rounded bg-white/5" />
      <div className="h-6 w-full rounded-md bg-white/5" />
    </div>
  );
}

export default function RobotCard({ robotId, color }: RobotCardProps) {
  const robot = useStore(s => s.robots.find(r => r.id === robotId));
  const cfg = colorCfg[color];
  const [showModal, setShowModal] = useState(false);
  const [capitalInput, setCapitalInput] = useState(33);
  const [starting, setStarting] = useState(false);

  const r = robot ?? {
    id: robotId,
    name: robotId.toUpperCase(),
    symbol: '—',
    status: 'idle' as const,
    strategy: robotId === 'phantom' ? 'RSI(14) Scalping + BB Dinâmico' : robotId === 'nexus' ? 'RSI(14) + EMA Trend + MACD' : 'VWAP Intraday Mean Reversion',
    totalPnl: 0, todayPnl: 0, winCount: 0, lossCount: 0,
    activeTrades: [], drawdown: 0, capital: 0, lastSignal: undefined,
  };

  const status = statusMap[r.status] || statusMap.idle;
  const total = r.winCount + r.lossCount;
  const winRate = total > 0 ? (r.winCount / total) * 100 : 0;
  const isRunning = r.status === 'running';
  const isPaused  = r.status === 'paused';
  const isStopped = r.status === 'stopped' || r.status === 'idle';

  async function startRobot() {
    setStarting(true);
    try { await axios.post(`/api/robot/${robotId}/start`, { capital: capitalInput }); }
    catch (e) { console.error(e); }
    finally { setStarting(false); }
  }

  async function sendCommand(cmd: string) {
    try { await axios.post(`/api/robot/${robotId}/command`, { command: cmd }); } catch (_) {}
  }

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex-1 flex flex-col gap-2 p-3 rounded-xl cursor-pointer"
      onClick={() => robot && setShowModal(true)}
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid ${isRunning ? cfg.glowBorder : 'rgba(255,255,255,0.06)'}`,
        boxShadow: isRunning ? `0 0 18px ${cfg.accent}12` : 'none',
        transition: 'box-shadow 0.4s ease',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
            style={{ background: `${cfg.accent}15`, border: `1px solid ${cfg.accent}30`, color: cfg.accent }}
          >
            {cfg.icon}
          </div>
          <div>
            <div className="text-xs font-bold tracking-wider leading-none" style={{ fontFamily: "'Orbitron', sans-serif", color: cfg.accent }}>
              {r.name}
            </div>
            <div className="text-[8px] font-mono text-slate-500 mt-0.5 truncate max-w-[120px]">
              {r.symbol !== '—' ? r.symbol : 'Aguardando'}
            </div>
          </div>
        </div>
        <GlowBadge label={status.label} color={status.color} dot={isRunning} />
      </div>

      {/* Strategy */}
      <div
        className="text-[8px] font-mono text-slate-500 px-2 py-1 rounded truncate"
        style={{ background: 'rgba(0,0,0,0.25)', borderLeft: `2px solid ${cfg.accent}30` }}
      >
        {r.strategy}
      </div>

      {/* Capital input OR live metrics */}
      {isStopped ? (
        <div
          className="p-2 rounded-lg space-y-1.5"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">Capital ($)</div>
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded"
            style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${cfg.accent}30` }}
          >
            <span className="text-[9px] font-mono font-bold" style={{ color: cfg.accent }}>$</span>
            <input
              type="number" min={1} max={100} step={1} value={capitalInput}
              onChange={e => setCapitalInput(Math.max(1, Math.min(100, Number(e.target.value))))}
              className="flex-1 bg-transparent font-mono text-xs font-bold text-slate-100 outline-none tabular-nums w-0"
            />
          </div>
          <div className="flex gap-1">
            {CAPITAL_PRESETS.map(v => (
              <button
                key={v}
                onClick={() => setCapitalInput(v)}
                className="flex-1 font-mono text-[8px] py-0.5 rounded transition-all"
                style={{
                  border: capitalInput === v ? `1px solid ${cfg.accent}60` : '1px solid rgba(255,255,255,0.08)',
                  background: capitalInput === v ? `${cfg.accent}10` : 'transparent',
                  color: capitalInput === v ? cfg.accent : '#64748b',
                }}
              >
                ${v}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: 'P&L', content: <FlipNumber value={r.todayPnl} prefix="$" decimals={4} colorize className="text-xs font-bold" /> },
            { label: 'Capital', content: <span className="text-xs font-mono font-bold text-slate-100">${r.capital.toFixed(2)}</span> },
          ].map(({ label, content }) => (
            <div key={label} className="p-2 rounded" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-[8px] font-mono text-slate-500 uppercase mb-0.5">{label}</div>
              {content}
            </div>
          ))}
        </div>
      )}

      {/* Win rate — only when running */}
      {!isStopped && (
        <div>
          <div className="flex justify-between items-center mb-1 text-[8px] font-mono">
            <span className="text-slate-500">Acerto</span>
            <span className="text-cyan-400">{winRate.toFixed(0)}% · {r.winCount}V/{r.lossCount}P</span>
          </div>
          <NeonProgress value={winRate} max={100} color={cfg.badgeColor} height={2} />
        </div>
      )}

      {/* Bottom stats row */}
      {!isStopped && (
        <div className="flex justify-between text-[8px] font-mono">
          <span className="text-slate-500">Ativas: <span className="text-slate-300">{r.activeTrades.length}</span></span>
          <span className="text-slate-500">DD: <span className={r.drawdown > 3 ? 'text-amber-400' : 'text-emerald-400'}>{r.drawdown.toFixed(1)}%</span></span>
          <span className={r.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{r.totalPnl >= 0 ? '+' : ''}{r.totalPnl.toFixed(4)}</span>
        </div>
      )}

      {/* Last signal */}
      {r.lastSignal && !isStopped && (
        <div
          className="px-2 py-1 rounded text-[8px] font-mono text-slate-400 truncate"
          style={{ background: 'rgba(0,0,0,0.3)', borderLeft: `2px solid ${cfg.accent}20` }}
        >
          {r.lastSignal}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-1 mt-auto" onClick={e => e.stopPropagation()}>
        {isStopped ? (
          <button
            onClick={startRobot} disabled={starting}
            className="flex-1 text-[9px] font-mono py-1.5 rounded-md uppercase tracking-wider font-bold transition-all disabled:opacity-40"
            style={{ background: `${cfg.accent}15`, border: `1px solid ${cfg.accent}40`, color: cfg.accent }}
          >
            {starting ? '···' : '▶ Iniciar'}
          </button>
        ) : isRunning ? (
          <>
            <button onClick={() => sendCommand('pause')} className="flex-1 text-[8px] font-mono py-1 rounded uppercase tracking-wider text-amber-400 hover:bg-amber-400/10 transition-all" style={{ border: '1px solid rgba(251,191,36,0.3)' }}>‖ Pausar</button>
            <button onClick={() => sendCommand('stop')} className="flex-1 text-[8px] font-mono py-1 rounded uppercase tracking-wider text-rose-400 hover:bg-rose-400/10 transition-all" style={{ border: '1px solid rgba(244,63,94,0.3)' }}>■ Parar</button>
          </>
        ) : isPaused ? (
          <>
            <button onClick={() => sendCommand('resume')} className="flex-1 text-[8px] font-mono py-1 rounded uppercase tracking-wider text-emerald-400 hover:bg-emerald-400/10 transition-all" style={{ border: '1px solid rgba(52,211,153,0.3)' }}>▶ Retomar</button>
            <button onClick={() => sendCommand('stop')} className="px-2.5 text-[8px] font-mono py-1 rounded uppercase text-rose-400 hover:bg-rose-400/10 transition-all" style={{ border: '1px solid rgba(244,63,94,0.2)' }}>■</button>
          </>
        ) : null}
      </div>
    </motion.div>

    {showModal && robot && (
      <RobotModal robot={robot} accentColor={cfg.accent} onClose={() => setShowModal(false)} />
    )}
    </>
  );
}
