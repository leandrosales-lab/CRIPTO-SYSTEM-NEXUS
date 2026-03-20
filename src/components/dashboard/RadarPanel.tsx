import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, RadarSignal } from '../../store/useStore';
import axios from 'axios';

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

const removeRadarSignal = (symbol: string) => useStore.getState().removeRadarSignal(symbol);

// ─── ScoreBar ──────────────────────────────────────────────────────────────────
function ScoreBar({ score, direction }: { score: number; direction: 'LONG' | 'SHORT' }) {
  return (
    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{
          background: direction === 'LONG'
            ? `linear-gradient(90deg, #005234, ${C.green})`
            : `linear-gradient(90deg, #93000a, ${C.red})`,
          boxShadow: score > 70
            ? direction === 'LONG' ? `0 0 6px ${C.green}55` : `0 0 6px ${C.red}55`
            : 'none',
        }}
      />
    </div>
  );
}

// ─── DirectionBadge ────────────────────────────────────────────────────────────
function DirectionBadge({ direction }: { direction: 'LONG' | 'SHORT' }) {
  const isLong = direction === 'LONG';
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold tracking-widest uppercase"
      style={{
        background: isLong ? 'rgba(0,226,151,0.1)' : 'rgba(255,180,171,0.1)',
        border: `1px solid ${isLong ? 'rgba(0,226,151,0.35)' : 'rgba(255,180,171,0.35)'}`,
        color: isLong ? C.green : C.red,
      }}
    >
      {isLong ? '▲' : '▼'} {direction}
    </span>
  );
}

// ─── TradeButtons ──────────────────────────────────────────────────────────────
type TradeState = 'idle' | 'loading' | 'success' | 'error';

function TradeButtons({ signal, size, leverage }: { signal: RadarSignal; size: number; leverage: number }) {
  const [state, setState] = useState<TradeState>('idle');
  const [feedback, setFeedback] = useState('');
  const [lastDir, setLastDir] = useState<'LONG' | 'SHORT' | null>(null);

  const executeTrade = async (dir: 'LONG' | 'SHORT') => {
    if (state === 'loading') return;
    setState('loading');
    setLastDir(dir);
    try {
      const res = await axios.post('/api/trade/manual', {
        symbol: signal.symbol, direction: dir, robotId: 'radar', size, leverage,
      });
      const price = res.data.trade?.entryPrice ?? signal.currentPrice;
      const d = price > 100 ? 2 : price > 1 ? 4 : 6;
      setFeedback(`✓ ${dir} ${signal.symbol.replace('USDT', '')} @ $${Number(price).toFixed(d)}`);
      setState('success');
      removeRadarSignal(signal.symbol);
      setTimeout(() => { setState('idle'); setFeedback(''); setLastDir(null); }, 3500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao executar';
      setFeedback(msg);
      setState('error');
      setTimeout(() => { setState('idle'); setFeedback(''); setLastDir(null); }, 4000);
    }
  };

  const isLong = signal.direction === 'LONG';

  if (state === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="mt-2 p-2 rounded text-center"
        style={{ background: 'rgba(0,226,151,0.08)', border: `1px solid rgba(0,226,151,0.2)` }}
      >
        <span className="font-mono text-[9px] font-bold" style={{ color: C.green }}>{feedback}</span>
      </motion.div>
    );
  }
  if (state === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="mt-2 p-2 rounded text-center"
        style={{ background: 'rgba(255,180,171,0.08)', border: `1px solid rgba(255,180,171,0.2)` }}
      >
        <span className="font-mono text-[9px]" style={{ color: C.red }}>{feedback}</span>
      </motion.div>
    );
  }

  return (
    <div className="mt-2 flex gap-1.5" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => executeTrade('LONG')}
        disabled={state === 'loading'}
        className="flex-1 font-mono text-[9px] font-bold py-1.5 rounded uppercase tracking-wider transition-all disabled:opacity-40"
        style={{
          background: isLong ? 'rgba(0,226,151,0.1)' : 'transparent',
          border: isLong ? `1px solid rgba(0,226,151,0.45)` : `1px solid rgba(255,255,255,0.08)`,
          color: isLong ? C.green : C.outlineVar,
        }}
      >
        {state === 'loading' && lastDir === 'LONG' ? '···' : `▲ LONG${isLong ? ' ✦' : ''}`}
      </button>
      <button
        onClick={() => executeTrade('SHORT')}
        disabled={state === 'loading'}
        className="flex-1 font-mono text-[9px] font-bold py-1.5 rounded uppercase tracking-wider transition-all disabled:opacity-40"
        style={{
          background: !isLong ? 'rgba(255,180,171,0.1)' : 'transparent',
          border: !isLong ? `1px solid rgba(255,180,171,0.45)` : `1px solid rgba(255,255,255,0.08)`,
          color: !isLong ? C.red : C.outlineVar,
        }}
      >
        {state === 'loading' && lastDir === 'SHORT' ? '···' : `▼ SHORT${!isLong ? ' ✦' : ''}`}
      </button>
    </div>
  );
}

