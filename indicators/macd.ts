import { calculateEMA } from './ema';

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  prevHistogram: number;
}

export function calculateMACD(
  closes: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): MACDResult {
  if (closes.length < slowPeriod + signalPeriod) {
    return { macd: 0, signal: 0, histogram: 0, prevHistogram: 0 };
  }
  const fastEMAs = calculateEMA(closes, fastPeriod);
  const slowEMAs = calculateEMA(closes, slowPeriod);
  const diff = Math.min(fastEMAs.length, slowEMAs.length);
  const macdLine: number[] = [];
  for (let i = 0; i < diff; i++) {
    macdLine.push(fastEMAs[fastEMAs.length - diff + i] - slowEMAs[slowEMAs.length - diff + i]);
  }
  const signalEMAs = calculateEMA(macdLine, signalPeriod);
  if (signalEMAs.length < 2) return { macd: 0, signal: 0, histogram: 0, prevHistogram: 0 };
  const currentMACD = macdLine[macdLine.length - 1];
  const currentSignal = signalEMAs[signalEMAs.length - 1];
  const prevSignal = signalEMAs[signalEMAs.length - 2];
  const prevMACD = macdLine[macdLine.length - 2];
  const histogram = currentMACD - currentSignal;
  const prevHistogram = prevMACD - prevSignal;
  return { macd: currentMACD, signal: currentSignal, histogram, prevHistogram };
}
