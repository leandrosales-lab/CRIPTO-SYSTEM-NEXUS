import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { BinanceClient } from './BinanceClient';
import { RiskManager } from './RiskManager';
import { Trade, TradeDirection } from '../types';
import { RISK_CONFIG, PAPER_TRADING, SIMULATION_MODE } from '../config/binance';

export interface OpenTradeOptions {
  trailingStop?: boolean;
  trailingActivationPct?: number;
  trailingDistancePct?: number;
}

interface TpSlPerSymbol {
  tpPct: number;
  slPct: number;
}

function getTpSl(symbol: string, direction: TradeDirection): TpSlPerSymbol {
  const pcts: Record<string, { tp: number; sl: number }> = {
    BTCUSDT: { tp: 0.0015, sl: 0.0010 },
    ETHUSDT: { tp: 0.0025, sl: 0.0015 },
    SOLUSDT: { tp: 0.0020, sl: 0.0012 },
  };
  const p = pcts[symbol] ?? { tp: 0.0020, sl: 0.0012 };
  return direction === 'LONG'
    ? { tpPct: 1 + p.tp, slPct: 1 - p.sl }
    : { tpPct: 1 - p.tp, slPct: 1 + p.sl };
}

export class OrderExecutor extends EventEmitter {
  private binance: BinanceClient;
  private riskManager: RiskManager;
  private openTrades: Map<string, Trade> = new Map();

  constructor(binance: BinanceClient, riskManager: RiskManager) {
    super();
    this.binance      = binance;
    this.riskManager  = riskManager;
  }