// ─── SignalRow — linha compacta na lista esquerda ──────────────────────────────
export function SignalRow({ signal, index }: { signal: RadarSignal; index: number }) {
  const isLong = signal.direction === 'LONG';
  const d = signal.currentPrice > 100 ? 2 : signal.currentPrice > 1 ? 4 : 6;
  const changePos = signal.change24h >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-2 px-2 py-2 border-b group hover:opacity-90 transition-opacity"
      style={{ borderColor: 'rgba(255,255,255,0.05)' }}
    >
      {/* Indicador direcional */}
      <div
        className="w-0.5 h-7 rounded-full flex-shrink-0"
        style={{ background: isLong ? C.green : C.red }}
      />

      {/* Símbolo */}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[11px] font-bold leading-none mb-0.5" style={{ color: C.text }}>
          {signal.symbol.replace('USDT', '')}
        </div>
        <div className="font-mono text-[9px]" style={{ color: C.outlineVar }}>
          ${signal.currentPrice.toFixed(d)}
        </div>
      </div>

      {/* Variação 24h */}
      <div
        className="font-mono text-[9px] font-bold w-12 text-right"
        style={{ color: changePos ? C.green : C.red }}
      >
        {changePos ? '+' : ''}{signal.change24h.toFixed(2)}%
      </div>

      {/* Badge + score */}
      <div className="flex flex-col items-end gap-0.5">
        <DirectionBadge direction={signal.direction} />
        <span
          className="font-mono text-[9px] font-bold tabular-nums"
          style={{ color: isLong ? C.green : C.red }}
        >
          {signal.score}
        </span>
      </div>
    </motion.div>
  );
}

