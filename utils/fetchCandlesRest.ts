import axios from 'axios';

const BASE = 'https://fapi.binance.com';
const EXCLUDED = ['UPUSDT', 'DOWNUSDT', 'BEARUSDT', 'BULLUSDT', 'BUSDUSDT'];

export interface CandleData {
  times: number[];
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
}

export interface TickerInfo {
  symbol: string;
  quoteVolume: number;
  priceChangePercent: number;
  lastPrice: number;
}

export async function fetchTopSymbols(limit = 30): Promise<TickerInfo[]> {
  const res = await axios.get(`${BASE}/fapi/v1/ticker/24hr`, { timeout: 8000 });
  return (res.data as Array<{ symbol: string; quoteVolume: string; priceChangePercent: string; lastPrice: string }>)
    .filter(t => t.symbol.endsWith('USDT') && !EXCLUDED.some(e => t.symbol.includes(e)) && parseFloat(t.quoteVolume) > 500_000)
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, limit)
    .map(t => ({
      symbol: t.symbol,
      quoteVolume: parseFloat(t.quoteVolume),
      priceChangePercent: parseFloat(t.priceChangePercent),
      lastPrice: parseFloat(t.lastPrice),
    }));
}

export async function fetchCandleData(symbol: string, interval = '1m', limit = 60): Promise<CandleData | null> {
  try {
    const res = await axios.get(`${BASE}/fapi/v1/klines`, {
      params: { symbol, interval, limit },
      timeout: 5000,
    });
    const klines = res.data as unknown[][];
    return {
      times:   klines.map(k => k[0] as number),
      opens:   klines.map(k => parseFloat(k[1] as string)),
      highs:   klines.map(k => parseFloat(k[2] as string)),
      lows:    klines.map(k => parseFloat(k[3] as string)),
      closes:  klines.map(k => parseFloat(k[4] as string)),
      volumes: klines.map(k => parseFloat(k[5] as string)),
    };
  } catch {
    return null;
  }
}

export function computeVWAP(data: CandleData): number {
  let sumPV = 0, sumV = 0;
  for (let i = 0; i < data.closes.length; i++) {
    const tp = (data.highs[i] + data.lows[i] + data.closes[i]) / 3;
    sumPV += tp * data.volumes[i];
    sumV  += data.volumes[i];
  }
  return sumV > 0 ? sumPV / sumV : 0;
}
