import { EventEmitter } from 'events';
import { BinanceClient } from '../services/BinanceClient';
import { OrderExecutor } from '../services/OrderExecutor';
import { RobotState, Trade, Candle } from '../types';
import { RISK_CONFIG } from '../config/binance';

export abstract class BaseRobot extends EventEmitter {
  protected id: string;
  protected name: string;
  protected symbol: string;
  protected strategy: string;
  protected binance: BinanceClient;
  protected executor: OrderExecutor;
  protected state: RobotState;
  protected tradeHistory: Trade[] = [];
  protected lastSignalTime = 0;
  protected signalCooldownMs = 5000;
  protected subscribedSymbols: Set<string> = new Set();
  protected scanIntervalMs = 2 * 60 * 1000;
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private tickHandler: ((data: { symbol: string; price: number }) => void) | null = null;
  private candleHandler: ((data: { symbol: string; candle: Candle }) => void) | null = null;
  private tradeOpenHandler: ((trade: Trade) => void) | null = null;
  private tradeCloseHandler: ((trade: Trade) => void) | null = null;

  constructor(id: string, name: string, symbol: string, strategy: string, binance: BinanceClient, executor: OrderExecutor) {
    super();
    this.id       = id;
    this.name     = name;
    this.symbol   = symbol;
    this.strategy = strategy;
    this.binance  = binance;
    this.executor = executor;
    this.state    = {
      id, name, symbol,
      status: 'idle',
      strategy,
      totalPnl: 0, todayPnl: 0, winCount: 0, lossCount: 0,
      activeTrades: [], drawdown: 0,
      capital: RISK_CONFIG.initialCapital * RISK_CONFIG.robotCapitalShare,
    };
    this.setupListeners();
  }

  private setupListeners() {
    this.tradeOpenHandler = (trade: Trade) => {
      if (trade.robotId !== this.id) return;
      this.state.activeTrades.push(trade);
      this.state.symbol = trade.symbol;
      this.emitState();
    };
    this.tradeCloseHandler = (trade: Trade) => {
      if (trade.robotId !== this.id) return;
      this.state.activeTrades = this.state.activeTrades.filter(t => t.id !== trade.id);
      this.tradeHistory.push(trade);
      const pnl = trade.pnl || 0;
      this.state.totalPnl += pnl;
      this.state.todayPnl += pnl;
      if (pnl > 0) this.state.winCount++;
      else this.state.lossCount++;
      this.emitState();
    };
    this.executor.on('trade_open', this.tradeOpenHandler);
    this.executor.on('trade_close', this.tradeCloseHandler);
  }

  async start() {
    this.state.status = 'running';
    await this.initialize();

    // Tick listener: check TP/SL for ANY symbol this robot has active trades on
    this.tickHandler = ({ symbol, price }: { symbol: string; price: number }) => {
      if (this.state.status !== 'running') return;
      if (this.state.activeTrades.some(t => t.symbol === symbol)) {
        this.executor.checkTPSL(symbol, price);
      }
      if (this.subscribedSymbols.has(symbol)) {
        this.onTick(price);
      }
    };
    this.binance.on('tick', this.tickHandler);

    // Candle listener: process candles for any subscribed symbol
    this.candleHandler = ({ symbol, candle }: { symbol: string; candle: Candle }) => {
      if (this.state.status !== 'running') return;
      if (this.subscribedSymbols.has(symbol)) {
        this.onCandle(candle);
      }
    };
    this.binance.on('candle', this.candleHandler);

    // Run first scan immediately, then on interval
    this.runScanCycle();
    this.scanTimer = setInterval(() => this.runScanCycle(), this.scanIntervalMs);
    this.emitState();
  }

  private async runScanCycle() {
    if (this.state.status !== 'running') return;
    try {
      await this.scan();
    } catch (e) {
      console.error(`[${this.name}] Scan error:`, e instanceof Error ? e.message : e);
    }
  }

  stop() {
    this.state.status = 'stopped';
    if (this.scanTimer) { clearInterval(this.scanTimer); this.scanTimer = null; }
    if (this.tickHandler) { this.binance.removeListener('tick', this.tickHandler); this.tickHandler = null; }
    if (this.candleHandler) { this.binance.removeListener('candle', this.candleHandler); this.candleHandler = null; }
    if (this.tradeOpenHandler) { this.executor.removeListener('trade_open', this.tradeOpenHandler); this.tradeOpenHandler = null; }
    if (this.tradeCloseHandler) { this.executor.removeListener('trade_close', this.tradeCloseHandler); this.tradeCloseHandler = null; }
    this.emitState();
  }

  pause() { this.state.status = 'paused'; this.emitState(); }

  resume() {
    this.state.status = 'running';
    if (!this.scanTimer) {
      this.scanTimer = setInterval(() => this.runScanCycle(), this.scanIntervalMs);
    }
    this.emitState();
  }

  protected subscribeToSymbol(symbol: string) {
    if (!this.subscribedSymbols.has(symbol)) {
      this.subscribedSymbols.add(symbol);
      this.binance.subscribeAggTrade(symbol);
    }
  }

  protected canSignal(): boolean {
    if (this.executor.isKillSwitchActive()) return false;
    return Date.now() - this.lastSignalTime > this.signalCooldownMs;
  }

  protected markSignal(signal: string) {
    this.lastSignalTime = Date.now();
    this.state.lastSignal = signal;
    this.state.lastSignalTime = this.lastSignalTime;
    if (!this.state.signalHistory) this.state.signalHistory = [];
    this.state.signalHistory = [{ signal, time: this.lastSignalTime }, ...this.state.signalHistory].slice(0, 20);
  }

  protected emitState() {
    this.emit('state_update', this.getState());
  }

  setCapital(amount: number) {
    this.state.capital = amount;
  }

  getState(): RobotState { return { ...this.state }; }
  getTradeHistory(): Trade[] { return [...this.tradeHistory]; }

  // Lifecycle hooks — override as needed
  protected async initialize(): Promise<void> {}
  protected onCandle(_candle: Candle): void {}
  protected onTick(_price: number): void {}

  // Each robot implements its own dynamic scan strategy
  protected abstract scan(): Promise<void>;
}
