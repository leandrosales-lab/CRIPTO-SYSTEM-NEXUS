import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import axios from 'axios';
import { useStore } from '../../store/useStore';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];
const INTERVALS = ['1m', '3m', '5m', '15m', '1h'];

export default function CandleChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [tf, setTf] = useState('1m');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [candles, setCandles] = useState<Candle[]>([]);

  const marketTick = useStore(s => s.marketTicks[symbol]);

  // Build & destroy chart
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(34,211,238,0.4)', labelBackgroundColor: '#0F172A' },
        horzLine: { color: 'rgba(34,211,238,0.4)', labelBackgroundColor: '#0F172A' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: tf === '1m' },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addCandlestickSeries({
      upColor: '#34D399',
      downColor: '#F43F5E',
      borderUpColor: '#34D399',
      borderDownColor: '#F43F5E',
      wickUpColor: '#34D39980',
      wickDownColor: '#F43F5E80',
    });

    chartRef.current = chart;
    candleSeriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [tf]);

  // Fetch candles on symbol/interval change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    axios.get(`/api/klines?symbol=${symbol}&interval=${tf}&limit=300`)
      .then(r => {
        if (cancelled) return;
        const data: Candle[] = r.data;
        setCandles(data);
        if (candleSeriesRef.current) {
          candleSeriesRef.current.setData(
            data.map(c => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close }))
          );
          chartRef.current?.timeScale().fitContent();
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Falha ao carregar velas');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [symbol, tf]);

  // Update last candle from real-time tick
  useEffect(() => {
    if (!marketTick?.price || !candleSeriesRef.current || candles.length === 0) return;
    const last = candles[candles.length - 1];
    const price = marketTick.price;
    const updatedCandle = {
      time: last.time as UTCTimestamp,
      open: last.open,
      high: Math.max(last.high, price),
      low: Math.min(last.low, price),
      close: price,
    };
    candleSeriesRef.current.update(updatedCandle);
  }, [marketTick?.price]);

  const currentPrice = marketTick?.price;
  const change24h = marketTick?.change24h ?? 0;

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden rounded-xl"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05] flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Symbol selector */}
          <div className="flex items-center gap-1">
            {SYMBOLS.map(s => (
              <button
                key={s}
                onClick={() => setSymbol(s)}
                className="px-2.5 py-1 rounded-md font-mono text-[9px] font-semibold uppercase tracking-wider transition-all"
                style={{
                  background: symbol === s ? 'rgba(34,211,238,0.1)' : 'transparent',
                  border: symbol === s ? '1px solid rgba(34,211,238,0.4)' : '1px solid transparent',
                  color: symbol === s ? '#22D3EE' : '#64748b',
                }}
              >
                {s.replace('USDT', '')}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-white/10" />
          {/* Interval selector */}
          <div className="flex items-center gap-1">
            {INTERVALS.map(i => (
              <button
                key={i}
                onClick={() => setTf(i)}
                className="px-2 py-1 rounded font-mono text-[9px] font-semibold uppercase tracking-wider transition-all"
                style={{
                  background: tf === i ? 'rgba(139,92,246,0.1)' : 'transparent',
                  border: tf === i ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent',
                  color: tf === i ? '#8B5CF6' : '#64748b',
                }}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {currentPrice && (
            <>
              <span className="font-mono font-bold text-sm text-slate-100 tabular-nums">
                ${currentPrice > 1000 ? currentPrice.toFixed(2) : currentPrice > 1 ? currentPrice.toFixed(4) : currentPrice.toFixed(6)}
              </span>
              <span className={`font-mono text-[10px] font-semibold ${change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {change24h >= 0 ? '↑' : '↓'} {Math.abs(change24h).toFixed(2)}%
              </span>
            </>
          )}
          {loading && <span className="font-mono text-[9px] text-slate-500 animate-pulse">Carregando...</span>}
          {error && <span className="font-mono text-[9px] text-rose-400">{error}</span>}
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 relative min-h-0">
        <div ref={containerRef} className="absolute inset-0" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-transparent">
            <div className="font-mono text-[10px] text-slate-500 animate-pulse">Carregando velas...</div>
          </div>
        )}
      </div>
    </div>
  );
}
