export type RobotStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'error';
export type TradeDirection = 'LONG' | 'SHORT';
export type TradeStatus = 'open' | 'closed' | 'cancelled';
export type OrderSide = 'BUY' | 'SELL';
export type PositionSide = 'LONG' | 'SHORT' | 'BOTH';

export interface Trade {
  id: string;
  robotId: string;
  symbol: string;
  direction: TradeDirection;
  status: TradeStatus;
  entryPrice: number;
  exitPrice?: number;
  size: number;
  leverage: number;
  notional: number;
  tpPrice: number;
  slPrice: number;
  openTime: number;
  closeTime?: number;
  pnl?: number;
  pnlPercent?: number;
  pnlGross?: number;
  fee?: number;
  orderId?: string;
  tpOrderId?: string;
  slOrderId?: string;
  trailingStop: boolean;
  trailingActivationPct: number;
  trailingDistancePct: number;
  trailingActive: boolean;
  trailingStopPrice: number;
  bestPrice: number;
}

export interface RobotState {
  id: string;
  name: string;
  symbol: string;
  status: RobotStatus;
  strategy: string;
  totalPnl: number;
  todayPnl: number;
  winCount: number;
  lossCount: number;
  activeTrades: Trade[];
  lastSignal?: string;
  lastSignalTime?: number;
  signalHistory?: Array<{ signal: string; time: number }>;
  drawdown: number;
  capital: number;
}

export interface MarketTick {
  symbol?: string;
  price: number;
  volume24h: number;
  change24h: number;
  bid: number;
  ask: number;
  timestamp: number;
}

export interface EquityPoint {
  time: number;
  value: number;
}

export interface SystemState {
  connected: boolean;
  capital: number;
  totalPnl: number;
  todayPnl: number;
  drawdown: number;
  killSwitchActive: boolean;
  robots: RobotState[];
  activeTrades: Trade[];
  tradeHistory: Trade[];
  equityCurve: EquityPoint[];
  marketTicks: Record<string, MarketTick>;
  uptime: number;
  startTime: number;
  mode?: 'paper' | 'testnet' | 'live';
  accountBalance?: {
    totalWalletBalance: string;
    availableBalance: string;
    totalUnrealizedProfit: string;
    totalMarginBalance: string;
  } | null;
}

export interface WSMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}

export interface BinanceAggTrade {
  e: string;
  E: number;
  s: string;
  a: number;
  p: string;
  q: string;
  f: number;
  l: number;
  T: number;
  m: boolean;
}

export interface BinanceDepth {
  e: string;
  E: number;
  T: number;
  s: string;
  U: number;
  u: number;
  pu: number;
  b: [string, string][];
  a: [string, string][];
}

export interface BinanceKline {
  e: string;
  E: number;
  s: string;
  k: {
    t: number;
    T: number;
    s: string;
    i: string;
    f: number;
    L: number;
    o: string;
    c: string;
    h: string;
    l: string;
    v: string;
    n: number;
    x: boolean;
    q: string;
  };
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  qty: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

export interface RadarSignal {
  rank: number;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  score: number;
  strength: 'FORTE' | 'MODERADO' | 'FRACO';
  rsi: number;
  bbPosition: 'ABAIXO' | 'ACIMA' | 'MEIO';
  emaAlignment: 'ALTA' | 'BAIXA' | 'NEUTRO';
  volumeSpike: number;
  priceChange1h: number;
  currentPrice: number;
  volume24h: number;
  change24h: number;
  scannedAt: number;
  reasons: string[];
}

export interface RadarUpdate {
  signals: RadarSignal[];
  scannedAt: number;
  scanCount: number;
  totalScanned: number;
  elapsed: number;
}
