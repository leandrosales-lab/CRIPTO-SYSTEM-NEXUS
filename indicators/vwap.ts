import { Candle } from '../types';

export interface VWAPResult {
  vwap: number;
  deviation: number;
  deviationPercent: number;
}

export class VWAPCalculator {
  private cumulativePV = 0;
  private cumulativeVolume = 0;
  private sessionStart: number;

  constructor() {
    this.sessionStart = this.getSessionStart();
  }

  private getSessionStart(): number {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    return now.getTime();
  }

  update(candle: Candle): VWAPResult {
    if (candle.time < this.sessionStart) {
      this.sessionStart = this.getSessionStart();
      this.cumulativePV = 0;
      this.cumulativeVolume = 0;
    }
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    this.cumulativePV += typicalPrice * candle.volume;
    this.cumulativeVolume += candle.volume;
    const vwap = this.cumulativeVolume > 0 ? this.cumulativePV / this.cumulativeVolume : candle.close;
    const deviation = candle.close - vwap;
    const deviationPercent = (deviation / vwap) * 100;
    return { vwap, deviation, deviationPercent };
  }

  calculateFromCandles(candles: Candle[]): VWAPResult {
    this.cumulativePV = 0;
    this.cumulativeVolume = 0;
    let vwap = 0;
    for (const candle of candles) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      this.cumulativePV += typicalPrice * candle.volume;
      this.cumulativeVolume += candle.volume;
      vwap = this.cumulativeVolume > 0 ? this.cumulativePV / this.cumulativeVolume : candle.close;
    }
    const lastClose = candles[candles.length - 1]?.close || 0;
    const deviation = lastClose - vwap;
    const deviationPercent = vwap > 0 ? (deviation / vwap) * 100 : 0;
    return { vwap, deviation, deviationPercent };
  }
}

export function calculateKeltnerChannels(candles: Candle[], period: number, multiplier: number) {
  if (candles.length < period) {
    const last = candles[candles.length - 1];
    return { upper: last?.close || 0, middle: last?.close || 0, lower: last?.close || 0 };
  }
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const emaCloses = closes.slice(-period).reduce((a, b) => a + b, 0) / period;
  const trueRanges = candles.slice(-period).map((c, i, arr) => {
    if (i === 0) return c.high - c.low;
    const prevClose = arr[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });
  const atr = trueRanges.reduce((a, b) => a + b, 0) / period;
  return {
    upper: emaCloses + multiplier * atr,
    middle: emaCloses,
    lower: emaCloses - multiplier * atr,
  };
}
