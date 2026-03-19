import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { BINANCE_CONFIG, SIMULATION_MODE, PAPER_TRADING, REAL_WS_URL, REAL_REST_URL } from '../config/binance';
import { BinanceAggTrade, BinanceDepth, Candle, OrderBook } from '../types';

interface SymbolFilter {
  stepSize:    number;
  tickSize:    number;
  minQty:      number;
  minNotional: number;
}

interface SimAsset {
  price: number;
  volatility: number;
  trend: number;
  trendStrength: number;
  trendDuration: number;
  trendTimer: number;
  baseVolume: number;
}

const VIRTUAL_ORDER = (extra?: object) => ({ orderId: `PAPER-${Date.now()}`, virtual: true, ...extra });

export class BinanceClient extends EventEmitter {
  private http: AxiosInstance;
  private publicHttp: AxiosInstance;
  private streams: Map<string, WebSocket> = new Map();
  private candleBuffers: Map<string, Candle[]> = new Map();
  private orderBooks: Map<string, OrderBook> = new Map();
  private syntheticCandles: Map<string, {
    open: number; high: number; low: number; close: number; volume: number; startTime: number;
  }> = new Map();

  private symbolFilters: Map<string, SymbolFilter> = new Map();
  private simAssets: Map<string, SimAsset> = new Map();
  private simTimers: ReturnType<typeof setInterval>[] = [];
  private readonly SIM_TICK_MS   = 300;
  private readonly SIM_CANDLE_MS = 1500;
  private readonly LIVE_CANDLE_MS = 15000;
  private _runtimeMode: 'paper' | 'testnet' | 'live' = 'paper';
  private listenKey: string | null = null;
  private listenKeyTimer: ReturnType<typeof setInterval> | null = null;
  private userDataWs: WebSocket | null = null;

  constructor() {
    super();
    this.http = axios.create({
      baseURL: BINANCE_CONFIG.baseUrl,
      timeout: 8000,
      headers: { 'X-MBX-APIKEY': BINANCE_CONFIG.apiKey },
    });
    this.publicHttp = axios.create({
      baseURL: REAL_REST_URL,
      timeout: 8000,
    });

    if (SIMULATION_MODE && !PAPER_TRADING) {
      console.log('[SIM]   Simulation mode ACTIVE — synthetic prices, virtual orders');
      this.initSimAssets();
    } else if (PAPER_TRADING) {
      console.log('[PAPER] Paper Trading ACTIVE — REAL Binance prices (public WS), virtual orders');
    }
  }

