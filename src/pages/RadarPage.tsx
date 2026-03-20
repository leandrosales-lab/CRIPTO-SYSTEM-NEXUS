import { useMemo, useRef, useEffect, useState } from 'react';
import axios from 'axios';
import { useStore } from '../store/useStore';
import RadarPanel, { SignalRow } from '../components/dashboard/RadarPanel';

// ─── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  bg:         '#111417',
  surface:    '#1d2023',
  surfaceLow: '#191c1f',
  surfaceHigh:'#272a2e',
  terminalBg: '#0b0e11',
  primary:    '#4cd6ff',
  green:      '#00e297',
  red:        '#ffb4ab',
  text:       '#e1e2e7',
  dim:        '#bbc9cf',
  outline:    '#3c494e',
  outlineVar: '#859399',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function ts(ms: number) {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour12: false });
}

// ─── ScannerPanel — coluna esquerda ───────────────────────────────────────────
function ScannerPanel() {
  const { radarSignals, radarScanCount } = useStore();
  const [scanning, setScanning] = useState(false);

  async function triggerScan() {
    setScanning(true);
    try { await axios.post('/api/radar/scan'); } catch (_) {}
    finally { setScanning(false); }
  }

  const sorted = useMemo(
    () => [...radarSignals].sort((a, b) => b.score - a.score),
    [radarSignals]
  );

  return (
    <section
      className="flex flex-col overflow-hidden"
      style={{
        width: 280,
        minWidth: 260,
        maxWidth: 300,
        background: `${C.surfaceLow}cc`,
        border: `1px solid rgba(255,255,255,0.05)`,
        borderRadius: 12,
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: `1px solid rgba(255,255,255,0.05)`, background: C.surface }}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base" style={{ color: C.primary }}>
            monitoring
          </span>
          <h2
            className="text-[11px] font-bold tracking-[0.16em] uppercase"
            style={{ color: C.primary, fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Scanner de Mercado
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px]" style={{ color: C.outlineVar }}>
            {radarScanCount > 0 ? `#${radarScanCount}` : '—'}
          </span>
          <button
            onClick={triggerScan}
            disabled={scanning}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            style={{ background: `${C.primary}20`, border: `1px solid ${C.primary}50`, color: C.primary }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
              {scanning ? 'hourglass_empty' : 'radar'}
            </span>
            {scanning ? 'SCAN...' : 'SCAN'}
          </button>
        </div>
      </div>

      {/* Tabela header */}
      <div
        className="grid gap-0 px-2 py-1.5 sticky top-0 flex-shrink-0"
        style={{
          gridTemplateColumns: '1fr 70px 52px 68px',
          background: C.surfaceLow,
          borderBottom: `1px solid rgba(255,255,255,0.04)`,
        }}
      >
        {['Ativo', 'Preço', '24H', 'Sinal'].map(h => (
          <span key={h} className="font-mono text-[8px] uppercase font-bold px-2" style={{ color: C.outline }}>
            {h}
          </span>
        ))}
      </div>

      {/* Lista */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: `${C.outline} transparent` }}
      >
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
            <span
              className="material-symbols-outlined text-3xl animate-pulse"
              style={{ color: C.outline }}
            >
              sensors
            </span>
            <p className="font-mono text-[9px] text-center" style={{ color: C.outlineVar }}>
              Aguardando sinais...
            </p>
          </div>
        ) : (
          sorted.map((signal, i) => (
            <SignalRow key={signal.symbol} signal={signal} index={i} />
          ))
        )}
      </div>

      {/* Footer count */}
      <div
        className="px-4 py-2 flex-shrink-0 flex items-center justify-between"
        style={{ borderTop: `1px solid rgba(255,255,255,0.05)` }}
      >
        <span className="font-mono text-[8px]" style={{ color: C.outlineVar }}>
          {sorted.filter(s => s.direction === 'LONG').length}L · {sorted.filter(s => s.direction === 'SHORT').length}S
        </span>
        <span className="font-mono text-[8px]" style={{ color: C.dim }}>
          {sorted.length} ativos
        </span>
      </div>
    </section>
  );
}

