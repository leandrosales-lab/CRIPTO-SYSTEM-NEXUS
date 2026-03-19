import { BaseRobot } from './BaseRobot';
import { BinanceClient } from '../services/BinanceClient';
import { OrderExecutor } from '../services/OrderExecutor';
import { fetchTopSymbols, fetchCandleData } from '../utils/fetchCandlesRest';
import { calculateRSI } from '../indicators/rsi';
import { latestEMA } from '../indicators/ema';
import { calculateMACD } from '../indicators/macd';

interface Opportunity {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  score: number;
  signal: string;
  price: number;
}

export class NexusBot extends BaseRobot {
  private lastSymbolTrade: Map<string, number> = new Map();
  private readonly symbolCooldownMs = 10 * 60 * 1000;

  constructor(binance: BinanceClient, executor: OrderExecutor) {
    super('nexus', 'NEXUS', 'MULTI', 'RSI(14) + EMA Trend + MACD — Scanner Dinâmico', binance, executor);
    this.scanIntervalMs   = 120 * 1000; // scan a cada 2min
    this.signalCooldownMs = 15 * 1000;
  }

  protected async scan() {
    if (!this.canSignal()) return;

    const tickers = await fetchTopSymbols(30);
    const opportunities: Opportunity[] = [];

    await Promise.allSettled(
      tickers.map(async ticker => {
        const lastTrade = this.lastSymbolTrade.get(ticker.symbol) ?? 0;
        if (Date.now() - lastTrade < this.symbolCooldownMs) return;

        const data = await fetchCandleData(ticker.symbol, '3m', 60);
        if (!data || data.closes.length < 30) return;

        const price = data.closes[data.closes.length - 1];
        const rsi   = calculateRSI(data.closes, 14);
        const ema9  = latestEMA(data.closes, 9);
        const ema21 = latestEMA(data.closes, 21);
        const ema50 = latestEMA(data.closes, 50);
        const macd  = calculateMACD(data.closes, 5, 13, 5);

        const recentVols = data.volumes.slice(-10);
        const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
        const volSpike = data.volumes[data.volumes.length - 1] > avgVol * 1.3;

        let longScore = 0, shortScore = 0;

        // RSI score (30 pts)
        if (rsi < 28)       longScore  += 30;
        else if (rsi < 35)  longScore  += 18;
        if (rsi > 72)       shortScore += 30;
        else if (rsi > 65)  shortScore += 18;

        // EMA alignment (25 pts)
        if (ema9 > ema21 && ema21 > ema50)       longScore  += 25;
        else if (ema9 > ema21)                   longScore  += 12;
        if (ema9 < ema21 && ema21 < ema50)       shortScore += 25;
        else if (ema9 < ema21)                   shortScore += 12;

        // MACD confirmation (20 pts) — guard against NaN/undefined
        const histOk = macd?.histogram != null && !isNaN(macd.histogram);
        const prevOk = macd?.prevHistogram != null && !isNaN(macd.prevHistogram);
        if (histOk && prevOk) {
          if (macd.histogram > 0 && macd.histogram > macd.prevHistogram) longScore  += 20;
          if (macd.histogram < 0 && macd.histogram < macd.prevHistogram) shortScore += 20;
        }

        // Volume spike (15 pts) — direcional pelo candle atual
        const lastClose = data.closes[data.closes.length - 1];
        const lastOpen  = data.opens[data.opens.length - 1];
        if (volSpike && lastClose > lastOpen) longScore  += 15;
        if (volSpike && lastClose < lastOpen) shortScore += 15;

        const isLong  = longScore >= shortScore;
        const score   = isLong ? longScore : shortScore;
        const dir     = isLong ? 'LONG' as const : 'SHORT' as const;

        if (score >= 55) {
          opportunities.push({
            symbol: ticker.symbol,
            direction: dir,
            score,
            price,
            signal: `${dir} | RSI:${rsi.toFixed(1)} | EMA:${ema9 > ema21 ? '↑' : '↓'} | MACD:${histOk ? macd.histogram.toFixed(3) : 'N/A'} | Score:${score}`,
          });
        }
      })
    );

    if (opportunities.length === 0) {
      console.log(`[NEXUS] Nenhuma oportunidade encontrada (${tickers.length} pares analisados)`);
      return;
    }

    opportunities.sort((a, b) => b.score - a.score);
    const best = opportunities[0];

    console.log(`[NEXUS] Melhor oportunidade: ${best.symbol} ${best.direction} Score:${best.score}`);
    this.subscribeToSymbol(best.symbol);
    this.markSignal(best.signal);
    this.lastSymbolTrade.set(best.symbol, Date.now());

    const trade = await this.executor.openTrade(this.id, best.symbol, best.direction, best.price);
    if (trade) {
      console.log(`[NEXUS] Trade aberto — ${best.direction} ${best.symbol} @ $${best.price}`);
    }
  }
}
