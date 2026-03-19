import { EventEmitter } from 'events';
import axios from 'axios';
import { calculateRSI } from '../indicators/rsi';
import { calculateBollingerBands } from '../indicators/bollingerBands';
import { latestEMA } from '../indicators/ema';
import { RadarSignal } from '../types';

const FUTURES_BASE = 'https://fapi.binance.com';
const SCAN_INTERVAL_MS = 3 * 60 * 1000;
const TOP_N_SYMBOLS = 50;
const TOP_SIGNALS = 6;
const CANDLE_LIMIT = 60;

const EXCLUDED_PATTERNS = ['UPUSDT', 'DOWNUSDT', 'BEARUSDT', 'BULLUSDT', 'BUSDUSDT'];

function scoreSymbol(closes: number[], volumes: number[]): { longScore: number; shortScore: number; details: Partial<RadarSignal> } {
  if (closes.length < 30) return { longScore: 0, shortScore: 0, details: {} };

  const price = closes[closes.length - 1];
  const rsi = calculateRSI(closes, 14);
  const bb = calculateBollingerBands(closes, 20, 2.0);
  const ema9 = latestEMA(closes, 9);
  const ema21 = latestEMA(closes, 21);
  const ema50 = latestEMA(closes, 50);

  const recentVols = volumes.slice(-20);
  const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
  const lastVol = volumes[volumes.length - 1];
  const volRatio = avgVol > 0 ? lastVol / avgVol : 1;

  const price3CandlesAgo = closes[closes.length - 4];
  const momentum3 = price3CandlesAgo > 0 ? ((price - price3CandlesAgo) / price3CandlesAgo) * 100 : 0;

  let longScore = 0;
  let shortScore = 0;
  const longReasons: string[] = [];
  const shortReasons: string[] = [];

  // RSI score (30 pts)
  if (rsi < 25) { longScore += 30; longReasons.push(`RSI ${rsi.toFixed(1)} — Fortemente Sobrevendido`); }
  else if (rsi < 30) { longScore += 22; longReasons.push(`RSI ${rsi.toFixed(1)} — Sobrevendido`); }
  else if (rsi < 38) { longScore += 12; longReasons.push(`RSI ${rsi.toFixed(1)} — Zona de Compra`); }
  if (rsi > 75) { shortScore += 30; shortReasons.push(`RSI ${rsi.toFixed(1)} — Fortemente Sobrecomprado`); }
  else if (rsi > 70) { shortScore += 22; shortReasons.push(`RSI ${rsi.toFixed(1)} — Sobrecomprado`); }
  else if (rsi > 62) { shortScore += 12; shortReasons.push(`RSI ${rsi.toFixed(1)} — Zona de Venda`); }

  // Bollinger Bands score (25 pts)
  const bbPosition: RadarSignal['bbPosition'] = price < bb.lower ? 'ABAIXO' : price > bb.upper ? 'ACIMA' : 'MEIO';
  if (price < bb.lower) { longScore += 25; longReasons.push(`Preço abaixo da BB inferior`); }
  else if (price < bb.middle) { longScore += 8; longReasons.push(`Preço abaixo da BB média`); }
  if (price > bb.upper) { shortScore += 25; shortReasons.push(`Preço acima da BB superior`); }
  else if (price > bb.middle) { shortScore += 8; shortReasons.push(`Preço acima da BB média`); }
  if (bb.bandwidth < 0.02) {
    longScore += 6;
    shortScore += 6;
    longReasons.push(`BB comprimida (breakout iminente)`);
  }

  // EMA Alignment score (25 pts)
  const emaAlignment: RadarSignal['emaAlignment'] = ema9 > ema21 && ema21 > ema50 ? 'ALTA' : ema9 < ema21 && ema21 < ema50 ? 'BAIXA' : 'NEUTRO';
  if (emaAlignment === 'ALTA') { longScore += 25; longReasons.push(`EMA Alinhada: Alta (9>21>50)`); }
  else if (ema9 > ema21) { longScore += 12; longReasons.push(`EMA9 > EMA21`); }
  if (emaAlignment === 'BAIXA') { shortScore += 25; shortReasons.push(`EMA Alinhada: Baixa (9<21<50)`); }
  else if (ema9 < ema21) { shortScore += 12; shortReasons.push(`EMA9 < EMA21`); }

  // Volume score (20 pts)
  if (volRatio >= 2.0) { longScore += 20; shortScore += 20; longReasons.push(`Volume Spike ${volRatio.toFixed(1)}×`); shortReasons.push(`Volume Spike ${volRatio.toFixed(1)}×`); }
  else if (volRatio >= 1.5) { longScore += 12; shortScore += 12; longReasons.push(`Volume elevado ${volRatio.toFixed(1)}×`); shortReasons.push(`Volume elevado ${volRatio.toFixed(1)}×`); }
  else if (volRatio >= 1.2) { longScore += 6; shortScore += 6; }

  // Momentum (bonus, caps at existing)
  if (momentum3 < -0.8) { longScore += 8; longReasons.push(`Queda ${momentum3.toFixed(2)}% — Reversão provável`); }
  if (momentum3 > 0.8) { shortScore += 8; shortReasons.push(`Alta ${momentum3.toFixed(2)}% — Exaustão provável`); }

  const direction: 'LONG' | 'SHORT' = longScore >= shortScore ? 'LONG' : 'SHORT';
  const finalScore = Math.min(100, direction === 'LONG' ? longScore : shortScore);

  const details: Partial<RadarSignal> = {
    rsi: parseFloat(rsi.toFixed(1)),
    bbPosition,
    emaAlignment,
    volumeSpike: parseFloat(volRatio.toFixed(2)),
    priceChange1h: parseFloat(momentum3.toFixed(2)),
    currentPrice: price,
    direction,
    score: finalScore,
    strength: finalScore >= 70 ? 'FORTE' : finalScore >= 45 ? 'MODERADO' : 'FRACO',
    reasons: direction === 'LONG' ? longReasons : shortReasons,
  };

  return { longScore, shortScore, details };
}