  async openTrade(
    robotId: string,
    symbol: string,
    direction: TradeDirection,
    currentPrice: number,
    opts: OpenTradeOptions = {},
    customSize?: number,
    customLeverage?: number,
  ): Promise<Trade | null> {
    const size     = customSize ?? RISK_CONFIG.tradeSize;
    const check    = this.riskManager.canOpenTrade(robotId, size);
    if (!check.allowed) {
      this.emit('trade_rejected', { robotId, symbol, reason: check.reason });
      return null;
    }

    // Leverage: custom > robot default (2x for all bots) > config
    const ROBOT_FIXED_LEVERAGE = 2;
    const leverage  = customLeverage ?? ROBOT_FIXED_LEVERAGE;
    const notional  = size * leverage;
    const qty       = notional / currentPrice;

    // Valida notional mínimo do par (Binance rejeita ordens abaixo do mínimo)
    const minNotional = this.binance.getMinNotional(symbol);
    if (notional < minNotional) {
      this.emit('trade_rejected', { robotId, symbol, reason: `Notional $${notional.toFixed(2)} abaixo do mínimo $${minNotional} para ${symbol}` });
      console.warn(`[OrderExecutor] Rejeitado: notional $${notional.toFixed(2)} < mínimo $${minNotional} (${symbol})`);
      return null;
    }

    // Valida quantidade mínima
    const adjQty  = this.binance.adjustQuantity(symbol, qty);
    const minQty  = this.binance.getMinQty(symbol);
    if (adjQty < minQty) {
      this.emit('trade_rejected', { robotId, symbol, reason: `Quantidade ${adjQty} abaixo do mínimo ${minQty} para ${symbol}` });
      console.warn(`[OrderExecutor] Rejeitado: qty ${adjQty} < mínimo ${minQty} (${symbol})`);
      return null;
    }

    const { tpPct, slPct } = getTpSl(symbol, direction);
    const tpPrice   = currentPrice * tpPct;
    const slPrice   = currentPrice * slPct;

    const useTrailing         = opts.trailingStop        ?? RISK_CONFIG.trailingStop;
    const trailingActivation  = opts.trailingActivationPct ?? RISK_CONFIG.trailingActivationPct;
    const trailingDistance    = opts.trailingDistancePct   ?? RISK_CONFIG.trailingDistancePct;

    const trade: Trade = {
      id:           uuidv4(),
      robotId,
      symbol,
      direction,
      status:       'open',
      entryPrice:   currentPrice,
      size,
      leverage,
      notional,
      tpPrice,
      slPrice,
      openTime:     Date.now(),
      trailingStop:           useTrailing,
      trailingActivationPct:  trailingActivation,
      trailingDistancePct:    trailingDistance,
      trailingActive:         false,
      trailingStopPrice:      0,
      bestPrice:              currentPrice,
    };

    try {
      const side         = direction === 'LONG' ? 'BUY'  : 'SELL';
      const closeSide    = direction === 'LONG' ? 'SELL' : 'BUY';
      const positionSide = direction;
      if (!PAPER_TRADING && !SIMULATION_MODE) {
        await this.binance.setLeverage(symbol, leverage);
        const order = await this.binance.placeMarketOrder(symbol, side, parseFloat(qty.toFixed(3)), positionSide);
        trade.orderId = order?.orderId?.toString();
        const [tpOrder, slOrder] = await Promise.all([
          this.binance.placeTPSLOrder(symbol, closeSide, positionSide, tpPrice, qty, 'TAKE_PROFIT_MARKET'),
          this.binance.placeTPSLOrder(symbol, closeSide, positionSide, slPrice, qty, 'STOP_MARKET'),
        ]);
        trade.tpOrderId = tpOrder?.orderId?.toString();
        trade.slOrderId = slOrder?.orderId?.toString();
      } else {
        trade.orderId = `PAPER-${uuidv4().slice(0, 8)}`;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[OrderExecutor] Order error:', msg);
      trade.status = 'cancelled';
      this.emit('trade_error', { tradeId: trade.id, error: msg });
      return null;
    }

    this.openTrades.set(trade.id, trade);
    this.riskManager.registerTrade(trade);
    this.emit('trade_open', trade);
    return trade;
  }

  closeTrade(tradeId: string, exitPrice: number, reason: 'tp' | 'sl' | 'trailing' | 'manual' = 'manual'): Trade | null {
    const trade = this.openTrades.get(tradeId);
    if (!trade) return null;
    if (trade.status !== 'open') {
      console.warn(`[OrderExecutor] closeTrade ignorado: trade ${tradeId} já está ${trade.status}`);
      return null;
    }

    const priceDiff = trade.direction === 'LONG'
      ? exitPrice - trade.entryPrice
      : trade.entryPrice - exitPrice;

    // Binance USDT-M Futures taker fee: 0.04% por lado
    // Total: abertura (0.04%) + fechamento (0.04%) = 0.08% sobre notional
    const TAKER_FEE = 0.0004;
    const fee       = trade.notional * TAKER_FEE * 2;
    const pnlGross  = trade.notional * (priceDiff / trade.entryPrice);
    const pnl       = pnlGross - fee;

    // pnlPercent = retorno líquido sobre o capital investido (size = margem)
    const pnlPercent = (pnl / trade.size) * 100;

    trade.exitPrice  = exitPrice;
    trade.closeTime  = Date.now();
    trade.pnlGross   = pnlGross;
    trade.fee        = fee;
    trade.pnl        = pnl;
    trade.pnlPercent = pnlPercent;
    trade.status     = 'closed';

    this.openTrades.delete(tradeId);
    this.riskManager.closeTrade(tradeId, pnl);
    this.emit('trade_close', { ...trade, reason });
    return trade;
  }

  checkTPSL(symbol: string, currentPrice: number): void {
    for (const [id, trade] of this.openTrades.entries()) {
      if (trade.symbol !== symbol) continue;

      /* ── Fixed TP / SL first — Binance handles natively in live mode ── */
      if (!this.binance.isLive()) {
        if (trade.direction === 'LONG') {
          if (currentPrice >= trade.tpPrice)                             { this.closeTrade(id, currentPrice, 'tp');  continue; }
          if (currentPrice <= trade.slPrice && !trade.trailingActive)    { this.closeTrade(id, currentPrice, 'sl');  continue; }
        } else {
          if (currentPrice <= trade.tpPrice)                             { this.closeTrade(id, currentPrice, 'tp');  continue; }
          if (currentPrice >= trade.slPrice && !trade.trailingActive)    { this.closeTrade(id, currentPrice, 'sl');  continue; }
        }
      }

      /* ── Trailing stop (runs in all modes — local management) ────── */
      if (trade.trailingStop) {
        const isLong = trade.direction === 'LONG';

        const profitPct = isLong
          ? (currentPrice - trade.entryPrice) / trade.entryPrice
          : (trade.entryPrice - currentPrice) / trade.entryPrice;

        if (!trade.trailingActive && profitPct >= trade.trailingActivationPct / 100) {
          trade.trailingActive    = true;
          trade.bestPrice         = currentPrice;
          trade.trailingStopPrice = isLong
            ? currentPrice * (1 - trade.trailingDistancePct / 100)
            : currentPrice * (1 + trade.trailingDistancePct / 100);
          this.emit('trailing_activated', {
            tradeId: id,
            symbol,
            direction: trade.direction,
            activationPrice: currentPrice,
            trailingStopPrice: trade.trailingStopPrice,
          });
        } else if (trade.trailingActive) {
          if (isLong && currentPrice > trade.bestPrice) {
            trade.bestPrice         = currentPrice;
            trade.trailingStopPrice = currentPrice * (1 - trade.trailingDistancePct / 100);
            this.emit('trailing_updated', { tradeId: id, symbol, bestPrice: trade.bestPrice, trailingStopPrice: trade.trailingStopPrice });
          } else if (!isLong && currentPrice < trade.bestPrice) {
            trade.bestPrice         = currentPrice;
            trade.trailingStopPrice = currentPrice * (1 + trade.trailingDistancePct / 100);
            this.emit('trailing_updated', { tradeId: id, symbol, bestPrice: trade.bestPrice, trailingStopPrice: trade.trailingStopPrice });
          }

          if (isLong && currentPrice <= trade.trailingStopPrice) {
            this.closeTrade(id, currentPrice, 'trailing');
            continue;
          }
          if (!isLong && currentPrice >= trade.trailingStopPrice) {
            this.closeTrade(id, currentPrice, 'trailing');
            continue;
          }
        }
      }
    }
  }

  getOpenTrades(): Trade[]                        { return Array.from(this.openTrades.values()); }
  getOpenTradesByRobot(robotId: string): Trade[]  { return this.getOpenTrades().filter(t => t.robotId === robotId); }
  isKillSwitchActive(): boolean                   { return this.riskManager.isKillSwitchActive(); }

  clearOpenTrades() {
    this.openTrades.clear();
  }

  /**
   * Injeta uma trade já aberta na corretora (reconciliação de startup).
   * NÃO registra no RiskManager — o capital já está comprometido na Binance.
   */
  forceInjectTrade(trade: Trade): void {
    if (this.openTrades.has(trade.id)) return;
    this.openTrades.set(trade.id, trade);
    this.emit('trade_open', trade);
    console.log(`[OrderExecutor] Injetada: ${trade.direction} ${trade.symbol} @ $${trade.entryPrice}`);
  }

  /** Busca trade aberta por símbolo + direção (para evitar duplicatas na reconciliação) */
  getOpenTradeBySymbolDirection(symbol: string, direction: string): Trade | undefined {
    return Array.from(this.openTrades.values()).find(
      t => t.symbol === symbol && t.direction === direction
    );
  }
}