// ─── OperationPanel — coluna central superior ─────────────────────────────────
function OperationPanel() {
  const { activeTrades, tradeHistory, radarSignals, radarScanCount } = useStore();

  const radarTrades = useMemo(
    () => activeTrades.filter(t => t.robotId === 'radar'),
    [activeTrades]
  );

  // Stats globais
  const closedRadar = useMemo(
    () => tradeHistory.filter(t => t.robotId === 'radar'),
    [tradeHistory]
  );
  const wins   = closedRadar.filter(t => (t.pnl ?? 0) > 0).length;
  const losses = closedRadar.filter(t => (t.pnl ?? 0) <= 0).length;
  const total  = wins + losses;

  const activeStake    = radarTrades.reduce((s, t) => s + t.size, 0);
  const estReturn      = activeStake * 1.5;
  const winRate        = total > 0 ? ((wins / total) * 100).toFixed(1) : '—';
  const consecutiveWins = radarTrades.length;

  if (radarTrades.length > 0) {
    // Modo: operação ativa
    return (
      <div
        className="rounded-xl p-5 relative overflow-hidden"
        style={{
          background: C.surfaceHigh,
          borderLeft: `4px solid ${C.primary}`,
          boxShadow: `0 0 24px -6px rgba(76,214,255,0.25)`,
          border: `1px solid rgba(76,214,255,0.15)`,
          borderLeftWidth: 4,
          borderLeftColor: C.primary,
        }}
      >
        {/* Ícone decorativo */}
        <span
          className="material-symbols-outlined absolute top-3 right-4 select-none pointer-events-none"
          style={{ fontSize: 64, color: `${C.primary}18`, fontVariationSettings: "'FILL' 1" }}
        >
          sensors
        </span>

        <div className="relative z-10">
          <h2
            className="text-2xl font-black tracking-tight uppercase mb-1"
            style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Operação de {consecutiveWins} Trade{consecutiveWins !== 1 ? 's' : ''} Consecutivo{consecutiveWins !== 1 ? 's' : ''}
          </h2>
          <p className="text-[10px] uppercase tracking-widest mb-6" style={{ color: C.outlineVar }}>
            Juros Compostos Estratégicos Ativos · Alvo Atual: 1.5×
          </p>

          {/* Barras de progresso */}
          <div className="flex items-center gap-2 mb-8">
            {Array.from({ length: 6 }, (_, i) => {
              const done  = i < consecutiveWins - 1;
              const active = i === consecutiveWins - 1;
              return (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className="w-full h-2 rounded-full"
                    style={{
                      background: done ? C.green : active ? C.primary : C.outline,
                      animation: active ? 'pulse 1.5s ease-in-out infinite' : 'none',
                      boxShadow: active ? `0 0 8px ${C.primary}66` : 'none',
                    }}
                  />
                  <span
                    className="font-mono text-[8px] font-bold uppercase"
                    style={{ color: done ? C.green : active ? C.primary : C.outline, opacity: done || active ? 1 : 0.4 }}
                  >
                    {done ? `WIN #${i + 1}` : active ? 'EXEC' : `PEND`}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Cards de métricas */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Aposta Atual',       value: `$${activeStake.toFixed(2)}`,  sub: 'USDT', color: C.text },
              { label: 'Retorno Esperado',   value: `+$${estReturn.toFixed(2)}`,   sub: 'USDT', color: C.green },
              { label: 'Probabilidade Méd.', value: `${winRate}%`,                 sub: '',     color: C.primary },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="rounded-lg p-3" style={{ background: C.surfaceLow }}>
                <p className="text-[9px] uppercase font-bold mb-1" style={{ color: C.outlineVar }}>{label}</p>
                <p className="text-xl font-bold font-mono" style={{ color, fontFamily: "'Space Grotesk', sans-serif" }}>
                  {value}
                  {sub && <span className="text-[10px] ml-1" style={{ color: C.outlineVar }}>{sub}</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Modo: sem operações — stats globais
  return (
    <div
      className="rounded-xl p-5 relative overflow-hidden"
      style={{ background: C.surfaceHigh, border: `1px solid rgba(255,255,255,0.06)` }}
    >
      <span
        className="material-symbols-outlined absolute top-3 right-4 select-none pointer-events-none"
        style={{ fontSize: 64, color: `${C.primary}12`, fontVariationSettings: "'FILL' 1" }}
      >
        sensors
      </span>

      <div className="relative z-10">
        <h2
          className="text-xl font-black uppercase tracking-tight mb-1"
          style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Modo Scanner Ativo
        </h2>
        <p className="text-[10px] uppercase tracking-widest mb-5" style={{ color: C.outlineVar }}>
          Monitorando top 50 vol — filtrando força e score
        </p>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Scans Realizados',  value: radarScanCount > 0 ? radarScanCount.toLocaleString('pt-BR') : '—', color: C.primary },
            { label: 'Sinais Buffer',     value: String(radarSignals.length),                                        color: C.text   },
            { label: 'Sinais FORTE',      value: String(radarSignals.filter(s => s.strength === 'FORTE').length),   color: C.green  },
            { label: 'Win Rate',          value: total > 0 ? `${winRate}%` : '—',                                   color: C.primary },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg p-3" style={{ background: C.surfaceLow }}>
              <p className="text-[8px] uppercase font-bold mb-1" style={{ color: C.outlineVar }}>{label}</p>
              <p className="text-lg font-bold font-mono tabular-nums" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TelemetryPanel — coluna central inferior ─────────────────────────────────
function TelemetryPanel() {
  const { radarSignals, radarScanCount, radarLastScan, activeTrades, connected } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Gerar logs sintéticos a partir dos dados reais
  const logs = useMemo(() => {
    const lines: { time: number; level: string; msg: string }[] = [];

    if (radarLastScan > 0) {
      lines.push({ time: radarLastScan, level: 'SYS', msg: `Scan #${radarScanCount} concluído. ${radarSignals.length} sinal(is) no buffer.` });
    }

    radarSignals.slice(0, 8).forEach(s => {
      lines.push({
        time: s.scannedAt,
        level: 'SCAN',
        msg: `${s.symbol} — ${s.direction} score ${s.score} [${s.strength}] RSI:${s.rsi.toFixed(1)} Vol:${s.volumeSpike.toFixed(1)}×`,
      });
    });

    activeTrades.filter(t => t.robotId === 'radar').slice(0, 4).forEach(t => {
      lines.push({
        time: t.openTime,
        level: 'EXEC',
        msg: `ORDEM_EXECUTADA: ${t.direction} ${t.symbol} @ $${t.entryPrice.toFixed(t.entryPrice > 100 ? 2 : 4)} (${t.size} USD × ${t.leverage}x)`,
      });
    });

    lines.push({
      time: Date.now(),
      level: 'SYS',
      msg: `TELEMETRIA: ${connected ? 'Backend conectado.' : 'Backend OFFLINE.'} Sistema ${connected ? 'nominal' : 'degradado'}.`,
    });

    return lines.sort((a, b) => a.time - b.time).slice(-20);
  }, [radarSignals, radarScanCount, radarLastScan, activeTrades, connected]);

  // Auto-scroll para o fim
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const levelColor = (level: string) => {
    if (level === 'EXEC') return C.green;
    if (level === 'WARN') return '#fbbf24';
    if (level === 'ERR')  return C.red;
    return C.primary;
  };

  return (
    <div
      className="flex-1 rounded-xl flex flex-col overflow-hidden"
      style={{ background: C.surfaceLow, border: `1px solid rgba(255,255,255,0.05)` }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: `1px solid rgba(255,255,255,0.05)`, background: C.surfaceLow }}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base" style={{ color: C.primary }}>terminal</span>
          <span
            className="text-[11px] font-bold uppercase tracking-widest"
            style={{ color: C.text }}
          >
            Telemetria do Sistema
          </span>
        </div>
        <div className="flex gap-1.5">
          {[C.green, C.green, C.green].map((c, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ background: c, animation: i === 2 ? 'pulse 1.5s ease-in-out infinite' : 'none' }}
            />
          ))}
        </div>
      </div>

      {/* Logs */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1.5"
        style={{
          background: C.terminalBg,
          scrollbarWidth: 'thin',
          scrollbarColor: `${C.outline} transparent`,
          fontFamily: "'Space Mono', 'Courier New', monospace",
        }}
      >
        {logs.length === 0 ? (
          <p className="text-[10px] font-mono" style={{ color: C.outlineVar }}>
            Aguardando eventos do sistema...
          </p>
        ) : (
          logs.map((log, i) => (
            <p key={i} className="text-[11px] leading-relaxed" style={{ color: C.outline }}>
              <span style={{ color: levelColor(log.level) }}>[{ts(log.time)}]</span>
              {' '}
              <span style={{ color: levelColor(log.level), opacity: 0.8 }}>{log.level}:</span>
              {' '}
              {log.msg}
            </p>
          ))
        )}
        <p className="font-mono text-[11px] animate-pulse" style={{ color: C.primary }}>_</p>
      </div>
    </div>
  );
}

// ─── StatsPanel — coluna direita ──────────────────────────────────────────────
function StatsPanel() {
  const {
    tradeHistory,
    radarSignals,
    connected,
    uptime,
    startTime,
  } = useStore();

  const closedRadar = useMemo(
    () => tradeHistory.filter(t => t.robotId === 'radar'),
    [tradeHistory]
  );

  const wins   = closedRadar.filter(t => (t.pnl ?? 0) > 0).length;
  const losses = closedRadar.filter(t => (t.pnl ?? 0) <= 0).length;
  const total  = wins + losses;
  const winPct = total > 0 ? (wins / total) * 100 : 0;

  // Fechados esta semana (últimos 7 dias)
  const weekMs  = 7 * 24 * 3600 * 1000;
  const weekStart = Date.now() - weekMs;
  const weekTrades = closedRadar.filter(t => (t.closeTime ?? 0) > weekStart);
  const weekWins   = weekTrades.filter(t => (t.pnl ?? 0) > 0).length;
  const weekLosses = weekTrades.filter(t => (t.pnl ?? 0) <= 0).length;
  const weekPnl    = weekTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);

  // Uptime
  const uptimeMs  = uptime > 0 ? uptime : Date.now() - startTime;
  const uptimeSec = Math.floor(uptimeMs / 1000);
  const uptimeH   = Math.floor(uptimeSec / 3600).toString().padStart(2, '0');
  const uptimeM   = Math.floor((uptimeSec % 3600) / 60).toString().padStart(2, '0');
  const uptimeStr = `${uptimeH}h ${uptimeM}m`;

  return (
    <div className="flex flex-col gap-4" style={{ width: 260, minWidth: 240, maxWidth: 280 }}>

      {/* ── Eficiência de Vitórias ── */}
      <div
        className="rounded-xl p-5"
        style={{ background: C.surfaceHigh, border: `1px solid rgba(255,255,255,0.06)` }}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: C.outlineVar }}>
              Divergência do Sistema
            </h3>
            <p
              className="text-4xl font-bold font-mono tabular-nums"
              style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {total > 0 ? `${winPct.toFixed(1)}%` : '—'}
            </p>
          </div>
          <div
            className="p-2 rounded"
            style={{ background: `${C.green}15` }}
          >
            <span
              className="material-symbols-outlined"
              style={{ color: C.green, fontVariationSettings: "'FILL' 1", fontSize: 20 }}
            >
              trending_up
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {/* Wins/Losses total */}
          <div>
            <div className="flex justify-between items-end mb-1">
              <span className="text-[9px] uppercase font-bold" style={{ color: C.dim }}>
                wins / losses
              </span>
              <span className="text-[11px] font-mono" style={{ color: C.text }}>
                {wins}W / {losses}D
              </span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: C.surfaceLow }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${winPct}%`, background: C.green }}
              />
            </div>
          </div>

          {/* Semana */}
          <div>
            <div className="flex justify-between items-end mb-1">
              <span className="text-[9px] uppercase font-bold" style={{ color: C.dim }}>
                Semana
              </span>
              <span className="text-[11px] font-mono" style={{ color: weekPnl >= 0 ? C.green : C.red }}>
                {weekWins}V / {weekLosses}D
              </span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: C.surfaceLow }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: weekTrades.length > 0 ? `${(weekWins / weekTrades.length) * 100}%` : '0%',
                  background: C.green,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Módulo Robô: RADAR ── */}
      <div
        className="rounded-xl p-5 flex-1 flex flex-col"
        style={{ background: C.surfaceLow, border: `1px solid rgba(255,255,255,0.05)` }}
      >
        <h3 className="text-[9px] font-black uppercase tracking-widest mb-4" style={{ color: C.outlineVar }}>
          Módulo Robô: RADAR
        </h3>

        {/* Ícone animado + estado */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-shrink-0">
            <div
              className="w-11 h-11 rounded-full border-2 border-t-transparent"
              style={{ borderColor: C.primary, borderTopColor: 'transparent', animation: 'spin 1.4s linear infinite' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-sm" style={{ color: C.primary }}>radar</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase" style={{ color: C.text }}>Estado Operacional</p>
            <p className="text-[10px] font-mono" style={{ color: C.green }}>
              {connected ? 'OPERACIONAL' : 'OFFLINE'}
            </p>
          </div>
        </div>

        {/* Métricas */}
        <div className="space-y-0 flex-1">
          {[
            { label: 'Uptime',      value: uptimeStr,                             color: C.text     },
            { label: 'Latência',    value: '< 5ms',                               color: C.text     },
            { label: 'CPU',         value: '38%',                                 color: C.text     },
            { label: 'Buffer',      value: `${radarSignals.length} sinais`,        color: C.primary  },
            { label: 'Fator Risco', value: 'BAIXO',                               color: C.green    },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="flex justify-between items-center py-2"
              style={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}
            >
              <span className="text-[9px] uppercase font-bold" style={{ color: C.outlineVar }}>{label}</span>
              <span className="font-mono text-xs" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Botão ajustar */}
        <button
          className="w-full mt-4 py-2.5 rounded font-bold text-[11px] uppercase tracking-[0.18em] transition-all hover:opacity-90 active:scale-95"
          style={{ background: C.primary, color: '#001f28', fontFamily: "'Space Grotesk', sans-serif" }}
          onClick={() => {}}
        >
          Ajustar Parâmetros
        </button>
      </div>
    </div>
  );
}

// ─── RadarPage ─────────────────────────────────────────────────────────────────
export default function RadarPage() {
  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        background: `radial-gradient(circle at 50% 50%, #1a1f2460 1px, transparent 1px)`,
        backgroundSize: '30px 30px',
        backgroundColor: C.bg,
      }}
    >
      {/* ── Grade principal ── */}
      <div className="flex flex-1 gap-4 p-4 overflow-hidden h-full">

        {/* Coluna esquerda — Scanner */}
        <ScannerPanel />

        {/* Coluna central */}
        <div className="flex flex-col flex-1 gap-4 min-w-0 overflow-hidden">
          <OperationPanel />
          <TelemetryPanel />
          {/* RadarPanel de cards (trades simultâneos) */}
          <div
            className="rounded-xl overflow-hidden flex-shrink-0"
            style={{ maxHeight: 320, minHeight: 200, border: `1px solid rgba(255,255,255,0.05)` }}
          >
            <RadarPanel />
          </div>
        </div>

        {/* Coluna direita — Stats */}
        <StatsPanel />
      </div>
    </div>
  );
}
