export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
}

export function calculateBollingerBands(closes: number[], period: number, stdDevMult: number): BollingerBands {
  if (closes.length < period) {
    const last = closes[closes.length - 1];
    return { upper: last, middle: last, lower: last, bandwidth: 0 };
  }
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = mean + stdDevMult * stdDev;
  const lower = mean - stdDevMult * stdDev;
  const bandwidth = (upper - lower) / mean;
  return { upper, middle: mean, lower, bandwidth };
}
