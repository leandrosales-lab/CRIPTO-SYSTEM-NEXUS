import { create } from 'zustand';

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

export interface Trade {
  id: string;
  robotId: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  status: 'open' | 'closed' | 'cancelled';
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
  trailingStop: boolean;
  trailingActive: boolean;
  trailingStopPrice: number;
  bestPrice: number;
  reason?: string;
}

export interface RobotState {
  id: string;
  name: string;
  symbol: string;
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'error';
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
  price: number;
  change24h: number;
  volume24h: number;
  bid: number;
  ask: number;
  timestamp: number;
}

export interface EquityPoint {
  time: number;
  value: number;
}

interface Store {
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
  alerts: { id: string; level: string; message: string; time: number }[];
  uptime: number;
  startTime: number;
  apiKeySet: boolean;
  showApiModal: boolean;
  radarSignals: RadarSignal[];
  radarScanCount: number;
  radarLastScan: number;
  executedRadarSymbols: Set<string>;
  mode: 'paper' | 'testnet' | 'live';
  accountBalance: {
    totalWalletBalance: string;
    availableBalance: string;
    totalUnrealizedProfit: string;
    totalMarginBalance: string;
  } | null;

  setConnected: (v: boolean) => void;
  setSystemState: (s: Partial<Store>) => void;
  updateRobot: (robot: RobotState) => void;
  addTrade: (trade: Trade) => void;
  closeTrade: (trade: Trade) => void;
  updateMarketTick: (symbol: string, price: number) => void;
  updateEquity: (capital: number, newPoints?: EquityPoint[]) => void;
  addAlert: (alert: { level: string; message: string }) => void;
  dismissAlert: (id: string) => void;
  updateTrailing: (data: { tradeId: string; trailingStopPrice: number; bestPrice?: number; trailingActive?: boolean }) => void;
  setShowApiModal: (v: boolean) => void;
  setApiKeySet: (v: boolean) => void;
  updateRadar: (data: { signals: RadarSignal[]; scanCount: number; scannedAt: number }) => void;
  removeRadarSignal: (symbol: string) => void;
  setMode: (mode: 'paper' | 'testnet' | 'live') => void;
  setAccountBalance: (bal: Store['accountBalance']) => void;
}

export const useStore = create<Store>((set) => ({
  connected: false,
  capital: 0,
  totalPnl: 0,
  todayPnl: 0,
  drawdown: 0,
  killSwitchActive: false,
  robots: [],
  activeTrades: [],
  tradeHistory: [],
  equityCurve: [],
  marketTicks: {
    BTCUSDT: { price: 0, change24h: 0, volume24h: 0, bid: 0, ask: 0, timestamp: 0 },
    ETHUSDT: { price: 0, change24h: 0, volume24h: 0, bid: 0, ask: 0, timestamp: 0 },
    SOLUSDT: { price: 0, change24h: 0, volume24h: 0, bid: 0, ask: 0, timestamp: 0 },
  },
  alerts: [],
  uptime: 0,
  startTime: Date.now(),
  apiKeySet: false,
  showApiModal: false,
  radarSignals: [],
  radarScanCount: 0,
  radarLastScan: 0,
  executedRadarSymbols: new Set(),
  mode: 'paper',
  accountBalance: null,

  setConnected: (v) => set({ connected: v }),

  setSystemState: (s) => set((prev) => ({
    ...prev,
    ...s,
    robots: s.robots || prev.robots,
    activeTrades: s.activeTrades || prev.activeTrades,
    tradeHistory: s.tradeHistory ? s.tradeHistory.slice(0, 200) : prev.tradeHistory,
    equityCurve: s.equityCurve || prev.equityCurve,
    marketTicks: s.marketTicks ? { ...prev.marketTicks, ...s.marketTicks } : prev.marketTicks,
  })),

  updateRobot: (robot) => set((prev) => ({
    robots: prev.robots.some(r => r.id === robot.id)
      ? prev.robots.map(r => r.id === robot.id ? robot : r)
      : [...prev.robots, robot],
  })),

  addTrade: (trade) => set((prev) => ({
    activeTrades: [...prev.activeTrades.filter(t => t.id !== trade.id), trade],
  })),

  closeTrade: (trade) => set((prev) => ({
    activeTrades: prev.activeTrades.filter(t => t.id !== trade.id),
    tradeHistory: prev.tradeHistory.some(t => t.id === trade.id)
      ? prev.tradeHistory
      : [trade, ...prev.tradeHistory].slice(0, 200),
  })),

  updateMarketTick: (symbol, price) => set((prev) => ({
    marketTicks: {
      ...prev.marketTicks,
      [symbol]: { ...(prev.marketTicks[symbol] || { change24h: 0, volume24h: 0, bid: 0, ask: 0 }), price, timestamp: Date.now() },
    },
  })),

  updateEquity: (capital, newPoints) => set((prev) => ({
    capital,
    totalPnl: prev.totalPnl,
    equityCurve: newPoints
      ? [...prev.equityCurve, ...newPoints].slice(-500)
      : [...prev.equityCurve, { time: Date.now(), value: capital }].slice(-500),
  })),

  addAlert: (alert) => set((prev) => ({
    alerts: [{ ...alert, id: Math.random().toString(36).slice(2), time: Date.now() }, ...prev.alerts].slice(0, 10),
  })),

  dismissAlert: (id) => set((prev) => ({ alerts: prev.alerts.filter(a => a.id !== id) })),

  updateTrailing: (data) => set((prev) => ({
    activeTrades: prev.activeTrades.map(t =>
      t.id === data.tradeId
        ? { ...t, trailingStopPrice: data.trailingStopPrice, bestPrice: data.bestPrice ?? t.bestPrice, trailingActive: data.trailingActive ?? true }
        : t
    ),
  })),

  setShowApiModal: (v) => set({ showApiModal: v }),
  setApiKeySet: (v) => set({ apiKeySet: v }),

  setMode: (mode) => set({ mode }),
  setAccountBalance: (bal) => set({ accountBalance: bal }),

  updateRadar: (data) => set((prev) => ({
    radarSignals: data.signals.filter(s => !prev.executedRadarSymbols.has(s.symbol)),
    radarScanCount: data.scanCount,
    radarLastScan: data.scannedAt,
    // executedRadarSymbols mantido entre scans — só limpo via removeRadarSignal
  })),

  removeRadarSignal: (symbol) => set((prev) => ({
    radarSignals: prev.radarSignals.filter(s => s.symbol !== symbol),
    executedRadarSymbols: new Set([...prev.executedRadarSymbols, symbol]),
  })),
}));