// ─── SignalCard — card expandido no painel central ────────────────────────────
function SignalCard({ signal, index }: { signal: RadarSignal; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [tradeSize, setTradeSize] = useState(5);
  const [tradeLeverage, setTradeLeverage] = useState(2);
  const isLong = signal.direction === 'LONG';
  const d = signal.currentPrice > 100 ? 2 : signal.currentPrice > 1 ? 4 : 6;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-lg p-3"
      style={{
        background: isLong ? 'rgba(0,226,151,0.04)' : 'rgba(255,180,171,0.04)',
        border: isLong ? '1px solid rgba(0,226,151,0.18)' : '1px solid rgba(255,180,171,0.18)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-[9px] font-bold w-5 text-center"
            style={{ color: isLong ? C.green : C.red }}
          >
            #{signal.rank}
          </span>
          <div>
            <span className="text-xs font-bold tracking-wider" style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}>
              {signal.symbol.replace('USDT', '')}
            </span>
            <span className="text-[8px] font-mono ml-1" style={{ color: C.outlineVar }}>USDT</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <DirectionBadge direction={signal.direction} />
        </div>
      </div>

      {/* Preço + score */}
      <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <span className="font-mono text-[10px] font-bold" style={{ color: C.text }}>
          ${signal.currentPrice.toFixed(d)}
        </span>
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-[9px]"
            style={{ color: signal.change24h >= 0 ? C.green : C.red }}
          >
            {signal.change24h >= 0 ? '+' : ''}{signal.change24h.toFixed(2)}%
          </span>
          <span className="font-mono text-sm font-bold tabular-nums" style={{ color: isLong ? C.green : C.red }}>
            {signal.score}
          </span>
        </div>
      </div>

      <ScoreBar score={signal.score} direction={signal.direction} />

      {/* Indicadores */}
      <div className="grid grid-cols-3 gap-1.5 mt-2.5 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        {[
          { label: 'RSI', value: signal.rsi.toFixed(1), color: signal.rsi < 30 ? C.green : signal.rsi > 70 ? C.red : '#fbbf24' },
          { label: 'BB',  value: signal.bbPosition, color: signal.bbPosition === 'ABAIXO' ? C.green : signal.bbPosition === 'ACIMA' ? C.red : C.outlineVar },
          { label: 'EMA', value: signal.emaAlignment, color: signal.emaAlignment === 'ALTA' ? C.green : signal.emaAlignment === 'BAIXA' ? C.red : C.outlineVar },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center rounded py-1" style={{ background: 'rgba(0,0,0,0.25)' }}>
            <div className="font-mono text-[7px] uppercase mb-0.5" style={{ color: C.outline }}>
              {label}
            </div>
            <div className="font-mono text-[9px] font-bold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Inputs */}
      <div className="mt-2.5 space-y-1.5" onClick={e => e.stopPropagation()}>
        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="font-mono text-[8px] w-8 flex-shrink-0 uppercase" style={{ color: C.outlineVar }}>Valor</span>
          <input
            type="number" min={1} max={1000} step={1} value={tradeSize}
            onChange={e => setTradeSize(Math.max(1, Math.min(1000, Number(e.target.value))))}
            className="flex-1 bg-transparent font-mono text-[10px] outline-none text-right w-0 tabular-nums"
            style={{ color: C.text }}
          />
          <span className="font-mono text-[8px]" style={{ color: C.outlineVar }}>USD</span>
          <div className="flex gap-0.5 flex-shrink-0">
            {[5, 10, 25].map(v => (
              <button key={v} onClick={() => setTradeSize(v)}
                className="font-mono text-[7px] px-1 py-0.5 rounded transition-all"
                style={{
                  border: tradeSize === v ? `1px solid rgba(76,214,255,0.5)` : '1px solid rgba(255,255,255,0.08)',
                  background: tradeSize === v ? 'rgba(76,214,255,0.1)' : 'transparent',
                  color: tradeSize === v ? C.primary : C.outline,
                }}
              >
                ${v}
              </button>
            ))}
          </div>
        </div>

        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="font-mono text-[8px] w-8 flex-shrink-0 uppercase" style={{ color: C.outlineVar }}>Alav.</span>
          <input
            type="number" min={1} max={125} step={1} value={tradeLeverage}
            onChange={e => setTradeLeverage(Math.max(1, Math.min(125, Number(e.target.value))))}
            className="flex-1 bg-transparent font-mono text-[10px] outline-none text-right w-0 tabular-nums"
            style={{ color: C.text }}
          />
          <span className="font-mono text-[8px]" style={{ color: C.outlineVar }}>x</span>
          <div className="flex gap-0.5 flex-shrink-0">
            {[2, 5, 10, 20].map(v => (
              <button key={v} onClick={() => setTradeLeverage(v)}
                className="font-mono text-[7px] px-1 py-0.5 rounded transition-all"
                style={{
                  border: tradeLeverage === v ? '1px solid rgba(163,131,255,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  background: tradeLeverage === v ? 'rgba(163,131,255,0.1)' : 'transparent',
                  color: tradeLeverage === v ? '#a383ff' : C.outline,
                }}
              >
                {v}x
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between font-mono text-[8px] px-1">
          <span style={{ color: C.outline }}>Notional (expo.):</span>
          <span style={{ color: C.dim }}>${(tradeSize * tradeLeverage).toFixed(2)}</span>
        </div>

        <TradeButtons signal={signal} size={tradeSize} leverage={tradeLeverage} />
      </div>

      {/* Detalhes expansíveis */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { label: 'Volume Spike', value: `${signal.volumeSpike.toFixed(1)}×`, color: signal.volumeSpike > 1.5 ? '#fbbf24' : C.dim },
                { label: 'Momentum 1h', value: `${signal.priceChange1h >= 0 ? '+' : ''}${signal.priceChange1h.toFixed(2)}%`, color: signal.priceChange1h >= 0 ? C.green : C.red },
                { label: 'Vol 24h', value: `$${(signal.volume24h / 1_000_000).toFixed(1)}M`, color: C.dim },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between font-mono text-[9px]">
                  <span style={{ color: C.outlineVar }}>{label}</span>
                  <span style={{ color }}>{value}</span>
                </div>
              ))}
              {signal.reasons.length > 0 && (
                <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="text-[7px] font-mono uppercase tracking-widest mb-1.5" style={{ color: C.outline }}>Razões</div>
                  {signal.reasons.map((r, i) => (
                    <div key={i} className="text-[8px] font-mono leading-relaxed" style={{ color: C.dim }}>· {r}</div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── RadarPanel — painel de cards completo (usado no centro) ──────────────────
type StrengthLevel = RadarSignal['strength'];

export default function RadarPanel() {
  const { radarSignals, radarScanCount, radarLastScan } = useStore();
  const [scanning, setScanning] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<StrengthLevel>>(new Set(['FORTE', 'MODERADO', 'FRACO']));

  const toggleFilter = useCallback((s: StrengthLevel) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(s) && next.size > 1) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  const filteredSignals = useMemo(
    () => radarSignals.filter(s => activeFilters.has(s.strength)),
    [radarSignals, activeFilters]
  );

  const { updateRadar } = useStore();
  const forceScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const res = await axios.post('/api/radar/scan');
      if (res.data?.signals?.length) {
        updateRadar({ signals: res.data.signals, scanCount: res.data.scanCount ?? radarScanCount + 1, scannedAt: Date.now() });
      }
    } catch (_) {}
    setScanning(false);
  }, [scanning, radarScanCount, updateRadar]);

  const lastScanStr = radarLastScan > 0
    ? new Date(radarLastScan).toLocaleTimeString('pt-BR', { hour12: false })
    : '—';

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: C.surfaceLow, borderRadius: 12 }}>
      {/* Header */}
      <div
        className="px-4 py-3 flex-shrink-0 flex items-center justify-between"
        style={{ borderBottom: `1px solid rgba(255,255,255,0.05)`, background: C.surface }}
      >
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-base"
            style={{ color: C.primary, animation: scanning ? 'spin 1s linear infinite' : undefined }}
          >
            radar
          </span>
          <span className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ color: C.primary, fontFamily: "'Space Grotesk', sans-serif" }}>
            Trades Simultâneos
          </span>
          <span className="text-[9px] font-mono" style={{ color: C.outlineVar }}>
            ({filteredSignals.length}/{radarSignals.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filtros */}
          <div className="flex gap-1">
            {(['FORTE', 'MODERADO', 'FRACO'] as const).map(s => {
              const active = activeFilters.has(s);
              const colors: Record<StrengthLevel, { on: string; border: string }> = {
                FORTE:    { on: C.green,    border: 'rgba(0,226,151,0.4)'   },
                MODERADO: { on: '#fbbf24',  border: 'rgba(251,191,36,0.4)'  },
                FRACO:    { on: C.outlineVar, border: 'rgba(133,147,153,0.3)' },
              };
              return (
                <button key={s} onClick={() => toggleFilter(s)}
                  className="font-mono text-[7px] uppercase tracking-widest px-2 py-0.5 rounded transition-all"
                  style={{
                    border: `1px solid ${active ? colors[s].border : 'rgba(255,255,255,0.06)'}`,
                    background: active ? `${colors[s].on}15` : 'transparent',
                    color: active ? colors[s].on : C.outline,
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>

          <button
            onClick={forceScan}
            disabled={scanning}
            className="font-mono text-[8px] px-2 py-1 rounded uppercase tracking-wider transition-all disabled:opacity-50"
            style={{ border: `1px solid rgba(76,214,255,0.35)`, color: C.primary, background: scanning ? 'rgba(76,214,255,0.06)' : 'transparent' }}
          >
            {scanning ? 'Scan...' : 'Scan'}
          </button>

          {radarLastScan > 0 && (
            <span className="font-mono text-[8px]" style={{ color: C.outline }}>{lastScanStr}</span>
          )}
        </div>
      </div>

      {/* Lista de cards */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-2"
        style={{ scrollbarWidth: 'thin', scrollbarColor: `${C.outline} transparent` }}
      >
        {radarSignals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
            <span
              className="material-symbols-outlined text-4xl animate-pulse"
              style={{ color: C.primary }}
            >
              sensors
            </span>
            <div className="text-center space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.primary }}>
                {scanning ? 'Analisando ativos...' : 'Aguardando scan'}
              </div>
              <div className="text-[9px] font-mono" style={{ color: C.outlineVar }}>
                {scanning ? 'RSI · BB · EMA · Volume' : 'Scan automático a cada 3 min'}
              </div>
            </div>
          </div>
        ) : filteredSignals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
            <span className="material-symbols-outlined text-3xl" style={{ color: C.outline }}>manage_search</span>
            <div className="text-[9px] font-mono text-center" style={{ color: C.outlineVar }}>
              Nenhum sinal com os filtros selecionados
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredSignals.map((signal, i) => (
              <SignalCard key={signal.symbol} signal={signal} index={i} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      {radarSignals.length > 0 && (
        <div
          className="px-4 py-2 flex justify-between items-center flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <span className="font-mono text-[8px]" style={{ color: C.outlineVar }}>
            {filteredSignals.filter(s => s.direction === 'LONG').length}L · {filteredSignals.filter(s => s.direction === 'SHORT').length}S
          </span>
          <span className="font-mono text-[8px]" style={{ color: C.primary }}>
            {filteredSignals.filter(s => s.strength === 'FORTE').length} forte
          </span>
        </div>
      )}
    </div>
  );
}
