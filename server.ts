import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { BinanceClient } from './services/BinanceClient';
import { RiskManager } from './services/RiskManager';
import { OrderExecutor } from './services/OrderExecutor';
import { PhantomBot } from './robots/PhantomBot';
import { NexusBot } from './robots/NexusBot';
import { OracleBot } from './robots/OracleBot';
import { RadarBot } from './robots/RadarBot';
import { SERVER_CONFIG, RISK_CONFIG, SIMULATION_MODE, PAPER_TRADING, BINANCE_CONFIG, TESTNET_REST_URL, REAL_REST_URL } from './config/binance';
import { saveKeys, loadKeys, deleteKeys, maskKey, hasKeys } from './services/KeyManager';
import { Trade, RobotState, EquityPoint, SystemState, RadarSignal } from './types';
import {
  initDatabase,
  saveTrade,
  closeTrade as dbCloseTrade,
  saveEquityPoint,
  loadTradeHistory,
  loadEquityCurve,
  queryTrades,
  getStats,
} from './services/Database';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set<WebSocket>();

const binance = new BinanceClient();
const riskManager = new RiskManager();
const executor = new OrderExecutor(binance, riskManager);
const phantom = new PhantomBot(binance, executor);
const nexus = new NexusBot(binance, executor);
const oracle = new OracleBot(binance, executor);
const radar = new RadarBot();
const robots = [phantom, nexus, oracle];

// Current operating mode — set by user via dashboard
let currentMode: 'paper' | 'testnet' | 'live' = 'paper';
let accountBalance: { totalWalletBalance: string; availableBalance: string; totalUnrealizedProfit: string; totalMarginBalance: string } | null = null;

const tradeHistory: Trade[] = [];
const equityCurve: EquityPoint[] = [];
const robotStates: Record<string, RobotState> = {};

// Synthetic state for RadarBot (não estende BaseRobot, então rastreamos manualmente)
const radarState: RobotState = {
  id: 'radar', name: 'RADAR', symbol: 'MULTI',
  status: 'idle', strategy: 'Scanner Dinâmico 50 Ativos',
  totalPnl: 0, todayPnl: 0, winCount: 0, lossCount: 0,
  activeTrades: [], drawdown: 0, capital: 0,
};

const marketTicks: Record<string, { price: number; change24h: number; volume24h: number; bid: number; ask: number; timestamp: number }> = {
  BTCUSDT: { price: 0, change24h: 0, volume24h: 0, bid: 0, ask: 0, timestamp: 0 },
  ETHUSDT: { price: 0, change24h: 0, volume24h: 0, bid: 0, ask: 0, timestamp: 0 },
  SOLUSDT: { price: 0, change24h: 0, volume24h: 0, bid: 0, ask: 0, timestamp: 0 },
};
const startTime = Date.now();
// Track radar symbols already in trade (reset each scan)
const radarOpenSymbols = new Set<string>();

function broadcast(type: string, payload: unknown) {
  const msg = JSON.stringify({ type, payload, timestamp: Date.now() });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

function getSystemState(): SystemState {
  return {
    connected: true,
    capital: riskManager.getCapital(),
    totalPnl: riskManager.getTotalPnl(),
    todayPnl: Object.values(robotStates).reduce((a, r) => a + r.todayPnl, 0),
    drawdown: riskManager.getDrawdown(),
    killSwitchActive: riskManager.isKillSwitchActive(),
    robots: [...Object.values(robotStates), { ...radarState, activeTrades: executor.getOpenTrades().filter(t => t.robotId === 'radar') }],
    activeTrades: executor.getOpenTrades(),
    tradeHistory: tradeHistory.slice(-100),
    equityCurve: equityCurve.slice(-500),
    marketTicks,
    uptime: Date.now() - startTime,
    startTime,
    mode: currentMode,
    accountBalance,
  };
}

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'system_state', payload: getSystemState(), timestamp: Date.now() }));
  ws.on('close', () => clients.delete(ws));
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'robot_command') {
        const { robotId, command } = msg.payload;
        const bot = robots.find(r => r.getState().id === robotId);
        if (bot) {
          if (command === 'stop') bot.stop();
          else if (command === 'pause') bot.pause();
          else if (command === 'resume') bot.resume();
          broadcast('robot_state', bot.getState());
        }
      }
    } catch (_) {}
  });
});