  /** Atualiza credenciais em runtime (chamado após salvar chaves no dashboard) */
  updateCredentials(apiKey: string, apiSecret: string, baseUrl: string): void {
    BINANCE_CONFIG.apiKey    = apiKey;
    BINANCE_CONFIG.apiSecret = apiSecret;
    BINANCE_CONFIG.baseUrl   = baseUrl;
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 8000,
      headers: { 'X-MBX-APIKEY': apiKey },
    });
    console.log(`[BinanceClient] Credenciais atualizadas. Base URL: ${baseUrl}`);
  }

  /** Testa conectividade e retorna info da conta */
  async testCredentials(): Promise<{ ok: boolean; info?: object; error?: string }> {
    try {
      const ts = Date.now();
      const qs = `timestamp=${ts}`;
      const sig = crypto.createHmac('sha256', BINANCE_CONFIG.apiSecret).update(qs).digest('hex');
      const r = await this.http.get(`/fapi/v2/account?${qs}&signature=${sig}`);
      const d = r.data;
      return { ok: true, info: {
        totalWalletBalance:         parseFloat(String(d.totalWalletBalance         ?? '0')),
        totalUnrealizedProfit:      parseFloat(String(d.totalUnrealizedProfit      ?? '0')),
        totalMarginBalance:         parseFloat(String(d.totalMarginBalance         ?? '0')),
        availableBalance:           parseFloat(String(d.availableBalance           ?? '0')),
        totalPositionInitialMargin: parseFloat(String(d.totalPositionInitialMargin ?? '0')),
      }};
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { msg?: string } } })?.response?.data?.msg || String(e);
      return { ok: false, error: msg };
    }
  }

  /* ─── Simulation engine ─────────────────────────────────────────────────── */

  private initSimAssets() {
    const assets: [string, Partial<SimAsset>][] = [
      ['BTCUSDT', { price: 67420, volatility: 0.0025, baseVolume: 12.5  }],
      ['ETHUSDT', { price: 3218,  volatility: 0.0035, baseVolume: 85.0  }],
      ['SOLUSDT', { price: 142.5, volatility: 0.0048, baseVolume: 1200  }],
    ];
    for (const [sym, opts] of assets) {
      this.simAssets.set(sym, {
        price:         opts.price!,
        volatility:    opts.volatility!,
        trend:         (Math.random() - 0.5) * opts.volatility! * 1.5,
        trendStrength: opts.volatility! * 2.0,
        trendDuration: 8 + Math.floor(Math.random() * 20),
        trendTimer:    0,
        baseVolume:    opts.baseVolume!,
      });
      this.candleBuffers.set(sym, this.buildSimHistory(sym, opts.price!, opts.volatility!, 200));
    }
  }

  private buildSimHistory(symbol: string, startPrice: number, vol: number, bars: number): Candle[] {
    const candles: Candle[] = [];
    let price = startPrice * (0.97 + Math.random() * 0.06);
    const now = Date.now();
    for (let i = bars; i >= 0; i--) {
      const t     = now - i * this.SIM_CANDLE_MS;
      const chg   = (Math.random() - 0.5) * vol * price * 2;
      const open  = price;
      const close = price + chg;
      const high  = Math.max(open, close) * (1 + Math.random() * vol * 0.5);
      const low   = Math.min(open, close) * (1 - Math.random() * vol * 0.5);
      const volume = (this.simAssets.get(symbol)?.baseVolume || 100) * (0.5 + Math.random());
      candles.push({ time: t, open, high, low, close, volume });
      price = close;
    }
    if (this.simAssets.has(symbol)) this.simAssets.get(symbol)!.price = price;
    return candles;
  }

  private simTick(symbol: string) {
    const asset = this.simAssets.get(symbol);
    if (!asset) return;
    asset.trendTimer++;
    if (asset.trendTimer >= asset.trendDuration) {
      asset.trend = (Math.random() - 0.48) * asset.trendStrength;
      asset.trendDuration = 15 + Math.floor(Math.random() * 50);
      asset.trendTimer = 0;
    }
    const pctChange = asset.trend + (Math.random() - 0.5) * asset.volatility;
    asset.price = asset.price * (1 + pctChange);
    const qty = asset.baseVolume * (0.3 + Math.random() * 2.5);
    const now = Date.now();
    const spread = asset.price * 0.0001;
    const book: OrderBook = {
      bids: Array.from({ length: 5 }, (_, i) => ({ price: asset.price - spread * (i + 1), qty: qty * (0.8 + Math.random() * 0.4) })),
      asks: Array.from({ length: 5 }, (_, i) => ({ price: asset.price + spread * (i + 1), qty: qty * (0.8 + Math.random() * 0.4) })),
      timestamp: now,
    };
    const bias = Math.random();
    if (bias > 0.7)      book.bids.forEach(b => { b.qty *= 1.8; });
    else if (bias < 0.3) book.asks.forEach(a => { a.qty *= 1.8; });
    this.orderBooks.set(symbol, book);
    this.emit('depth', { symbol, book });
    this.emit('tick', { symbol, price: asset.price, qty, time: now });
    this.updateSyntheticCandle(symbol, asset.price, qty, now, this.SIM_CANDLE_MS);
  }

  /* ─── Shared candle builder ─────────────────────────────────────────────── */

  private updateSyntheticCandle(symbol: string, price: number, qty: number, now: number, windowMs: number) {
    let sc = this.syntheticCandles.get(symbol);
    if (!sc || now - sc.startTime >= windowMs) {
      if (sc) {
        const finalized: Candle = { time: sc.startTime, open: sc.open, high: sc.high, low: sc.low, close: sc.close, volume: sc.volume };
        const buf = this.candleBuffers.get(symbol) || [];
        buf.push(finalized);
        if (buf.length > 500) buf.shift();
        this.candleBuffers.set(symbol, buf);
        this.emit('candle', { symbol, candle: finalized });
      }
      sc = { open: price, high: price, low: price, close: price, volume: qty, startTime: now };
    } else {
      sc.high   = Math.max(sc.high, price);
      sc.low    = Math.min(sc.low,  price);
      sc.close  = price;
      sc.volume += qty;
    }
    this.syntheticCandles.set(symbol, sc);
  }

  /* ─── Signed REST (live trading only) ──────────────────────────────────── */

  private sign(params: Record<string, string | number>): string {
    const query = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
    return crypto.createHmac('sha256', BINANCE_CONFIG.apiSecret).update(query).digest('hex');
  }

  private async signedRequest(method: 'GET' | 'POST' | 'DELETE', path: string, params: Record<string, string | number> = {}) {
    const timestamp = Date.now();
    const allParams = { ...params, timestamp, recvWindow: BINANCE_CONFIG.recvWindow };
    const signature = this.sign(allParams);
    const qs = Object.entries(allParams).map(([k, v]) => `${k}=${v}`).join('&') + `&signature=${signature}`;
    if (method === 'GET')  return (await this.http.get   (`${path}?${qs}`)).data;
    if (method === 'POST') return (await this.http.post  (`${path}?${qs}`)).data;
    return                        (await this.http.delete(`${path}?${qs}`)).data;
  }

  /* ─── Order methods (virtual in paper / sim, real in live) ─────────────── */

  private get isVirtual() {
    if (this._runtimeMode === 'live' || this._runtimeMode === 'testnet') return false;
    return SIMULATION_MODE || PAPER_TRADING;
  }

  setRuntimeMode(mode: 'paper' | 'testnet' | 'live'): void { this._runtimeMode = mode; }

  /**
   * Returns true only when real orders are sent to Binance and TP/SL are managed
   * natively via User Data Stream. In testnet/paper mode orders are simulated
   * locally, so checkTPSL must handle them — isLive() returns false.
   */
  isLive(): boolean {
    return this._runtimeMode === 'live' && !PAPER_TRADING && !SIMULATION_MODE;
  }

  async setLeverage(symbol: string, leverage: number) {
    if (this.isVirtual) return { symbol, leverage };
    try { return await this.signedRequest('POST', '/fapi/v1/leverage', { symbol, leverage }); }
    catch (e) {
      console.error('[BinanceClient] setLeverage error:', e);
      throw new Error(`Falha ao configurar leverage ${leverage}x para ${symbol}: ${(e as Error).message}`);
    }
  }

  async placeMarketOrder(symbol: string, side: 'BUY' | 'SELL', quantity: number, positionSide: 'LONG' | 'SHORT') {
    if (this.isVirtual) return VIRTUAL_ORDER({ symbol, side, positionSide, quantity });
    const adjQty = this.adjustQuantity(symbol, quantity);
    console.log(`[BinanceClient] MARKET ${side} ${symbol} qty=${adjQty} (raw: ${quantity.toFixed(6)})`);
    return await this.signedRequest('POST', '/fapi/v1/order', { symbol, side, positionSide, type: 'MARKET', quantity: adjQty.toString() });
  }

  async placeTPSLOrder(symbol: string, side: 'BUY' | 'SELL', positionSide: 'LONG' | 'SHORT', stopPrice: number, quantity: number, type: 'TAKE_PROFIT_MARKET' | 'STOP_MARKET') {
    if (this.isVirtual) return VIRTUAL_ORDER({ symbol, side, positionSide, stopPrice, type });
    const adjPrice = this.adjustPrice(symbol, stopPrice);
    const adjQty   = this.adjustQuantity(symbol, quantity);
    console.log(`[BinanceClient] ${type} ${side} ${symbol} stopPrice=${adjPrice} qty=${adjQty}`);
    // closePosition omitido: incompatível com quantity em hedge mode (positionSide define o lado)
    return await this.signedRequest('POST', '/fapi/v1/order', { symbol, side, positionSide, type, stopPrice: adjPrice.toString(), quantity: adjQty.toString() });
  }

  async cancelOrder(symbol: string, orderId: number) {
    if (this.isVirtual) return VIRTUAL_ORDER({ orderId });
    return await this.signedRequest('DELETE', '/fapi/v1/order', { symbol, orderId });
  }

  async getAccountInfo() {
    if (this.isVirtual) return { totalWalletBalance: '100', availableBalance: '100', virtual: true };
    return await this.signedRequest('GET', '/fapi/v2/account');
  }

  async getPositions() {
    if (this.isVirtual) return [];
    return await this.signedRequest('GET', '/fapi/v2/positionRisk');
  }

  /** Retorna apenas posições com tamanho != 0 (posições abertas reais) */
  async getOpenPositions(): Promise<Array<{
    symbol: string; positionAmt: string; entryPrice: string;
    leverage: string; notional: string; positionSide: string;
    unrealizedProfit: string;
  }>> {
    if (this.isVirtual) return [];
    try {
      const data = await this.signedRequest('GET', '/fapi/v2/positionRisk') as Array<Record<string, string>>;
      return data.filter(p => parseFloat(p.positionAmt) !== 0);
    } catch (e) {
      console.error('[BinanceClient] getOpenPositions error:', (e as Error).message);
      return [];
    }
  }

  /** Retorna ordens abertas (TP/SL) de um símbolo ou de todos */
  async getOpenOrders(symbol?: string): Promise<Array<{
    orderId: number; symbol: string; side: string;
    positionSide: string; type: string; stopPrice: string; origQty: string;
  }>> {
    if (this.isVirtual) return [];
    try {
      const params: Record<string, string | number> = symbol ? { symbol } : {};
      const data = await this.signedRequest('GET', '/fapi/v1/openOrders', params) as Array<Record<string, unknown>>;
      return data as Array<{ orderId: number; symbol: string; side: string; positionSide: string; type: string; stopPrice: string; origQty: string; }>;
    } catch (e) {
      console.error('[BinanceClient] getOpenOrders error:', (e as Error).message);
      return [];
    }
  }

  /* ─── Exchange info & precision ─────────────────────────────────────────── */

  /** Carrega LOT_SIZE, PRICE_FILTER e MIN_NOTIONAL de todos os símbolos (endpoint público). */
  async loadExchangeInfo(): Promise<void> {
    try {
      const res = await this.publicHttp.get('/fapi/v1/exchangeInfo');
      for (const sym of (res.data as { symbols: Array<{ symbol: string; filters: Array<Record<string, string>> }> }).symbols) {
        let stepSize = 0.001, tickSize = 0.01, minQty = 0.001, minNotional = 5;
        for (const f of sym.filters) {
          if (f.filterType === 'LOT_SIZE')    { stepSize = parseFloat(f.stepSize); minQty = parseFloat(f.minQty); }
          if (f.filterType === 'PRICE_FILTER') { tickSize    = parseFloat(f.tickSize); }
          if (f.filterType === 'MIN_NOTIONAL') { minNotional = parseFloat(f.notional); }
        }
        this.symbolFilters.set(sym.symbol, { stepSize, tickSize, minQty, minNotional });
      }
      console.log(`[BinanceClient] Exchange info: ${this.symbolFilters.size} símbolos carregados.`);
    } catch (e) {
      console.error('[BinanceClient] loadExchangeInfo error:', (e as Error).message);
    }
  }

  private precisionOf(step: number): number {
    if (step <= 0 || step >= 1) return 0;
    return Math.max(0, Math.round(-Math.log10(step)));
  }

  /** Arredonda qty para o stepSize do par (floor para não exceder capital). */
  adjustQuantity(symbol: string, qty: number): number {
    const f = this.symbolFilters.get(symbol);
    if (!f || f.stepSize <= 0) return parseFloat(qty.toFixed(3));
    const prec     = this.precisionOf(f.stepSize);
    const adjusted = Math.floor(qty / f.stepSize) * f.stepSize;
    return parseFloat(adjusted.toFixed(prec));
  }

  /** Arredonda preço para o tickSize do par (round). */
  adjustPrice(symbol: string, price: number): number {
    const f = this.symbolFilters.get(symbol);
    if (!f || f.tickSize <= 0) return parseFloat(price.toFixed(2));
    const prec     = this.precisionOf(f.tickSize);
    const adjusted = Math.round(price / f.tickSize) * f.tickSize;
    return parseFloat(adjusted.toFixed(prec));
  }

  getMinNotional(symbol: string): number { return this.symbolFilters.get(symbol)?.minNotional ?? 5; }
  getMinQty(symbol: string):      number { return this.symbolFilters.get(symbol)?.minQty      ?? 0.001; }

  /* ─── WebSocket subscriptions ───────────────────────────────────────────── */

  subscribeAggTrade(symbol: string) {
    /* ── Simulation: synthetic random walk ── */
    if (SIMULATION_MODE && !PAPER_TRADING) {
      const key = `sim@${symbol}`;
      if (this.streams.has(key)) return;
      const history = this.candleBuffers.get(symbol) || [];
      let delay = 0;
      for (const candle of history.slice(-100)) {
        setTimeout(() => this.emit('candle', { symbol, candle }), delay);
        delay += 8;
      }
      setTimeout(() => {
        const t = setInterval(() => this.simTick(symbol), this.SIM_TICK_MS);
        this.simTimers.push(t);
      }, delay + 50);
      this.streams.set(key, null as unknown as WebSocket);
      console.log(`[SIM]   ${symbol} — replaying ${Math.min(history.length, 100)} candles then live ticks`);
      return;
    }

    /* ── Paper / Live: real Binance public WebSocket ── */
    const wsBase = PAPER_TRADING ? REAL_WS_URL : BINANCE_CONFIG.wsBaseUrl;
    const key    = `${symbol.toLowerCase()}@aggTrade`;
    if (this.streams.has(key)) return;

    const connect = () => {
      const url = `${wsBase}/${symbol.toLowerCase()}@aggTrade`;
      const ws  = new WebSocket(url);

      ws.on('open', () => console.log(`[PAPER] ${symbol} aggTrade connected — ${url}`));

      ws.on('message', (data: Buffer) => {
        const tick: BinanceAggTrade = JSON.parse(data.toString());
        const price = parseFloat(tick.p);
        const qty   = parseFloat(tick.q);
        const sym   = tick.s;
        const now   = tick.T;
        this.emit('tick', { symbol: sym, price, qty, time: now });
        this.updateSyntheticCandle(sym, price, qty, now, this.LIVE_CANDLE_MS);
      });

      ws.on('error', (e) => console.error(`[WS aggTrade ${symbol}]`, e.message));
      ws.on('close', () => {
        this.streams.delete(key);
        console.log(`[WS] ${symbol} aggTrade disconnected — reconnecting in 3s`);
        setTimeout(connect, 3000);
      });
      this.streams.set(key, ws);
    };
    connect();
  }

  subscribeDepth(symbol: string) {
    if (SIMULATION_MODE && !PAPER_TRADING) return;

    const wsBase = PAPER_TRADING ? REAL_WS_URL : BINANCE_CONFIG.wsBaseUrl;
    const key    = `${symbol.toLowerCase()}@depth5@100ms`;
    if (this.streams.has(key)) return;

    const connect = () => {
      const url = `${wsBase}/${symbol.toLowerCase()}@depth5@100ms`;
      const ws  = new WebSocket(url);

      ws.on('open', () => console.log(`[PAPER] ${symbol} depth connected`));

      ws.on('message', (data: Buffer) => {
        const msg: BinanceDepth = JSON.parse(data.toString());
        const book: OrderBook = {
          bids: msg.b.map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) })),
          asks: msg.a.map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) })),
          timestamp: Date.now(),
        };
        this.orderBooks.set(symbol, book);
        this.emit('depth', { symbol, book });
      });

      ws.on('error', (e) => console.error(`[WS depth ${symbol}]`, e.message));
      ws.on('close', () => {
        this.streams.delete(key);
        setTimeout(connect, 3000);
      });
      this.streams.set(key, ws);
    };
    connect();
  }

  /* ─── Candle history ────────────────────────────────────────────────────── */

  getCandles(symbol: string): Candle[]       { return this.candleBuffers.get(symbol) || []; }
  getOrderBook(symbol: string): OrderBook | null { return this.orderBooks.get(symbol) || null; }
  getSimPrice(symbol: string): number        { return this.simAssets.get(symbol)?.price || 0; }

  async fetchInitialCandles(symbol: string, interval: string, limit: number) {
    if (SIMULATION_MODE && !PAPER_TRADING) {
      console.log(`[SIM]   ${symbol} — using ${this.candleBuffers.get(symbol)?.length || 0} pre-generated candles`);
      return this.candleBuffers.get(symbol) || [];
    }

    /* Paper or live: fetch from public REST (no auth needed for klines) */
    try {
      const res = await this.publicHttp.get(`/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
      const candles: Candle[] = (res.data as unknown[][]).map(k => ({
        time:   k[0] as number,
        open:   parseFloat(k[1] as string),
        high:   parseFloat(k[2] as string),
        low:    parseFloat(k[3] as string),
        close:  parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
      }));
      this.candleBuffers.set(symbol, candles.slice(-500));
      console.log(`[PAPER] ${symbol} — loaded ${candles.length} real candles from Binance`);
      return candles;
    } catch (e) {
      console.error(`[BinanceClient] fetchInitialCandles error:`, e);
      return [];
    }
  }

  /* ─── User Data Stream (OCO / live order fills) ─────────────────────────── */

  async startUserDataStream(): Promise<void> {
    if (this.isVirtual) return;
    try {
      const res = await this.http.post('/fapi/v1/listenKey');
      this.listenKey = res.data.listenKey as string;
      if (this.listenKeyTimer) clearInterval(this.listenKeyTimer);
      // Renew listenKey every 28 min (expires at 60 min)
      this.listenKeyTimer = setInterval(() => {
        if (this.listenKey) {
          this.http.put('/fapi/v1/listenKey', null, { params: { listenKey: this.listenKey } })
            .catch((e: Error) => console.error('[BinanceClient] renewListenKey error:', e.message));
        }
      }, 28 * 60 * 1000);
      this.connectUserDataStream();
      console.log('[BinanceClient] User Data Stream iniciado');
    } catch (e) {
      console.error('[BinanceClient] startUserDataStream error:', (e as Error).message);
    }
  }

  private connectUserDataStream(): void {
    if (!this.listenKey) return;
    if (this.userDataWs) { try { this.userDataWs.close(); } catch (_) {} }
    const url = `${BINANCE_CONFIG.wsBaseUrl}/${this.listenKey}`;
    const ws = new WebSocket(url);
    ws.on('open', () => console.log('[BinanceClient] User Data Stream conectado'));
    ws.on('message', (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString());
        if (event.e === 'ORDER_TRADE_UPDATE') {
          const o = event.o;
          if (o.X === 'FILLED' && (o.ot === 'TAKE_PROFIT_MARKET' || o.ot === 'STOP_MARKET')) {
            this.emit('order_fill', {
              symbol:      o.s as string,
              orderId:     String(o.i),
              orderType:   o.ot as 'TAKE_PROFIT_MARKET' | 'STOP_MARKET',
              side:        o.S as 'BUY' | 'SELL',
              positionSide: o.ps as 'LONG' | 'SHORT',
              avgPrice:    parseFloat(String(o.ap || o.L || '0')),
            });
          }
        }
      } catch (_) {}
    });
    ws.on('error', (e) => console.error('[BinanceClient] User Data Stream error:', e.message));
    ws.on('close', () => {
      this.userDataWs = null;
      if (this.listenKey) {
        console.log('[BinanceClient] User Data Stream fechado — gerando nova listenKey em 5s');
        setTimeout(async () => {
          try {
            const res = await this.http.post('/fapi/v1/listenKey');
            this.listenKey = res.data.listenKey as string;
            console.log('[BinanceClient] Nova listenKey gerada, reconectando User Data Stream');
          } catch (e) {
            console.error('[BinanceClient] Falha ao renovar listenKey:', (e as Error).message);
            setTimeout(() => this.startUserDataStream().catch(() => {}), 30000);
            return;
          }
          this.connectUserDataStream();
        }, 5000);
      }
    });
    this.userDataWs = ws;
  }

  stopUserDataStream(): void {
    this.listenKey = null;
    if (this.listenKeyTimer) { clearInterval(this.listenKeyTimer); this.listenKeyTimer = null; }
    if (this.userDataWs) { try { this.userDataWs.close(); } catch (_) {} this.userDataWs = null; }
  }

  /* ─── Cleanup ────────────────────────────────────────────────────────────── */

  destroy() {
    this.stopUserDataStream();
    this.simTimers.forEach(t => clearInterval(t));
    this.simTimers.length = 0;
    for (const ws of this.streams.values()) {
      if (ws && typeof ws.close === 'function') ws.close();
    }
    this.streams.clear();
  }
}
