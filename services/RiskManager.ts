import { EventEmitter } from 'events';
import { RISK_CONFIG } from '../config/binance';
import { Trade } from '../types';

export interface RiskCheck {
  allowed: boolean;
  reason?: string;
}

export class RiskManager extends EventEmitter {
  private capital: number;
  private initialCapital: number;
  private dailyStartCapital: number;
  private killSwitchActive = false;
  private lastReset: number;
  private robotCapitals: Map<string, number> = new Map();
  private robotInitialCapitals: Map<string, number> = new Map();
  private activeTrades: Map<string, Trade> = new Map();
  private hasLiveCapital = false;

  constructor() {
    super();
    this.capital = RISK_CONFIG.initialCapital;
    this.initialCapital = RISK_CONFIG.initialCapital;
    this.dailyStartCapital = RISK_CONFIG.initialCapital;
    this.lastReset = Date.now();
  }

  setRobotCapital(robotId: string, capital: number) {
    this.robotCapitals.set(robotId, capital);
    this.robotInitialCapitals.set(robotId, capital);
    // In live/testnet mode the total capital comes from Binance — don't overwrite it
    if (!this.hasLiveCapital) {
      this.capital = Array.from(this.robotCapitals.values()).reduce((a, b) => a + b, 0);
      this.initialCapital = this.capital;
      this.dailyStartCapital = this.capital;
    }
  }

  /** Set total system capital from real Binance balance (live/testnet mode) — call once at session start */
  setLiveCapital(amount: number) {
    this.capital           = amount;
    this.initialCapital    = amount;  // P&L = capital - initialCapital = 0 at start
    this.dailyStartCapital = amount;
    this.hasLiveCapital    = true;
  }

  /** Refresh current balance from Binance without resetting P&L baseline */
  refreshLiveBalance(amount: number) {
    if (!this.hasLiveCapital) return;
    this.capital = amount;
    // initialCapital stays fixed so P&L = capital - initialCapital accumulates correctly
  }

  getRobotInitialCapital(robotId: string) { return this.robotInitialCapitals.get(robotId) || 0; }

  initRobot(robotId: string) {
    const share = this.capital * RISK_CONFIG.robotCapitalShare;
    this.robotCapitals.set(robotId, share);
    this.robotInitialCapitals.set(robotId, share);
  }

  checkDailyReset() {
    const now = new Date();
    const last = new Date(this.lastReset);
    if (now.getUTCDate() !== last.getUTCDate()) {
      this.dailyStartCapital = this.capital;
      this.lastReset = Date.now();
      this.emit('daily_reset', { capital: this.capital });
    }
  }

  canOpenTrade(robotId: string, size?: number): RiskCheck {
    const effectiveSize = size ?? RISK_CONFIG.tradeSize;
    if (this.killSwitchActive) return { allowed: false, reason: 'Kill switch ativo' };
    this.checkDailyReset();
    if (this.activeTrades.size >= RISK_CONFIG.maxTrades) return { allowed: false, reason: `Limite de ${RISK_CONFIG.maxTrades} trades simultâneos atingido` };
    const drawdown = ((this.dailyStartCapital - this.capital) / this.dailyStartCapital) * 100;
    if (drawdown >= RISK_CONFIG.killSwitchDrawdown) {
      this.killSwitchActive = true;
      this.emit('kill_switch', { drawdown, capital: this.capital });
      return { allowed: false, reason: `Kill switch acionado: DD ${drawdown.toFixed(2)}%` };
    }
    if (drawdown >= RISK_CONFIG.dailyDrawdownLimit) return { allowed: false, reason: `Limite de drawdown diário ${RISK_CONFIG.dailyDrawdownLimit}% atingido` };
    // In live/testnet mode: use total system capital (robot-level tracking irrelevant)
    if (this.hasLiveCapital) {
      if (this.capital < effectiveSize) return { allowed: false, reason: `Capital insuficiente (disponível: $${this.capital.toFixed(2)}, necessário: $${effectiveSize.toFixed(2)})` };
      return { allowed: true };
    }
    const robotCapital = this.robotCapitals.get(robotId) || 0;
    const robotInitial = this.robotInitialCapitals.get(robotId) || 0;
    const robotDD = robotInitial > 0 ? ((robotInitial - robotCapital) / robotInitial) * 100 : 0;
    if (robotDD >= RISK_CONFIG.robotDrawdownLimit) return { allowed: false, reason: `Limite de DD do robô ${RISK_CONFIG.robotDrawdownLimit}% atingido` };
    const effectiveCapital = robotCapital > 0 ? robotCapital : this.capital;
    if (effectiveCapital < effectiveSize) return { allowed: false, reason: `Capital insuficiente (disponível: $${effectiveCapital.toFixed(2)}, necessário: $${effectiveSize.toFixed(2)})` };
    return { allowed: true };
  }

  registerTrade(trade: Trade) {
    this.activeTrades.set(trade.id, trade);
    // In live/testnet mode: capital is tracked globally, not per-robot
    if (!this.hasLiveCapital) {
      const robotCapital = this.robotCapitals.get(trade.robotId) || 0;
      this.robotCapitals.set(trade.robotId, robotCapital - trade.size);
    }
  }

  closeTrade(tradeId: string, pnl: number) {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) return;
    this.activeTrades.delete(tradeId);
    this.capital += pnl;
    if (this.hasLiveCapital) {
      this.emit('capital_update', { capital: this.capital, pnl, tradeId });
      return;
    }
    const robotCapital = this.robotCapitals.get(trade.robotId) || 0;
    this.robotCapitals.set(trade.robotId, robotCapital + trade.size + pnl);
    this.emit('capital_update', { capital: this.capital, pnl, tradeId });
  }

  getCapital() { return this.capital; }
  getRobotCapital(robotId: string) { return this.robotCapitals.get(robotId) || 0; }
  getDrawdown() {
    const base = this.dailyStartCapital;
    return base > 0 ? Math.max(0, ((base - this.capital) / base) * 100) : 0;
  }
  isKillSwitchActive() { return this.killSwitchActive; }
  getActiveTradeCount() { return this.activeTrades.size; }

  getInitialCapital(): number { return this.initialCapital; }

  /** P&L total = capital atual − capital inicial da sessão */
  getTotalPnl(): number {
    return this.capital - this.initialCapital;
  }

  resetKillSwitch() {
    this.killSwitchActive = false;
    this.dailyStartCapital = this.capital;
    this.emit('kill_switch_reset', {});
  }

  resetSession() {
    this.capital            = 0;
    this.initialCapital     = 0;
    this.dailyStartCapital  = 0;
    this.killSwitchActive   = false;
    this.hasLiveCapital     = false;
    this.lastReset          = Date.now();
    this.robotCapitals.clear();
    this.robotInitialCapitals.clear();
    this.activeTrades.clear();
    this.emit('session_reset', {});
  }
}
