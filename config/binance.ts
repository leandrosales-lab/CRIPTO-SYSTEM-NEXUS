import dotenv from 'dotenv';
dotenv.config();

export const SIMULATION_MODE = process.env.SIMULATION_MODE === 'true';
export const PAPER_TRADING  = process.env.PAPER_TRADING !== 'false'; // padrão: true (paper trading)

export const REAL_REST_URL    = 'https://fapi.binance.com';
export const TESTNET_REST_URL = 'https://testnet.binancefuture.com';
export const REAL_WS_URL      = 'wss://fstream.binance.com/ws';
export const TESTNET_WS_URL   = 'wss://stream.binancefuture.com/ws';

export const BINANCE_CONFIG = {
  apiKey: process.env.BINANCE_API_KEY || '',
  apiSecret: process.env.BINANCE_API_SECRET || '',
  testnet: process.env.BINANCE_TESTNET === 'true',
  baseUrl: process.env.BINANCE_TESTNET === 'true'
    ? 'https://testnet.binancefuture.com'
    : 'https://fapi.binance.com',
  wsBaseUrl: process.env.BINANCE_TESTNET === 'true'
    ? 'wss://stream.binancefuture.com/ws'
    : 'wss://fstream.binance.com/ws',
  recvWindow: 5000,
};

export const RISK_CONFIG = {
  initialCapital:      parseFloat(process.env.INITIAL_CAPITAL   || '100'),
  tradeSize:           parseFloat(process.env.TRADE_SIZE         || '5'),
  maxTrades:           parseInt  (process.env.MAX_TRADES         || '20'),
  dailyDrawdownLimit:  parseFloat(process.env.DAILY_DD_LIMIT     || '10'),
  killSwitchDrawdown:  parseFloat(process.env.KILL_SWITCH_DD     || '15'),
  leverage:            5,
  robotCapitalShare:   1 / 3,
  robotDrawdownLimit:  5,
  trailingStop:        true,
  trailingActivationPct: 0.08,
  trailingDistancePct:   0.06,
};

export const SERVER_CONFIG = {
  port: parseInt(process.env.PORT || '3001'),
};