robots.forEach(robot => {
  robot.on('state_update', (state: RobotState) => {
    robotStates[state.id] = state;
    broadcast('robot_state', state);
  });
});

executor.on('trade_open', (trade: Trade) => {
  saveTrade(trade);
  broadcast('trade_open', trade);
  broadcast('equity_update', { capital: riskManager.getCapital(), totalPnl: riskManager.getTotalPnl(), equityCurve: equityCurve.slice(-10) });
});

executor.on('trailing_activated', (data) => {
  broadcast('trailing_activated', data);
  broadcast('alert', {
    level: 'info',
    message: `TRAILING STOP activated — ${data.symbol} ${data.direction} | stop: $${Number(data.trailingStopPrice).toFixed(2)}`,
  });
});

executor.on('trailing_updated', (data) => {
  broadcast('trailing_updated', data);
});

executor.on('trade_close', (trade: Trade) => {
  dbCloseTrade(trade);
  tradeHistory.unshift(trade);
  if (tradeHistory.length > 500) tradeHistory.pop();
  const point: EquityPoint = { time: Date.now(), value: riskManager.getCapital() };
  equityCurve.push(point);
  if (equityCurve.length > 1000) equityCurve.shift();
  saveEquityPoint(point);
  const pnl = trade.pnl || 0;
  if (trade.robotId === 'radar') {
    // Update synthetic radar state
    radarState.totalPnl += pnl;
    radarState.todayPnl += pnl;
    if (pnl > 0) radarState.winCount++; else radarState.lossCount++;
    broadcast('robot_state', { ...radarState, activeTrades: executor.getOpenTrades().filter(t => t.robotId === 'radar') });
  } else {
    // Atualiza estado do robô (nexus/phantom/oracle) e transmite ao frontend
    const bot = robots.find(r => r.getState().id === trade.robotId);
    if (bot) bot.closeTrade(pnl);
  }
  broadcast('trade_close', trade);
  broadcast('equity_update', { capital: riskManager.getCapital(), totalPnl: riskManager.getTotalPnl(), equityCurve: equityCurve.slice(-50) });
});

riskManager.on('kill_switch', (data) => {
  broadcast('alert', { level: 'critical', message: `KILL SWITCH ACTIVATED — Drawdown: ${data.drawdown.toFixed(2)}%`, ...data });
});

riskManager.on('capital_update', (data) => {
  broadcast('capital_update', { capital: data.capital, totalPnl: data.capital - RISK_CONFIG.initialCapital });
});

// ─── OCO: handle Binance native TP/SL fills ───────────────────────────────────
binance.on('order_fill', (fill: { symbol: string; orderId: string; orderType: 'TAKE_PROFIT_MARKET' | 'STOP_MARKET'; avgPrice: number }) => {
  const trades = executor.getOpenTrades();
  for (const trade of trades) {
    if (trade.symbol !== fill.symbol) continue;
    if (trade.status !== 'open') continue; // idempotência: ignorar trade já fechada
    const isTP = fill.orderType === 'TAKE_PROFIT_MARKET' && trade.tpOrderId === fill.orderId;
    const isSL = fill.orderType === 'STOP_MARKET'        && trade.slOrderId === fill.orderId;
    if (isTP || isSL) {
      executor.closeTrade(trade.id, fill.avgPrice, isTP ? 'tp' : 'sl');
      const oppositeId = isTP ? trade.slOrderId : trade.tpOrderId;
      if (oppositeId) binance.cancelOrder(fill.symbol, parseInt(oppositeId)).catch(() => {});
      console.log(`[OCO] ${isTP ? 'TP' : 'SL'} preenchido — ${trade.symbol} @ $${fill.avgPrice} | oposta cancelada: ${oppositeId}`);
      break;
    }
  }
});

