import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, RadarSignal } from '../../store/useStore';
import axios from 'axios';

const removeRadarSignal = (symbol: string) => useStore.getState().removeRadarSignal(symbol);

function ScoreBar({ score, direction }: { score: number; direction: 'LONG' | 'SHORT' }) {
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{
          background: direction === 'LONG'
            ? 'linear-gradient(90deg, #059669, #34D399)'
            : 'linear-gradient(90deg, #be123c, #F43F5E)',
          boxShadow: score > 70 ? (direction === 'LONG' ? '0 0 6px #34D39955' : '0 0 6px #F43F5E55') : 'none',
        }}
      />
    </div>
  );
}

function StrengthBadge({ strength }: { strength: RadarSignal['strength'] }) {
  const cfg = {
    FORTE:    { text: 'text-emerald-400', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)',  dot: '#34D399' },
    MODERADO: { text: 'text-amber-400',   bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  dot: '#FBBF24' },
    FRACO:    { text: 'text-slate-400',   bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)', dot: '#64748b' },
  }[strength];
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold tracking-widest ${cfg.text}`}
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
      {strength}
    </span>
  );
}

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
      const res = await axios.post('/api/trade/manual', { symbol: signal.symbol, direction: dir, robotId: 'radar', size, leverage });
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 p-2 rounded-md text-center" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
        <span className="font-mono text-[9px] text-emerald-400 font-bold">{feedback}</span>
      </motion.div>
    );
  }
  if (state === 'error') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 p-2 rounded-md text-center" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
        <span className="font-mono text-[9px] text-rose-400">{feedback}</span>
      </motion.div>
    );
  }

  return (
    <div className="mt-2 space-y-1.5" onClick={e => e.stopPropagation()}>
      <div className="flex gap-1.5">
        <button
          onClick={() => executeTrade('LONG')}
          disabled={state === 'loading'}
          className="flex-1 font-mono text-[9px] font-bold py-1.5 rounded-md uppercase tracking-wider transition-all disabled:opacity-40"
          style={{
            background: (state === 'loading' && lastDir === 'LONG') || isLong ? 'rgba(52,211,153,0.1)' : 'transparent',
            border: isLong ? '1px solid rgba(52,211,153,0.5)' : '1px solid rgba(255,255,255,0.08)',
            color: isLong ? '#34D399' : '#94a3b8',
          }}
        >
          {state === 'loading' && lastDir === 'LONG' ? '···' : `▲ LONG${isLong ? ' ✦' : ''}`}
        </button>
        <button
          onClick={() => executeTrade('SHORT')}
          disabled={state === 'loading'}
          className="flex-1 font-mono text-[9px] font-bold py-1.5 rounded-md uppercase tracking-wider transition-all disabled:opacity-40"
          style={{
            background: (state === 'loading' && lastDir === 'SHORT') || !isLong ? 'rgba(244,63,94,0.1)' : 'transparent',
            border: !isLong ? '1px solid rgba(244,63,94,0.5)' : '1px solid rgba(255,255,255,0.08)',
            color: !isLong ? '#F43F5E' : '#94a3b8',
          }}
        >
          {state === 'loading' && lastDir === 'SHORT' ? '···' : `▼ SHORT${!isLong ? ' ✦' : ''}`}
        </button>
      </div>
      <div className="font-mono text-[7px] text-slate-600 text-center">✦ sinal sugerido · 1 clique executa</div>
    </div>
  );
}

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
        background: isLong ? 'rgba(52,211,153,0.04)' : 'rgba(244,63,94,0.04)',
        border: isLong ? '1px solid rgba(52,211,153,0.15)' : '1px solid rgba(244,63,94,0.15)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-[9px] font-bold w-5 text-center ${isLong ? 'text-emerald-400' : 'text-rose-400'}`}>
            #{signal.rank}
          </span>
          <div>
            <span
              className="text-xs font-bold text-slate-100 tracking-wider"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              {signal.symbol.replace('USDT', '')}
            </span>
            <span className="text-[8px] font-mono text-slate-500 ml-1">USDT</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <StrengthBadge strength={signal.strength} />
          <span
            className={`font-mono text-[8px] font-bold px-1.5 py-0.5 rounded ${isLong ? 'text-emerald-400' : 'text-rose-400'}`}
            style={{
              background: isLong ? 'rgba(52,211,153,0.1)' : 'rgba(244,63,94,0.1)',
              border: isLong ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(244,63,94,0.3)',
            }}
          >
            {isLong ? '▲ L' : '▼ S'}
          </span>
        </div>
      </div>

      {/* Price & score */}
      <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <span className="font-mono text-[10px] font-bold text-slate-200">${signal.currentPrice.toFixed(d)}</span>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-[9px] ${signal.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {signal.change24h >= 0 ? '+' : ''}{signal.change24h.toFixed(2)}%
          </span>
          <span className={`font-mono text-sm font-bold tabular-nums ${isLong ? 'text-emerald-400' : 'text-rose-400'}`}>
            {signal.score}
          </span>
        </div>
      </div>

      <ScoreBar score={signal.score} direction={signal.direction} />

      {/* Indicators */}
      <div className="grid grid-cols-3 gap-1.5 mt-2.5 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        {[
          { label: 'RSI', value: signal.rsi.toFixed(1), color: signal.rsi < 30 ? 'text-emerald-400' : signal.rsi > 70 ? 'text-rose-400' : 'text-amber-400' },
          { label: 'BB',  value: signal.bbPosition,  color: signal.bbPosition === 'ABAIXO' ? 'text-emerald-400' : signal.bbPosition === 'ACIMA' ? 'text-rose-400' : 'text-slate-500' },
          { label: 'EMA', value: signal.emaAlignment, color: signal.emaAlignment === 'ALTA' ? 'text-emerald-400' : signal.emaAlignment === 'BAIXA' ? 'text-rose-400' : 'text-slate-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center rounded py-1" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <div className="font-mono text-[7px] text-slate-600 uppercase mb-0.5">{label}</div>
            <div className={`font-mono text-[9px] font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Size + Leverage inputs */}
      <div className="mt-2.5 space-y-1.5" onClick={e => e.stopPropagation()}>
        {/* Trade size */}
        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded-md"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="font-mono text-[8px] text-slate-500 uppercase w-8 flex-shrink-0">Valor</span>
          <input
            type="number" min={1} max={100} step={1} value={tradeSize}
            onChange={e => setTradeSize(Math.max(1, Math.min(100, Number(e.target.value))))}
            className="flex-1 bg-transparent font-mono text-[10px] text-slate-200 outline-none text-right w-0 tabular-nums"
          />
          <span className="font-mono text-[8px] text-slate-500">USD</span>
          <div className="flex gap-0.5 flex-shrink-0">
            {[5, 10, 25].map(v => (
              <button key={v} onClick={() => setTradeSize(v)}
                className="font-mono text-[7px] px-1 py-0.5 rounded transition-all"
                style={{
                  border: tradeSize === v ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  background: tradeSize === v ? 'rgba(34,211,238,0.1)' : 'transparent',
                  color: tradeSize === v ? '#22D3EE' : '#64748b',
                }}
              >
                ${v}
              </button>
            ))}
          </div>
        </div>

        {/* Leverage */}
        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded-md"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="font-mono text-[8px] text-slate-500 uppercase w-8 flex-shrink-0">Alav.</span>
          <input
            type="number" min={1} max={125} step={1} value={tradeLeverage}
            onChange={e => setTradeLeverage(Math.max(1, Math.min(125, Number(e.target.value))))}
            className="flex-1 bg-transparent font-mono text-[10px] text-slate-200 outline-none text-right w-0 tabular-nums"
          />
          <span className="font-mono text-[8px] text-slate-500">x</span>
          <div className="flex gap-0.5 flex-shrink-0">
            {[2, 5, 10, 20].map(v => (
              <button key={v} onClick={() => setTradeLeverage(v)}
                className="font-mono text-[7px] px-1 py-0.5 rounded transition-all"
                style={{
                  border: tradeLeverage === v ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  background: tradeLeverage === v ? 'rgba(139,92,246,0.1)' : 'transparent',
                  color: tradeLeverage === v ? '#8B5CF6' : '#64748b',
                }}
              >
                {v}x
              </button>
            ))}
          </div>
        </div>

        {/* Notional preview */}
        <div className="flex justify-between font-mono text-[8px] px-1">
          <span className="text-slate-600">Notional (expo.):</span>
          <span className="text-slate-400">${(tradeSize * tradeLeverage).toFixed(2)}</span>
        </div>

        <TradeButtons signal={signal} size={tradeSize} leverage={tradeLeverage} />
      </div>

      {/* Expandable details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1.5">
              {[
                { label: 'Volume Spike', value: `${signal.volumeSpike.toFixed(1)}×`, color: signal.volumeSpike > 1.5 ? 'text-amber-400' : 'text-slate-300' },
                { label: 'Momentum (3c)', value: `${signal.priceChange1h >= 0 ? '+' : ''}${signal.priceChange1h.toFixed(2)}%`, color: signal.priceChange1h >= 0 ? 'text-emerald-400' : 'text-rose-400' },
                { label: 'Vol 24h', value: `$${(signal.volume24h / 1_000_000).toFixed(1)}M`, color: 'text-slate-300' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between font-mono text-[9px]">
                  <span className="text-slate-500">{label}</span>
                  <span className={color}>{value}</span>
                </div>
              ))}
              {signal.reasons.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/[0.04]">
                  <div className="text-[7px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">Razões</div>
                  {signal.reasons.map((r, i) => (
                    <div key={i} className="text-[8px] font-mono text-slate-400 leading-relaxed">· {r}</div>
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

  const nextScanIn = radarLastScan > 0
    ? Math.max(0, Math.round((radarLastScan + 3 * 60 * 1000 - Date.now()) / 1000))
    : null;
  const lastScanStr = radarLastScan > 0
    ? new Date(radarLastScan).toLocaleTimeString('pt-BR', { hour12: false })
    : '—';

  return (
    <div
      className="w-full h-full flex flex-col rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(34,211,238,0.12)' }}
    >
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-white/[0.05] flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-cyan-400 text-base ${scanning ? 'animate-spin' : 'animate-pulse'}`}>◉</span>
            <span
              className="text-[10px] font-bold tracking-[0.2em] text-cyan-400 uppercase"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              Radar
            </span>
            {radarScanCount > 0 && (
              <span className="text-[8px] font-mono text-slate-500">#{radarScanCount}</span>
            )}
          </div>
          <button
            onClick={forceScan}
            disabled={scanning}
            className="text-[8px] font-mono px-2 py-1 rounded-md uppercase tracking-wider transition-all disabled:opacity-50"
            style={{
              border: '1px solid rgba(34,211,238,0.3)',
              color: '#22D3EE',
              background: scanning ? 'rgba(34,211,238,0.05)' : 'transparent',
            }}
          >
            {scanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>
        <div className="text-[8px] font-mono text-slate-500">Top 50 → Melhores 6 entradas</div>

        {/* Filtros de força */}
        <div className="flex gap-1 mt-2">
          {(['FORTE', 'MODERADO', 'FRACO'] as const).map(s => {
            const active = activeFilters.has(s);
            const colors: Record<StrengthLevel, { on: string; border: string }> = {
              FORTE:    { on: '#34D399', border: 'rgba(52,211,153,0.4)'  },
              MODERADO: { on: '#FBBF24', border: 'rgba(251,191,36,0.4)'  },
              FRACO:    { on: '#64748b', border: 'rgba(148,163,184,0.3)' },
            };
            return (
              <button
                key={s}
                onClick={() => toggleFilter(s)}
                className="flex-1 font-mono text-[7px] uppercase tracking-widest py-0.5 rounded transition-all"
                style={{
                  border: `1px solid ${active ? colors[s].border : 'rgba(255,255,255,0.06)'}`,
                  background: active ? `${colors[s].on}12` : 'transparent',
                  color: active ? colors[s].on : '#475569',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>

        {radarLastScan > 0 && (
          <div className="text-[8px] font-mono text-slate-600 mt-0.5">Último: {lastScanStr}</div>
        )}
        {nextScanIn !== null && nextScanIn > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-[7px] font-mono text-slate-600 mb-1">
              <span>Próximo scan</span>
              <span>{Math.floor(nextScanIn / 60)}m{(nextScanIn % 60).toString().padStart(2, '0')}s</span>
            </div>
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${100 - (nextScanIn / 180) * 100}%`, background: 'rgba(34,211,238,0.4)' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Signals list */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-2"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
      >
        {radarSignals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
            <div className={`text-3xl text-cyan-400 ${scanning ? 'animate-spin' : 'animate-pulse'}`}>◉</div>
            <div className="text-center space-y-1">
              <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
                {scanning ? 'Analisando 50 ativos...' : 'Aguardando scan'}
              </div>
              <div className="text-[9px] font-mono text-slate-500">
                {scanning ? 'RSI · BB · EMA · Volume' : 'Scan automático a cada 3 min'}
              </div>
            </div>
          </div>
        ) : filteredSignals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
            <div className="text-2xl text-slate-600">◎</div>
            <div className="text-[9px] font-mono text-slate-500 text-center">
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
          className="px-4 py-2 flex justify-between items-center flex-shrink-0 border-t border-white/[0.05]"
        >
          <span className="font-mono text-[8px] text-slate-500">
            {filteredSignals.filter(s => s.direction === 'LONG').length}L · {filteredSignals.filter(s => s.direction === 'SHORT').length}S
          </span>
          <span className="font-mono text-[8px] text-cyan-400">
            {filteredSignals.filter(s => s.strength === 'FORTE').length} forte
          </span>
        </div>
      )}
    </div>
  );
}
