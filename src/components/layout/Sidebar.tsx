import { useStore } from '../../store/useStore';
import NeonProgress from '../ui/NeonProgress';
import axios from 'axios';
import { useEffect, useState } from 'react';

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600).toString().padStart(2, '0');
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

const MODE_LABELS: Record<string, { label: string; color: string; dotClass: string }> = {
  paper:   { label: 'Paper Trading', color: '#22D3EE', dotClass: 'status-dot-paper' },
  testnet: { label: 'Testnet',       color: '#F59E0B', dotClass: 'status-dot-testnet' },
  live:    { label: 'LIVE — REAL',   color: '#10B981', dotClass: 'status-dot-live' },
};

const ROBOT_COLORS: Record<string, string> = {
  PHANTOM: '#22D3EE',
  NEXUS:   '#34D399',
  ORACLE:  '#FBBF24',
};

export default function Sidebar() {
  const { capital, totalPnl, drawdown, robots, activeTrades, killSwitchActive, mode, accountBalance, apiKeySet, setAccountBalance, setMode } = useStore();
  const totalTrades  = activeTrades.length;
  const uptime       = formatUptime(Date.now() - (useStore.getState().startTime || Date.now()));
  const winRates     = robots.map(r => { const t = r.winCount + r.lossCount; return t > 0 ? (r.winCount / t) * 100 : 0; });
  const avgWinRate   = winRates.length > 0 ? winRates.reduce((a, b) => a + b, 0) / winRates.length : 0;
  const activeRobots = robots.filter(r => r.status === 'running').length;
  const [refreshing, setRefreshing] = useState(false);

  async function fetchBalance() {
    setRefreshing(true);
    try {
      const r = await axios.get<{ mode: string; accountBalance: Record<string, number> | null }>('/api/account/balance');
      if (r.data.accountBalance) setAccountBalance(r.data.accountBalance as unknown as Parameters<typeof setAccountBalance>[0]);
      if (r.data.mode) setMode(r.data.mode as 'paper' | 'testnet' | 'live');
    } catch (_) {}
    setRefreshing(false);
  }

  useEffect(() => {
    if (mode !== 'paper' && apiKeySet) fetchBalance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, apiKeySet]);

  const bal = accountBalance as Record<string, number> | null;
  const isRealMode     = (mode === 'live' || mode === 'testnet') && bal;
  const walletBalance  = isRealMode ? (bal!.totalWalletBalance ?? 0) : null;
  const availableAmt   = isRealMode ? (bal!.availableBalance ?? 0) : null;
  const displayCapital = walletBalance !== null ? walletBalance : capital;
  const modeInfo       = MODE_LABELS[mode] ?? MODE_LABELS.paper;

  async function resetKillSwitch() {
    try { await axios.post('/api/kill-switch/reset'); } catch (_) {}
  }

  const divider = <div className="divider-glow mx-3" />;
  const sectionLabel = (text: string) => (
    <div className="px-4 pt-3.5 pb-1.5">
      <span className="label-xxs">{text}</span>
    </div>
  );

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col overflow-hidden"
      style={{ borderRight: '1px solid rgba(34,211,238,0.07)', background: 'rgba(5,7,15,0.65)', backdropFilter: 'blur(16px)' }}
    >
      {/* ── Visão Geral ── */}
      <div className="p-3 pb-1">
        {sectionLabel('Visão Geral')}

        {/* Capital card */}
        <div
          className="mx-1 p-3 rounded-xl mb-2"
          style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.1)' }}
        >
          <div className="flex justify-between items-baseline mb-0.5">
            <span className="label-xs">{isRealMode ? 'Saldo Binance' : 'Capital'}</span>
            <div className="flex items-center gap-1.5">
              {isRealMode && (
                <button
                  onClick={fetchBalance} disabled={refreshing}
                  title="Atualizar saldo"
                  className="text-slate-600 hover:text-cyan-400 transition-colors"
                  style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, lineHeight: 1 }}
                >
                  {refreshing ? '⟳' : '↺'}
                </button>
              )}
            </div>
          </div>
          <div className="value-xl" style={{ color: '#E2E8F0', marginBottom: 6 }}>
            ${displayCapital.toFixed(2)}
          </div>
          {availableAmt !== null && (
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, color: '#334155' }}>Disponível</span>
              <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: '#10B981', fontWeight: 600 }}>${Number(availableAmt).toFixed(2)}</span>
            </div>
          )}
          <NeonProgress value={Math.min(displayCapital, 2000)} max={2000} color="cyan" height={3} />
        </div>

        {/* Drawdown + Win Rate */}
        <div className="mx-1 space-y-2">
          <div
            className="p-2.5 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className="label-xs">Drawdown</span>
              <span
                className="value-md"
                style={{ color: drawdown > 10 ? '#EF4444' : drawdown > 5 ? '#F59E0B' : '#10B981' }}
              >
                {drawdown.toFixed(1)}%
              </span>
            </div>
            <NeonProgress value={drawdown} max={15} color={drawdown > 10 ? 'red' : drawdown > 5 ? 'amber' : 'green'} height={3} />
          </div>
          <div
            className="p-2.5 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className="label-xs">Taxa Acerto</span>
              <span className="value-md" style={{ color: '#22D3EE' }}>{avgWinRate.toFixed(0)}%</span>
            </div>
            <NeonProgress value={avgWinRate} max={100} color="cyan" height={3} />
          </div>
        </div>
      </div>

      {divider}

      {/* ── Métricas ── */}
      <div className="px-3 py-1">
        {sectionLabel('Métricas')}
        <div
          className="mx-1 rounded-xl overflow-hidden"
          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)' }}
        >
          {[
            { label: 'Operações',    value: `${totalTrades}/20`,  color: totalTrades > 15 ? '#F59E0B' : '#94A3B8' },
            { label: 'P&L Hoje',     value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(4)}`, color: totalPnl >= 0 ? '#10B981' : '#EF4444' },
            { label: 'Tempo Ativo',  value: uptime,               color: '#94A3B8' },
            { label: 'Robôs Ativos', value: `${activeRobots}/3`,  color: '#22D3EE' },
          ].map((item, i, arr) => (
            <div
              key={item.label}
              className="flex justify-between items-center px-3 py-2"
              style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
            >
              <span className="label-xs">{item.label}</span>
              <span className="value-md tabular-nums" style={{ color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {divider}

      {/* ── Robôs ── */}
      <div className="px-3 py-1 flex-1">
        {sectionLabel('Robôs')}
        <div className="mx-1 space-y-1.5">
          {robots.length === 0 ? (
            ['PHANTOM', 'NEXUS', 'ORACLE'].map(name => (
              <div
                key={name}
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                  <span style={{ fontFamily: "'Orbitron'", fontSize: 9, fontWeight: 600, color: ROBOT_COLORS[name] ?? '#94A3B8', letterSpacing: '0.1em' }}>
                    {name}
                  </span>
                </div>
                <span className="label-xxs">INATIVO</span>
              </div>
            ))
          ) : (
            robots.map(r => {
              const isRunning = r.status === 'running';
              const color     = ROBOT_COLORS[r.name] ?? '#94A3B8';
              return (
                <div
                  key={r.id}
                  className="px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${isRunning ? color + '22' : 'rgba(255,255,255,0.04)'}` }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isRunning ? 'live-dot' : ''}`}
                        style={{ background: isRunning ? color : '#334155', boxShadow: isRunning ? `0 0 6px ${color}80` : 'none' }}
                      />
                      <span style={{ fontFamily: "'Orbitron'", fontSize: 9, fontWeight: 600, color: isRunning ? color : '#94A3B8', letterSpacing: '0.1em' }}>
                        {r.name}
                      </span>
                    </div>
                    <span className="value-md tabular-nums" style={{ color: r.todayPnl >= 0 ? '#10B981' : '#EF4444' }}>
                      {r.todayPnl >= 0 ? '+' : ''}{r.todayPnl.toFixed(4)}
                    </span>
                  </div>
                  {isRunning && r.activeTrades.length > 0 && (
                    <div className="label-xxs" style={{ color: '#334155', paddingLeft: 14 }}>
                      {r.activeTrades.length} posição{r.activeTrades.length > 1 ? 'ões' : ''} ativa{r.activeTrades.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Kill Switch ── */}
      {killSwitchActive && (
        <div className="px-4 pb-2 pt-1" style={{ borderTop: '1px solid rgba(244,63,94,0.2)' }}>
          <button
            onClick={resetKillSwitch}
            className="w-full text-[9px] font-mono font-semibold py-2 rounded-lg uppercase tracking-wider transition-all hover:bg-rose-500/10"
            style={{
              fontFamily: "'JetBrains Mono'",
              border: '1px solid rgba(244,63,94,0.35)',
              color: '#FC8181',
              background: 'rgba(244,63,94,0.06)',
            }}
          >
            ■ Reset Kill Switch
          </button>
        </div>
      )}

      {/* ── Mode indicator ── */}
      <div
        className="px-4 py-2.5 flex items-center justify-center gap-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
          style={{ background: modeInfo.color, boxShadow: `0 0 6px ${modeInfo.color}` }}
        />
        <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: modeInfo.color }}>
          {modeInfo.label}
        </span>
      </div>
    </aside>
  );
}