export class RadarBot extends EventEmitter {
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private isScanning = false;
  private lastSignals: RadarSignal[] = [];
  private scanCount = 0;

  async start() {
    console.log('[RADAR] Iniciando scanner de 50 ativos...');
    await this.scan();
    this.scanTimer = setInterval(() => this.scan(), SCAN_INTERVAL_MS);
  }

  stop() {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    console.log('[RADAR] Scanner parado');
  }

  getLastSignals(): RadarSignal[] {
    return this.lastSignals;
  }

  getScanCount(): number {
    return this.scanCount;
  }

  async forceScan(): Promise<RadarSignal[]> {
    await this.scan();
    return this.lastSignals;
  }

  private async scan() {
    if (this.isScanning) return;
    this.isScanning = true;
    const startMs = Date.now();

    try {
      // Step 1: Get all 24h tickers from Binance Futures
      const tickerRes = await axios.get(`${FUTURES_BASE}/fapi/v1/ticker/24hr`, { timeout: 8000 });
      const allTickers: Array<{ symbol: string; quoteVolume: string; lastPrice: string; priceChangePercent: string }> = tickerRes.data;

      // Step 2: Filter USDT perpetuals, exclude leveraged tokens
      const usdtTickers = allTickers.filter(t => {
        if (!t.symbol.endsWith('USDT')) return false;
        if (EXCLUDED_PATTERNS.some(p => t.symbol.includes(p))) return false;
        return parseFloat(t.quoteVolume) > 1_000_000;
      });

      // Step 3: Sort by volume, take top N
      usdtTickers.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
      const top50 = usdtTickers.slice(0, TOP_N_SYMBOLS);

      console.log(`[RADAR] Analisando ${top50.length} ativos...`);

      // Step 4: Fetch candles for each symbol in batches
      const BATCH = 10;
      const scoredSymbols: RadarSignal[] = [];

      for (let i = 0; i < top50.length; i += BATCH) {
        const batch = top50.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(ticker => this.analyzeSymbol(ticker.symbol, ticker))
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            scoredSymbols.push(r.value);
          }
        }
        if (i + BATCH < top50.length) {
          await new Promise(res => setTimeout(res, 200));
        }
      }

      // Step 5: Sort by score, pick top 6
      scoredSymbols.sort((a, b) => b.score - a.score);
      const top6 = scoredSymbols.slice(0, TOP_SIGNALS).map((s, i) => ({ ...s, rank: i + 1 }));

      this.lastSignals = top6;
      this.scanCount++;

      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      console.log(`[RADAR] Scan #${this.scanCount} completo em ${elapsed}s — Top: ${top6.map(s => `${s.symbol}(${s.score})`).join(', ')}`);

      this.emit('radar_update', {
        signals: top6,
        scannedAt: Date.now(),
        scanCount: this.scanCount,
        totalScanned: scoredSymbols.length,
        elapsed: parseFloat(elapsed),
      });
    } catch (err) {
      console.error('[RADAR] Erro no scan:', err instanceof Error ? err.message : err);
    } finally {
      this.isScanning = false;
    }
  }

  private async analyzeSymbol(
    symbol: string,
    ticker: { quoteVolume: string; lastPrice: string; priceChangePercent: string }
  ): Promise<RadarSignal | null> {
    try {
      const klinesRes = await axios.get(`${FUTURES_BASE}/fapi/v1/klines`, {
        params: { symbol, interval: '1m', limit: CANDLE_LIMIT },
        timeout: 5000,
      });

      const klines: Array<[number, string, string, string, string, string]> = klinesRes.data;
      if (!klines || klines.length < 30) return null;

      const closes = klines.map(k => parseFloat(k[4]));
      const volumes = klines.map(k => parseFloat(k[5]));

      const { details } = scoreSymbol(closes, volumes);
      if (!details.direction || (details.score ?? 0) < 20) return null;

      return {
        rank: 0,
        symbol,
        direction: details.direction,
        score: details.score ?? 0,
        strength: details.strength ?? 'FRACO',
        rsi: details.rsi ?? 50,
        bbPosition: details.bbPosition ?? 'MEIO',
        emaAlignment: details.emaAlignment ?? 'NEUTRO',
        volumeSpike: details.volumeSpike ?? 1,
        priceChange1h: details.priceChange1h ?? 0,
        currentPrice: details.currentPrice ?? parseFloat(ticker.lastPrice),
        volume24h: parseFloat(ticker.quoteVolume),
        change24h: parseFloat(ticker.priceChangePercent),
        scannedAt: Date.now(),
        reasons: details.reasons ?? [],
      };
    } catch {
      return null;
    }
  }
}
