import { useStore } from '../store/useStore';
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

// ─── Telemetria do sistema ─────────────────────────────────────────────────────
function SystemTelemetry() {
  const {
    connected,
    activeTrades,
    radarSignals,
    radarScanCount,
    radarLastScan,
    robots,
    uptime,
    startTime,
  } = useStore();

  const activeRobots       = robots.filter(r => r.status === 'running').length;
  const totalPositions     = activeTrades.length;
  const forteSignals       = radarSignals.filter(s => s.strength === 'FORTE').length;
  const moderateSignals    = radarSignals.filter(s => s.strength === 'MODERADO').length;

  // Uptime calculado
  const uptimeMs = uptime > 0 ? uptime : Date.now() - startTime;
  const uptimeSec = Math.floor(uptimeMs / 1000);
  const uptimeH   = Math.floor(uptimeSec / 3600).toString().padStart(2, '0');
  const uptimeM   = Math.floor((uptimeSec % 3600) / 60).toString().padStart(2, '0');
  const uptimeS   = (uptimeSec % 60).toString().padStart(2, '0');
  const uptimeStr = `${uptimeH}:${uptimeM}:${uptimeS}`;

  // Tempo desde último scan
  const secsSinceScan = radarLastScan > 0
    ? Math.floor((Date.now() - radarLastScan) / 1000)
    : null;
  const lastScanStr = secsSinceScan !== null
    ? secsSinceScan < 60
      ? `${secsSinceScan}s atrás`
      : `${Math.floor(secsSinceScan / 60)}m atrás`
    : '—';

  const items = [
    {
      label: 'Conexão Backend',
      value: connected ? 'ONLINE' : 'OFFLINE',
      color: connected ? C.green : '#f87171',
      dot: true,
    },
    {
      label: 'Robôs Ativos',
      value: `${activeRobots} / 3`,
      color: activeRobots > 0 ? C.primary : C.dim,
    },
    {
      label: 'Posições Abertas',
      value: String(totalPositions),
      color: totalPositions > 15 ? '#fbbf24' : C.text,
    },
    {
      label: 'Scans Realizados',
      value: radarScanCount > 0 ? radarScanCount.toLocaleString('pt-BR') : '—',
      color: C.text,
    },
    {
      label: 'Último Scan',
      value: lastScanStr,
      color: C.dim,
    },
    {
      label: 'Sinais FORTE',
      value: String(forteSignals),
      color: forteSignals > 0 ? C.green : C.dim,
    },
    {
      label: 'Sinais MODERADO',
      value: String(moderateSignals),
      color: moderateSignals > 0 ? '#fbbf24' : C.dim,
    },
    {
      label: 'Uptime do Sistema',
      value: uptimeStr,
      color: C.dim,
    },
  ];

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: C.surface, border: `1px solid ${C.outline}` }}
    >
      <div
        className="text-[10px] font-mono uppercase tracking-[0.2em] mb-3"
        style={{ color: C.dim }}
      >
        Telemetria do Sistema
      </div>

      <div className="grid grid-cols-4 gap-2">
        {items.map(item => (
          <div
            key={item.label}
            className="rounded-xl p-3"
            style={{ background: C.bg, border: `1px solid ${C.outline}` }}
          >
            <div
              className="text-[8px] font-mono uppercase tracking-widest mb-1"
              style={{ color: C.dim }}
            >
              {item.label}
            </div>
            <div
              className="flex items-center gap-1.5 text-sm font-bold font-mono tabular-nums"
              style={{ color: item.color }}
            >
              {item.dot && (
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
                  style={{ background: item.color, boxShadow: `0 0 5px ${item.color}` }}
                />
              )}
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── RadarPage ─────────────────────────────────────────────────────────────────
export default function RadarPage() {
  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1
            className="text-xl font-bold tracking-widest mb-0.5"
            style={{ fontFamily: "'Orbitron', sans-serif", color: C.primary }}
          >
            RADAR
          </h1>
          <p className="text-xs font-mono" style={{ color: C.dim }}>
            Scanner de mercado em tempo real — sinais filtrados por força e score
          </p>
        </div>
      </div>

      {/* Telemetria */}
      <SystemTelemetry />

      {/* Painel do radar em full-width */}
      <div
        className="rounded-2xl overflow-hidden flex-1"
        style={{
          background: C.surface,
          border: `1px solid ${C.outline}`,
          minHeight: 400,
        }}
      >
        <RadarPanel />
      </div>
    </div>
  );
}
