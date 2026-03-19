import { BaseRobot } from './BaseRobot';
import { BinanceClient } from '../services/BinanceClient';
import { OrderExecutor } from '../services/OrderExecutor';
import { fetchTopSymbols, fetchCandleData } from '../utils/fetchCandlesRest';
import { calculateRSI } from '../indicators/rsi';
import { calculateBollingerBands } from '../indicators/bollingerBands';

interface Opportunity {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  score: number;
  rsi: number;
  signal: string;
  price: number;
}

export class PhantomBot extends BaseRobot {
  private lastSymbolTrade: Map<string, number> = new Map();
  private readonly symbolCooldownMs = 10 * 60 * 1000; // 10min per symbol

  constructor(binance: BinanceClient, executor: OrderExecutor) {
    super('phantom', 'PHANTOM', 'MULTI', 'RSI(14) Scalping + Bollinger Bands — Scanner Dinâmico', binance, executor);
    this.scanIntervalMs   = 90 * 1000; // scan a cada 90s
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

        const data = await fetchCandleData(ticker.symbol, '3m', 50);
        if (!data || data.closes.length < 30) return;

        const rsi = calculateRSI(data.closes, 14);
        const bb  = calculateBollingerBands(data.closes, 14, 2.0);
        const price = data.closes[data.closes.length - 1];

        const recentVols = data.volumes.slice(-20);
        const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
        const volSpike = data.volumes[data.volumes.length - 1] > avgVol * 1.4;

        let longScore = 0, shortScore = 0;

        // RSI score
        if (rsi < 25)       longScore += 40;
        else if (rsi < 30)  longScore += 28;
        else if (rsi < 36)  longScore += 14;
        if (rsi > 75)       shortScore += 40;
        else if (rsi > 70)  shortScore += 28;
        else if (rsi > 64)  shortScore += 14;

        // Bollinger Bands score
        if (price < bb.lower) longScore += 35;
        else if (price < bb.middle) longScore += 10;
        if (price > bb.upper) shortScore += 35;
        else if (price > bb.middle) shortScore += 10;

        // Volume spike — direcional pelo candle atual
        const lastClose = data.closes[data.closes.length - 1];
        const lastOpen  = data.opens[data.opens.length - 1];
        if (volSpike && lastClose > lastOpen) longScore  += 15; // candle de alta
        if (volSpike && lastClose < lastOpen) shortScore += 15; // candle de baixa

        const isLong  = longScore >= shortScore;
        const score   = isLong ? longScore : shortScore;
        const dir     = isLong ? 'LONG' as const : 'SHORT' as const;

        if (score >= 65) {
          opportunities.push({
            symbol: ticker.symbol,
            direction: dir,
            score,
            rsi,
            price,
            signal: `${dir} | RSI:${rsi.toFixed(1)} | BB:${price < bb.lower ? 'ABAIXO' : price > bb.upper ? 'ACIMA' : 'MEIO'} | Score:${score}`,
          });
        }
      })
    );

    if (opportunities.length === 0) {
      console.log(`[PHANTOM] Nenhuma oportunidade encontrada (${tickers.length} pares analisados)`);
      return;
    }

    opportunities.sort((a, b) => b.score - a.score);
    const best = opportunities[0];

    console.log(`[PHANTOM] Melhor oportunidade: ${best.symbol} ${best.direction} Score:${best.score}`);
    this.subscribeToSymbol(best.symbol);
    this.markSignal(best.signal);
    this.lastSymbolTrade.set(best.symbol, Date.now());

    const trade = await this.executor.openTrade(this.id, best.symbol, best.direction, best.price);
    if (trade) {
      console.log(`[PHANTOM] Trade aberto — ${best.direction} ${best.symbol} @ $${best.price}`);
    }
  }
}
