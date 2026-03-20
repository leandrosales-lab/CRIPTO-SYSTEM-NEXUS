import { BaseRobot } from './BaseRobot';
import { BinanceClient } from '../services/BinanceClient';
import { OrderExecutor } from '../services/OrderExecutor';
import { fetchTopSymbols, fetchCandleData } from '../utils/fetchCandlesRest';
import { calculateRSI } from '../indicators/rsi';
import { calculateBollingerBands } from '../indicators/bollingerBands';
import { VWAPCalculator } from '../indicators/vwap';

interface Opportunity {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  score: number;
  signal: string;
  price: number;
}

export class OracleBot extends BaseRobot {
  private lastSymbolTrade: Map<string, number> = new Map();
  private readonly symbolCooldownMs = 15 * 60 * 1000;

  constructor(binance: BinanceClient, executor: OrderExecutor) {
    super('oracle', 'ORACLE', 'MULTI', 'VWAP Intraday Mean Reversion + BB + RSI — Scanner Dinâmico', binance, executor);
    this.scanIntervalMs   = 150 * 1000; // scan a cada 2.5min
    this.signalCooldownMs = 20 * 1000;
  }

  protected async scan() {
    if (!this.canSignal()) return;

    const tickers = await fetchTopSymbols(30);
    const opportunities: Opportunity[] = [];

    await Promise.allSettled(
      tickers.map(async ticker => {
        const lastTrade = this.lastSymbolTrade.get(ticker.symbol) ?? 0;
        if (Date.now() - lastTrade < this.symbolCooldownMs) return;

        // Busca candles suficientes para cobrir a sessão intraday desde 00:00 UTC
        const data = await fetchCandleData(ticker.symbol, '5m', 288);
        if (!data || data.closes.length < 20) return;

        // Filtra apenas candles da sessão atual (00:00 UTC)
        const sessionStart = (() => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.getTime(); })();
        const sessionCandles = data.times
          .map((t, i) => ({ time: t, open: data.opens[i], high: data.highs[i], low: data.lows[i], close: data.closes[i], volume: data.volumes[i] }))
          .filter(c => c.time >= sessionStart);

        // Sem fallback para 24h — VWAP distorcida por sessão anterior gera sinais falsos
        if (sessionCandles.length === 0) return;
        const candleSource = sessionCandles;

        const vwapCalc = new VWAPCalculator();
        const vwapResult = vwapCalc.calculateFromCandles(candleSource);
        const vwap = vwapResult.vwap;

        const allCloses = data.closes;
        const price  = allCloses[allCloses.length - 1];
        const rsi    = calculateRSI(allCloses, 14);
        const bb     = calculateBollingerBands(allCloses, 20, 2.0);

        if (vwap <= 0) return;

        const deviationPct = ((price - vwap) / vwap) * 100;

        // Check for exhaustion candle (long wick)
        const lastCandle = {
          open:  data.opens[data.opens.length - 1],
          high:  data.highs[data.highs.length - 1],
          low:   data.lows[data.lows.length - 1],
          close: price,
        };
        const bodySize = Math.abs(lastCandle.close - lastCandle.open);
        const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
        const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
        const hasUpperExhaustion = bodySize > 0 && upperWick > bodySize * 1.5;
        const hasLowerExhaustion = bodySize > 0 && lowerWick > bodySize * 1.5;

        const recentVols = data.volumes.slice(-10);
        const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
        const lastVol = data.volumes[data.volumes.length - 1];
        const volSpike = lastVol > avgVol * 1.5;

        let longScore = 0, shortScore = 0;

        // VWAP deviation score (35 pts) — threshold realista para altcoins voláteis
        if (deviationPct < -1.5)       longScore  += 35;
        else if (deviationPct < -0.8)  longScore  += 18;
        if (deviationPct > 1.5)        shortScore += 35;
        else if (deviationPct > 0.8)   shortScore += 18;

        // RSI confirmation (25 pts)
        if (rsi < 35)       longScore  += 25;
        else if (rsi < 42)  longScore  += 12;
        if (rsi > 65)       shortScore += 25;
        else if (rsi > 58)  shortScore += 12;

        // Bollinger Bands (20 pts)
        if (price < bb.lower) longScore  += 20;
        if (price > bb.upper) shortScore += 20;

        // Exhaustion candle (15 pts)
        if (hasLowerExhaustion) longScore  += 15;
        if (hasUpperExhaustion) shortScore += 15;

        // Volume spike (10 pts) — direcional pelo candle atual
        if (volSpike && lastCandle.close > lastCandle.open) longScore  += 10;
        if (volSpike && lastCandle.close < lastCandle.open) shortScore += 10;

        const isLong  = longScore >= shortScore;
        const score   = isLong ? longScore : shortScore;
        const dir     = isLong ? 'LONG' as const : 'SHORT' as const;

        if (score >= 70) {
          opportunities.push({
            symbol: ticker.symbol,
            direction: dir,
            score,
            price,
            signal: `${dir} | VWAP Dev:${deviationPct.toFixed(2)}% | RSI:${rsi.toFixed(1)} | Score:${score}`,
          });
        }
      })
    );

    if (opportunities.length === 0) {
      console.log(`[ORACLE] Nenhuma oportunidade encontrada (${tickers.length} pares analisados)`);
      return;
    }

    opportunities.sort((a, b) => b.score - a.score);
    const best = opportunities[0];

    console.log(`[ORACLE] Melhor oportunidade: ${best.symbol} ${best.direction} Score:${best.score}`);
    this.subscribeToSymbol(best.symbol);
    this.markSignal(best.signal);
    this.lastSymbolTrade.set(best.symbol, Date.now());

    const trade = await this.executor.openTrade(this.id, best.symbol, best.direction, best.price);
    if (trade) {
      console.log(`[ORACLE] Trade aberto — ${best.direction} ${best.symbol} @ $${best.price}`);
    }
  }
}
