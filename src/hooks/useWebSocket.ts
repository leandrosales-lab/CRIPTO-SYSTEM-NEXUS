import { useEffect, useRef, useCallback } from 'react';
import { useStore, Trade, RobotState } from '../store/useStore';

type AccountBalance = ReturnType<typeof useStore.getState>['accountBalance'];

const WS_URL = 'ws://localhost:3001';

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const { setConnected, setSystemState, updateRobot, addTrade, closeTrade, updateMarketTick, updateEquity, addAlert } = useStore();
  const updateRadar = useStore(s => s.updateRadar);
  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;
    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      console.log('[WS] Connected to backend');
    };

    socket.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    socket.onerror = () => {
      setConnected(false);
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, payload } = msg;
        switch (type) {
          case 'system_state': {
            const p = payload as { mode?: 'paper' | 'testnet' | 'live'; accountBalance?: unknown; [k: string]: unknown };
            setSystemState(p as Parameters<typeof setSystemState>[0]);
            if (p.mode) useStore.getState().setMode(p.mode);
            if ('accountBalance' in p) useStore.getState().setAccountBalance(p.accountBalance as AccountBalance ?? null);
            break;
          }
          case 'robot_state':
            updateRobot(payload as Parameters<typeof updateRobot>[0]);
            break;
          case 'trade_open':
            addTrade(payload as Parameters<typeof addTrade>[0]);
            break;
          case 'trade_close':
            closeTrade(payload as Parameters<typeof closeTrade>[0]);
            break;
          case 'trailing_activated':
          case 'trailing_updated':
            useStore.getState().updateTrailing(payload as { tradeId: string; trailingStopPrice: number; bestPrice?: number; trailingActive?: boolean });
            break;
          case 'market_tick':
            updateMarketTick((payload as { symbol: string; price: number }).symbol, (payload as { symbol: string; price: number }).price);
            break;
          case 'equity_update': {
            const ep = payload as { capital: number; totalPnl?: number; equityCurve?: Parameters<typeof updateEquity>[1] };
            updateEquity(ep.capital, ep.equityCurve);
            if (ep.totalPnl !== undefined) useStore.getState().setSystemState({ totalPnl: ep.totalPnl });
            break;
          }
          case 'capital_update': {
            const cp = payload as { capital: number; totalPnl: number };
            useStore.getState().setSystemState({ capital: cp.capital, totalPnl: cp.totalPnl });
            break;
          }
          case 'alert':
            addAlert(payload as { level: string; message: string });
            break;
          case 'active_trades_update':
            useStore.getState().setSystemState({ activeTrades: (payload as { activeTrades: Trade[] }).activeTrades });
            break;
          case 'radar_update':
            updateRadar({ signals: (payload as { signals: Parameters<typeof updateRadar>[0]['signals']; scanCount: number; scannedAt: number }).signals, scanCount: (payload as { scanCount: number }).scanCount, scannedAt: (payload as { scannedAt: number }).scannedAt });
            break;
          case 'config_update': {
            const cfg = payload as { hasKeys?: boolean; mode?: 'paper' | 'testnet' | 'live'; accountBalance?: unknown };
            if (cfg.mode) useStore.getState().setMode(cfg.mode);
            if ('accountBalance' in cfg) useStore.getState().setAccountBalance(cfg.accountBalance as AccountBalance ?? null);
            if (cfg.hasKeys !== undefined) useStore.getState().setApiKeySet(cfg.hasKeys);
            break;
          }
          case 'account_balance': {
            const ab = payload as { accountBalance?: unknown; mode?: 'paper' | 'testnet' | 'live' };
            if ('accountBalance' in ab) useStore.getState().setAccountBalance(ab.accountBalance as AccountBalance ?? null);
            if (ab.mode) useStore.getState().setMode(ab.mode);
            break;
          }
          case 'session_reset': {
            const sr = payload as { mode?: 'paper' | 'testnet' | 'live'; accountBalance?: unknown };
            useStore.getState().setSystemState({
              tradeHistory:  [],
              activeTrades:  [],
              equityCurve:   [{ time: Date.now(), value: 0 }],
              capital:       0,
              totalPnl:      0,
              todayPnl:      0,
              drawdown:      0,
              killSwitchActive: false,
            });
            if (sr.mode) useStore.getState().setMode(sr.mode);
            if ('accountBalance' in sr) useStore.getState().setAccountBalance(sr.accountBalance as AccountBalance ?? null);
            break;
          }
        }
      } catch (_) {}
    };
  }, [setConnected, setSystemState, updateRobot, addTrade, closeTrade, updateMarketTick, updateEquity, addAlert, updateRadar]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  const sendCommand = useCallback((type: string, payload: unknown) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return { sendCommand };
}