radar.on('radar_update', async (data: { signals: RadarSignal[]; scannedAt: number; scanCount: number }) => {
  broadcast('radar_update', data);

  // AUTO-TRADE: execute top signals automatically (FORTE only — score >= 70)
  // Check by symbol+direction to prevent duplicates (allow hedge if both sides qualify)
  const openTradeKeys = new Set(
    executor.getOpenTrades()
      .filter(t => t.robotId === 'radar')
      .map(t => `${t.symbol}-${t.direction}`)
  );
  radarOpenSymbols.clear();

  for (const signal of data.signals) {
    if (signal.strength !== 'FORTE') continue;
    if (openTradeKeys.has(`${signal.symbol}-${signal.direction}`)) continue;
    if (radarOpenSymbols.has(signal.symbol)) continue;

    const check = riskManager.canOpenTrade('radar');
    if (!check.allowed) {
      console.log(`[RADAR AUTO] Bloqueado: ${check.reason}`);
      break;
    }

    // Get live price
    let price = marketTicks[signal.symbol]?.price;
    if (!price || price <= 0) {
      try {
        const axios = (await import('axios')).default;
        const r = await axios.get(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${signal.symbol}`, { timeout: 3000 });
        price = parseFloat(r.data.price);
        marketTicks[signal.symbol] = { price, change24h: 0, volume24h: 0, bid: 0, ask: 0, timestamp: Date.now() };
      } catch {
        console.log(`[RADAR AUTO] Preço indisponível para ${signal.symbol}`);
        continue;
      }
    }

    try {
      const trade = await executor.openTrade('radar', signal.symbol, signal.direction, price, {}, undefined, 2);
      if (trade) {
        radarOpenSymbols.add(signal.symbol);
        binance.subscribeAggTrade(signal.symbol);
        const d = price > 100 ? 2 : price > 1 ? 4 : 6;
        broadcast('alert', {
          level: 'info',
          message: `RADAR AUTO — ${signal.direction} ${signal.symbol.replace('USDT', '')} @ $${price.toFixed(d)} | Score: ${signal.score} (${signal.strength})`,
        });
        console.log(`[RADAR AUTO] Trade aberto: ${signal.direction} ${signal.symbol} @ ${price}`);
      }
    } catch (e) {
      console.error(`[RADAR AUTO] Erro ao abrir trade ${signal.symbol}:`, e);
    }
  }
});

binance.on('tick', ({ symbol, price }: { symbol: string; price: number }) => {
  if (marketTicks[symbol]) {
    marketTicks[symbol].price = price;
    marketTicks[symbol].timestamp = Date.now();
  } else {
    marketTicks[symbol] = { price, change24h: 0, volume24h: 0, bid: 0, ask: 0, timestamp: Date.now() };
  }
  // Global TP/SL check — works for ALL symbols including dynamic and radar trades
  executor.checkTPSL(symbol, price);
  broadcast('market_tick', { symbol, price, timestamp: Date.now() });
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', uptime: Date.now() - startTime }));
app.get('/api/state', (_req, res) => res.json(getSystemState()));
app.post('/api/robot/:id/command', (req, res) => {
  const { id } = req.params;
  const { command } = req.body;
  const bot = robots.find(r => r.getState().id === id);
  if (!bot) return res.status(404).json({ error: 'Robot not found' });
  if (command === 'stop') bot.stop();
  else if (command === 'pause') bot.pause();
  else if (command === 'resume') bot.resume();
  return res.json({ success: true, state: bot.getState() });
});

app.post('/api/robot/:id/start', async (req, res) => {
  const { id } = req.params;
  const { capital } = req.body as { capital?: number };
  const bot = robots.find(r => r.getState().id === id);
  if (!bot) return res.status(404).json({ error: 'Robot not found' });

  const allocatedCapital = (typeof capital === 'number' && capital > 0) ? capital : RISK_CONFIG.initialCapital * RISK_CONFIG.robotCapitalShare;
  riskManager.setRobotCapital(id, allocatedCapital);
  bot.setCapital(allocatedCapital); // sincroniza capital no estado do robô antes de emitir

  try {
    await bot.start();
    broadcast('robot_state', bot.getState());
    broadcast('alert', { level: 'info', message: `${bot.getState().name} iniciado — Capital: $${allocatedCapital.toFixed(2)}` });
    return res.json({ success: true, state: bot.getState(), capital: allocatedCapital });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

app.post('/api/trade/:tradeId/close', async (req, res) => {
  const { tradeId } = req.params;
  const openTrades = executor.getOpenTrades();
  const trade = openTrades.find(t => t.id === tradeId);
  if (!trade) return res.status(404).json({ error: 'Trade não encontrado ou já fechado' });

  // Get current price
  let price = marketTicks[trade.symbol]?.price;
  if (!price || price <= 0) {
    try {
      const axios = (await import('axios')).default;
      const r = await axios.get(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${trade.symbol}`, { timeout: 3000 });
      price = parseFloat(r.data.price);
    } catch {
      return res.status(503).json({ error: 'Preço ao vivo indisponível' });
    }
  }

  try {
    // In live/testnet: cancel TP/SL orders on Binance, then place MARKET close
    if (currentMode !== 'paper') {
      if (trade.tpOrderId) await binance.cancelOrder(trade.symbol, parseInt(trade.tpOrderId)).catch(() => {});
      if (trade.slOrderId) await binance.cancelOrder(trade.symbol, parseInt(trade.slOrderId)).catch(() => {});
      const closeSide = trade.direction === 'LONG' ? 'SELL' : 'BUY';
      await binance.placeMarketOrder(trade.symbol, closeSide, parseFloat((trade.notional / price).toFixed(3)), trade.direction)
        .catch((e: Error) => console.error('[manual close] MARKET order error:', e.message));
    }

    const closed = executor.closeTrade(tradeId, price, 'manual');
    if (!closed) return res.status(404).json({ error: 'Falha ao fechar trade' });
    broadcast('alert', {
      level: 'info',
      message: `ENCERRADO MANUALMENTE — ${trade.symbol} @ $${price.toFixed(2)} | P&L: ${(closed.pnl ?? 0) >= 0 ? '+' : ''}$${(closed.pnl ?? 0).toFixed(4)}`,
    });
    return res.json({ success: true, trade: closed });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});
app.post('/api/reconcile', async (_req, res) => {
  if (currentMode === 'paper') return res.status(400).json({ error: 'Reconciliação disponível apenas em modo live/testnet' });
  try {
    await reconcileLivePositions();
    const reconciled = executor.getOpenTrades().filter(t => t.robotId === 'reconciled');
    return res.json({ success: true, reconciled: reconciled.length, trades: reconciled });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

app.post('/api/kill-switch/reset', (_req, res) => {
  riskManager.resetKillSwitch();
  broadcast('alert', { level: 'info', message: 'Kill switch reset — System resuming' });
  res.json({ success: true });
});

app.get('/api/trades', (req, res) => {
  const { robotId, symbol, from, to, limit, offset } = req.query;
  const result = queryTrades({
    robotId: robotId as string | undefined,
    symbol:  symbol  as string | undefined,
    from:    from    ? Number(from)   : undefined,
    to:      to      ? Number(to)     : undefined,
    limit:   limit   ? Number(limit)  : 100,
    offset:  offset  ? Number(offset) : 0,
  });
  res.json(result);
});

app.get('/api/trades/stats', (req, res) => {
  const { robotId } = req.query;
  res.json(getStats(robotId as string | undefined));
});

app.get('/api/radar', (_req, res) => {
  res.json({ signals: radar.getLastSignals(), scanCount: radar.getScanCount() });
});

app.post('/api/radar/start', async (_req, res) => {
  try {
    await radar.start();
    radarState.status = 'running';
    broadcast('robot_state', { ...radarState, activeTrades: executor.getOpenTrades().filter(t => t.robotId === 'radar') });
    res.json({ success: true, status: 'running' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/radar/stop', (_req, res) => {
  radar.stop();
  radarState.status = 'stopped';
  broadcast('robot_state', { ...radarState, activeTrades: [] });
  res.json({ success: true, status: 'stopped' });
});

app.post('/api/radar/scan', async (_req, res) => {
  try {
    const signals = await radar.forceScan();
    res.json({ success: true, signals });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/equity', (_req, res) => {
  res.json(loadEquityCurve(1000));
});

// ─── CONFIG: API Keys ─────────────────────────────────────────────────────────

app.get('/api/config/status', (_req, res) => {
  const keys = loadKeys();
  const paperMode = !keys?.liveMode || !keys?.apiKey;
  res.json({
    hasKeys:     hasKeys(),
    liveMode:    keys?.liveMode ?? false,
    testnet:     keys?.testnet  ?? false,
    paperMode,
    maskedKey:   keys?.apiKey   ? maskKey(keys.apiKey) : null,
    mode:        !hasKeys()       ? 'paper'
               : keys?.testnet   ? 'testnet'
               : keys?.liveMode  ? 'live'
               : 'paper',
  });
});

app.post('/api/config/keys', async (req, res) => {
  const { apiKey, apiSecret, testnet = false, liveMode = false } = req.body as {
    apiKey: string; apiSecret: string; testnet?: boolean; liveMode?: boolean;
  };

  if (!apiKey || apiKey.trim().length < 20)    return res.status(400).json({ error: 'API Key inválida (mínimo 20 caracteres)' });
  if (!apiSecret || apiSecret.trim().length < 20) return res.status(400).json({ error: 'API Secret inválida (mínimo 20 caracteres)' });

  const baseUrl = testnet ? TESTNET_REST_URL : REAL_REST_URL;
  binance.updateCredentials(apiKey.trim(), apiSecret.trim(), baseUrl);

  const test = await binance.testCredentials();
  if (!test.ok) {
    return res.status(401).json({ error: `Credenciais rejeitadas pela Binance: ${test.error}` });
  }

  saveKeys(apiKey.trim(), apiSecret.trim(), testnet, liveMode);
  BINANCE_CONFIG.apiKey    = apiKey.trim();
  BINANCE_CONFIG.apiSecret = apiSecret.trim();

  // Update runtime mode
  currentMode = testnet ? 'testnet' : liveMode ? 'live' : 'paper';
  binance.setRuntimeMode(currentMode);
  // Recarrega exchange info com as novas credenciais (garante filters atualizados)
  binance.loadExchangeInfo().catch(() => {});
  if (currentMode !== 'paper') {
    binance.startUserDataStream().catch(() => {});
    // Reconcilia posições abertas após troca de chaves/modo
    setTimeout(() => reconcileLivePositions().catch(() => {}), 1500);
  } else {
    binance.stopUserDataStream();
  }
  if (test.info) {
    accountBalance = test.info as typeof accountBalance;
    const liveBal = (test.info as Record<string, number>).availableBalance ?? 0;
    if (liveBal > 0) riskManager.setLiveCapital(liveBal);
  }

  // Reset session data when switching to real mode — clear paper history
  tradeHistory.length = 0;
  equityCurve.length  = 0;
  equityCurve.push({ time: Date.now(), value: 0 });
  riskManager.resetSession();
  executor.clearOpenTrades();

  const mode = testnet ? 'testnet' : liveMode ? 'LIVE (conta real)' : 'paper';
  broadcast('alert', { level: 'info', message: `API Binance configurada — Modo: ${mode}. Sessão reiniciada.` });
  broadcast('session_reset', { mode: currentMode, accountBalance });
  broadcast('system_state', getSystemState());

  return res.json({
    success: true,
    mode,
    testnet,
    liveMode,
    maskedKey: maskKey(apiKey),
    account:   test.info,
  });
});

app.post('/api/config/keys/delete', (_req, res) => {
  deleteKeys();
  BINANCE_CONFIG.apiKey    = '';
  BINANCE_CONFIG.apiSecret = '';
  currentMode = 'paper';
  accountBalance = null;
  broadcast('config_update', { hasKeys: false, liveMode: false, testnet: false, mode: 'paper', accountBalance: null });
  broadcast('system_state', getSystemState());
  return res.json({ success: true });
});

// ─── Account Balance (fetch fresh from Binance) ────────────────────────────
app.get('/api/account/balance', async (_req, res) => {
  if (!hasKeys()) return res.json({ mode: 'paper', accountBalance: null });
  const result = await binance.testCredentials();
  if (result.ok && result.info) {
    accountBalance = result.info as typeof accountBalance;
    broadcast('account_balance', { accountBalance, mode: currentMode });
  }
  return res.json({ mode: currentMode, accountBalance: result.info ?? null, ok: result.ok, error: result.error });
});

// ─── Raw Binance account debug ────────────────────────────────────────────
app.get('/api/account/raw', async (_req, res) => {
  if (!hasKeys()) return res.status(400).json({ error: 'Sem chaves configuradas' });
  try {
    const axiosLib = (await import('axios')).default;
    const crypto2 = await import('crypto');
    const { loadKeys: lk } = await import('./services/KeyManager');
    const keys = lk();
    if (!keys) return res.status(400).json({ error: 'Sem chaves' });
    const ts = Date.now();
    const qs = `timestamp=${ts}`;
    const sig = crypto2.default.createHmac('sha256', keys.apiSecret).update(qs).digest('hex');
    const baseUrl = keys.testnet
      ? 'https://testnet.binancefuture.com'
      : 'https://fapi.binance.com';
    const r = await axiosLib.get(`${baseUrl}/fapi/v2/account?${qs}&signature=${sig}`, {
      headers: { 'X-MBX-APIKEY': keys.apiKey },
      timeout: 8000,
    });
    return res.json({
      totalWalletBalance: r.data.totalWalletBalance,
      availableBalance: r.data.availableBalance,
      totalMarginBalance: r.data.totalMarginBalance,
      totalUnrealizedProfit: r.data.totalUnrealizedProfit,
      canTrade: r.data.canTrade,
      canDeposit: r.data.canDeposit,
      feeTier: r.data.feeTier,
    });
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: unknown } })?.response?.data || String(e);
    return res.status(500).json({ error: msg });
  }
});

// ─── Session Reset ─────────────────────────────────────────────────────────
app.post('/api/session/reset', (_req, res) => {
  tradeHistory.length = 0;
  equityCurve.length  = 0;
  equityCurve.push({ time: Date.now(), value: 0 });
  riskManager.resetSession();
  executor.clearOpenTrades();
  // Re-init robot slots so start buttons work (radar não tem capital dedicado)
  ['phantom', 'nexus', 'oracle'].forEach(id => riskManager.initRobot(id));
  broadcast('session_reset', { mode: currentMode, accountBalance });
  broadcast('system_state', getSystemState());
  return res.json({ success: true });
});

app.get('/api/klines', async (req, res) => {
  const { symbol = 'BTCUSDT', interval = '1m', limit = '100' } = req.query as Record<string, string>;
  try {
    const axios = (await import('axios')).default;
    const r = await axios.get('https://fapi.binance.com/fapi/v1/klines', {
      params: { symbol, interval, limit: Math.min(Number(limit), 500) },
      timeout: 5000,
    });
    // Binance klines: [openTime, open, high, low, close, volume, ...]
    const candles = (r.data as unknown[]).map((k: unknown) => {
      const arr = k as (string | number)[];
      return {
        time:   Math.floor(Number(arr[0]) / 1000),
        open:   parseFloat(String(arr[1])),
        high:   parseFloat(String(arr[2])),
        low:    parseFloat(String(arr[3])),
        close:  parseFloat(String(arr[4])),
        volume: parseFloat(String(arr[5])),
      };
    });
    res.json(candles);
  } catch (e) {
    res.status(503).json({ error: `Klines não disponível: ${String(e)}` });
  }
});

app.post('/api/trade/manual', async (req, res) => {
  const { symbol, direction, robotId, size, leverage } = req.body as {
    symbol: string;
    direction: 'LONG' | 'SHORT';
    robotId: string;
    size?: number;
    leverage?: number;
  };

  const validDirections = ['LONG', 'SHORT'];
  const validRobots     = ['phantom', 'nexus', 'oracle', 'radar'];
  const tradeSize       = (typeof size === 'number' && size >= 1 && size <= 100) ? size : undefined;
  const tradeLeverage   = (typeof leverage === 'number' && leverage >= 1 && leverage <= 125) ? Math.floor(leverage) : 2;

  if (!symbol || typeof symbol !== 'string' || !symbol.endsWith('USDT')) {
    return res.status(400).json({ error: 'Símbolo inválido. Deve terminar em USDT.' });
  }
  if (!validDirections.includes(direction)) return res.status(400).json({ error: 'direction deve ser LONG ou SHORT' });
  if (!validRobots.includes(robotId))       return res.status(400).json({ error: `robotId inválido. Use: ${validRobots.join(', ')}` });

  let price: number | undefined;

  if (marketTicks[symbol] && marketTicks[symbol].price > 0) {
    price = marketTicks[symbol].price;
  } else {
    try {
      const axios = (await import('axios')).default;
      const r = await axios.get(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`, { timeout: 4000 });
      price = parseFloat(r.data.price);
      marketTicks[symbol] = { price, change24h: 0, volume24h: 0, bid: 0, ask: 0, timestamp: Date.now() };
    } catch {
      return res.status(503).json({ error: `Preço ao vivo não disponível para ${symbol}` });
    }
  }

  if (!price || price <= 0) return res.status(503).json({ error: 'Preço ao vivo não disponível — aguarde conexão WebSocket' });

  const check = riskManager.canOpenTrade(robotId, tradeSize);
  if (!check.allowed) return res.status(409).json({ error: check.reason });

  try {
    const trade = await executor.openTrade(robotId, symbol, direction, price, {}, tradeSize, tradeLeverage);
    if (!trade) return res.status(409).json({ error: 'Trade rejeitado pelo gerenciador de risco' });

    // Subscribe to this symbol for real-time TP/SL monitoring
    binance.subscribeAggTrade(symbol);

    broadcast('alert', {
      level: 'info',
      message: `RADAR TRADE — ${direction} ${symbol} @ $${price.toFixed(symbol.includes('BTC') || symbol.includes('ETH') ? 0 : 4)} | Tamanho: $${(tradeSize ?? 5).toFixed(2)}`,
    });

    return res.json({
      success: true,
      trade,
      mode: PAPER_TRADING ? 'paper' : SIMULATION_MODE ? 'simulation' : 'live',
      livePrice: price,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

// ─── Helpers para estimativa de TP/SL na reconciliação ────────────────────────
function getReconcileTPSL(symbol: string, direction: TradeDirection): { tpPct: number; slPct: number } {
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

// ─── Reconciliação de posições abertas na Binance ──────────────────────────────
async function reconcileLivePositions(): Promise<void> {
  if (currentMode === 'paper') return;

  console.log('[RECONCILE] Verificando posições abertas na Binance...');

  let positions: Awaited<ReturnType<typeof binance.getOpenPositions>>;
  let orders:    Awaited<ReturnType<typeof binance.getOpenOrders>>;

  try {
    [positions, orders] = await Promise.all([
      binance.getOpenPositions(),
      binance.getOpenOrders(),
    ]);
  } catch (e) {
    console.error('[RECONCILE] Erro ao buscar dados da Binance:', (e as Error).message);
    return;
  }

  if (positions.length === 0) {
    console.log('[RECONCILE] Nenhuma posição aberta encontrada.');
    return;
  }

  const tpOrders = orders.filter(o => o.type === 'TAKE_PROFIT_MARKET');
  const slOrders = orders.filter(o => o.type === 'STOP_MARKET');
  let reconciled = 0;

  for (const pos of positions) {
    const posAmt = parseFloat(pos.positionAmt);
    if (posAmt === 0) continue;

    const direction: TradeDirection = posAmt > 0 ? 'LONG' : 'SHORT';

    // Evita duplicata — já monitorado pelo sistema
    if (executor.getOpenTradeBySymbolDirection(pos.symbol, direction)) {
      console.log(`[RECONCILE] ${direction} ${pos.symbol} já monitorado — ignorado.`);
      continue;
    }

    const entryPrice  = parseFloat(pos.entryPrice);
    const leverage    = parseInt(pos.leverage) || 2;
    const absNotional = Math.abs(parseFloat(pos.notional || '0')) || Math.abs(posAmt) * entryPrice;
    const size        = Math.max(absNotional / leverage, 1);

    const tp = tpOrders.find(o => o.symbol === pos.symbol && (o.positionSide === direction || o.positionSide === 'BOTH'));
    const sl = slOrders.find(o => o.symbol === pos.symbol && (o.positionSide === direction || o.positionSide === 'BOTH'));

    const { tpPct, slPct } = getReconcileTPSL(pos.symbol, direction);
    const tpPrice = tp ? parseFloat(tp.stopPrice) : entryPrice * tpPct;
    const slPrice = sl ? parseFloat(sl.stopPrice) : entryPrice * slPct;

    const trade: Trade = {
      id:                    `REC-${pos.symbol}-${direction}-${Date.now()}`,
      robotId:               'reconciled',
      symbol:                pos.symbol,
      direction,
      status:                'open',
      entryPrice,
      size,
      leverage,
      notional:              absNotional,
      tpPrice,
      slPrice,
      openTime:              Date.now(),
      trailingStop:          false,
      trailingActivationPct: 0,
      trailingDistancePct:   0,
      trailingActive:        false,
      trailingStopPrice:     0,
      bestPrice:             entryPrice,
      tpOrderId:             tp ? tp.orderId.toString() : undefined,
      slOrderId:             sl ? sl.orderId.toString() : undefined,
    };

    executor.forceInjectTrade(trade);
    binance.subscribeAggTrade(pos.symbol);
    reconciled++;

    const tpSrc = tp ? 'ordem real' : 'estimado';
    const slSrc = sl ? 'ordem real' : 'estimado';
    console.log(`[RECONCILE] ✓ ${direction} ${pos.symbol} @ $${entryPrice} | TP: $${tpPrice.toFixed(2)} (${tpSrc}) | SL: $${slPrice.toFixed(2)} (${slSrc})`);

    broadcast('alert', {
      level: 'info',
      message: `RECONCILIAR ✓ ${direction} ${pos.symbol} @ $${entryPrice} | TP ${tpSrc} | SL ${slSrc}`,
    });
  }

  if (reconciled > 0) {
    broadcast('system_state', getSystemState());
    console.log(`[RECONCILE] ${reconciled} posição(ões) restaurada(s).`);
  }
}

async function bootstrap() {
  initDatabase();

  // Carrega precision/filters de todos os símbolos (endpoint público — sem auth)
  binance.loadExchangeInfo().catch(e => console.error('[BOOTSTRAP] loadExchangeInfo:', e));

  // Load saved API keys first so we know the mode before loading history
  const savedKeys = loadKeys();
  if (savedKeys?.apiKey && savedKeys?.apiSecret) {
    const baseUrl = savedKeys.testnet ? TESTNET_REST_URL : REAL_REST_URL;
    binance.updateCredentials(savedKeys.apiKey, savedKeys.apiSecret, baseUrl);
    BINANCE_CONFIG.apiKey    = savedKeys.apiKey;
    BINANCE_CONFIG.apiSecret = savedKeys.apiSecret;
    currentMode = savedKeys.testnet ? 'testnet' : savedKeys.liveMode ? 'live' : 'paper';
    console.log(`[CONFIG] Chaves carregadas — Modo: ${currentMode}`);
    binance.setRuntimeMode(currentMode);
    binance.testCredentials().then(r => {
      if (r.ok && r.info) accountBalance = r.info as typeof accountBalance;
    }).catch(() => {});
    if (currentMode !== 'paper') {
      binance.startUserDataStream().catch(() => {});
      // Reconcilia posições abertas na Binance após credenciais carregadas
      setTimeout(() => reconcileLivePositions().catch(e => console.error('[RECONCILE]', e)), 2000);
    }
  }

  // Only load persisted history in paper mode — live/testnet start fresh each session
  if (currentMode === 'paper') {
    const persisted = loadTradeHistory(500);
    tradeHistory.push(...persisted);
    const savedCurve = loadEquityCurve(1000);
    if (savedCurve.length > 0) {
      equityCurve.push(...savedCurve);
    } else {
      equityCurve.push({ time: Date.now(), value: RISK_CONFIG.initialCapital });
    }
  } else {
    equityCurve.push({ time: Date.now(), value: 0 });
  }

  // Apenas os 3 robôs de trading recebem alocação de capital (radar usa disponível do sistema)
  ['phantom', 'nexus', 'oracle'].forEach(id => riskManager.initRobot(id));

  // In live/testnet mode, zero out paper capital so P&L starts at $0.00
  if (currentMode !== 'paper') {
    riskManager.resetSession();
    // Fetch real balance and set as available capital for risk checks
    binance.testCredentials().then(r => {
      if (r.ok && r.info) {
        accountBalance = r.info as typeof accountBalance;
        const liveBal = (r.info as Record<string, number>).availableBalance ?? 0;
        if (liveBal > 0) riskManager.setLiveCapital(liveBal);
      }
    }).catch(() => {});
  }

  // Fast broadcast every 500ms
  setInterval(() => {
    const openTrades = executor.getOpenTrades();
    if (openTrades.length > 0) broadcast('active_trades_update', { activeTrades: openTrades });
  }, 500);
  // Full system state every 2s
  setInterval(() => broadcast('system_state', getSystemState()), 2000);
  // Refresh real account balance every 30s when in live/testnet mode
  setInterval(async () => {
    if (currentMode !== 'paper' && hasKeys()) {
      const r = await binance.testCredentials();
      if (r.ok && r.info) {
        accountBalance = r.info as typeof accountBalance;
        // accountBalance is shown for reference only — internal capital is tracked via closeTrade
        broadcast('account_balance', { accountBalance, mode: currentMode });
      }
    }
  }, 30000);
  // Robots do NOT auto-start — user starts them via the dashboard
  // radar.start() removed — user must select mode first
  server.listen(SERVER_CONFIG.port, () => {
    const mode = PAPER_TRADING ? '📡 PAPER TRADING (real prices, virtual orders)' : SIMULATION_MODE ? '🟡 SIMULATION (synthetic prices, virtual orders)' : '🟢 LIVE TRADING';
    console.log(`\n  CRIPTO SYSTEM — ${mode}`);
    console.log(`   Port:      ${SERVER_CONFIG.port}`);
    console.log(`   WebSocket: ws://localhost:${SERVER_CONFIG.port}`);
    console.log(`   REST API:  http://localhost:${SERVER_CONFIG.port}/api\n`);
  });
}

bootstrap().catch(console.error);
