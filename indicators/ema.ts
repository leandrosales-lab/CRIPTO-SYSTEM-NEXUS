export function calculateEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

export function latestEMA(values: number[], period: number): number {
  const emas = calculateEMA(values, period);
  return emas.length > 0 ? emas[emas.length - 1] : values[values.length - 1];
}
