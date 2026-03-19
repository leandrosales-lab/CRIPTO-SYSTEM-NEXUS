import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Trade, EquityPoint } from '../types';
import { RISK_CONFIG } from '../config/binance';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'cripto_system.db');

let db: Database.Database;

export function initDatabase(): void {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id                     TEXT PRIMARY KEY,
      robot_id               TEXT NOT NULL,
      symbol                 TEXT NOT NULL,
      direction              TEXT NOT NULL,
      status                 TEXT NOT NULL,
      entry_price            REAL NOT NULL,
      exit_price             REAL,
      size                   REAL NOT NULL,
      leverage               INTEGER NOT NULL,
      notional               REAL NOT NULL,
      tp_price               REAL NOT NULL,
      sl_price               REAL NOT NULL,
      open_time              INTEGER NOT NULL,
      close_time             INTEGER,
      pnl                    REAL,
      pnl_percent            REAL,
      order_id               TEXT,
      close_reason           TEXT,
      trailing_stop          INTEGER DEFAULT 0,
      trailing_active        INTEGER DEFAULT 0,
      trailing_stop_price    REAL DEFAULT 0,
      best_price             REAL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_trades_robot   ON trades (robot_id);
    CREATE INDEX IF NOT EXISTS idx_trades_symbol  ON trades (symbol);
    CREATE INDEX IF NOT EXISTS idx_trades_status  ON trades (status);
    CREATE INDEX IF NOT EXISTS idx_trades_close   ON trades (close_time DESC);

    CREATE TABLE IF NOT EXISTS equity_curve (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      time  INTEGER NOT NULL,
      value REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_equity_time ON equity_curve (time DESC);

    CREATE TABLE IF NOT EXISTS sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time    INTEGER NOT NULL,
      end_time      INTEGER,
      initial_cap   REAL NOT NULL,
      final_cap     REAL,
      total_trades  INTEGER DEFAULT 0,
      win_trades    INTEGER DEFAULT 0
    );
  `);

  console.log(`[DB] SQLite initialised at ${DB_PATH}`);

  const migrations = [
    `ALTER TABLE trades ADD COLUMN close_reason TEXT`,
    `ALTER TABLE trades ADD COLUMN trailing_stop INTEGER DEFAULT 0`,
    `ALTER TABLE trades ADD COLUMN trailing_active INTEGER DEFAULT 0`,
    `ALTER TABLE trades ADD COLUMN trailing_stop_price REAL DEFAULT 0`,
    `ALTER TABLE trades ADD COLUMN best_price REAL DEFAULT 0`,
    `ALTER TABLE trades ADD COLUMN fee REAL DEFAULT 0`,
    `ALTER TABLE trades ADD COLUMN pnl_gross REAL`,
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (_) { /* column already exists */ }
  }
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialised — call initDatabase() first');
  return db;
}

const insertTrade = () => getDb().prepare(`
  INSERT OR IGNORE INTO trades
    (id, robot_id, symbol, direction, status, entry_price, exit_price, size,
     leverage, notional, tp_price, sl_price, open_time, close_time, pnl, pnl_gross, fee,
     pnl_percent, order_id, close_reason, trailing_stop, trailing_active, trailing_stop_price, best_price)
  VALUES
    (@id, @robotId, @symbol, @direction, @status, @entryPrice, @exitPrice, @size,
     @leverage, @notional, @tpPrice, @slPrice, @openTime, @closeTime, @pnl, @pnlGross, @fee,
     @pnlPercent, @orderId, @closeReason, @trailingStop, @trailingActive, @trailingStopPrice, @bestPrice)
`);

const updateTrade = () => getDb().prepare(`
  UPDATE trades
  SET status = @status, exit_price = @exitPrice, close_time = @closeTime,
      pnl = @pnl, pnl_gross = @pnlGross, fee = @fee, pnl_percent = @pnlPercent,
      close_reason = @closeReason, trailing_active = @trailingActive,
      trailing_stop_price = @trailingStopPrice, best_price = @bestPrice
  WHERE id = @id
`);

export function saveTrade(trade: Trade): void {
  insertTrade().run({
    id:                trade.id,
    robotId:           trade.robotId,
    symbol:            trade.symbol,
    direction:         trade.direction,
    status:            trade.status,
    entryPrice:        trade.entryPrice,
    exitPrice:         trade.exitPrice         ?? null,
    size:              trade.size,
    leverage:          trade.leverage,
    notional:          trade.notional,
    tpPrice:           trade.tpPrice,
    slPrice:           trade.slPrice,
    openTime:          trade.openTime,
    closeTime:         trade.closeTime         ?? null,
    pnl:               trade.pnl               ?? null,
    pnlGross:          trade.pnlGross          ?? null,
    fee:               trade.fee               ?? 0,
    pnlPercent:        trade.pnlPercent         ?? null,
    orderId:           trade.orderId            ?? null,
    closeReason:       null,
    trailingStop:      trade.trailingStop ? 1 : 0,
    trailingActive:    trade.trailingActive ? 1 : 0,
    trailingStopPrice: trade.trailingStopPrice  ?? 0,
    bestPrice:         trade.bestPrice          ?? trade.entryPrice,
  });
}

export function closeTrade(trade: Trade & { reason?: string }): void {
  updateTrade().run({
    id:                trade.id,
    status:            trade.status,
    exitPrice:         trade.exitPrice         ?? null,
    closeTime:         trade.closeTime         ?? null,
    pnl:               trade.pnl               ?? null,
    pnlGross:          trade.pnlGross          ?? null,
    fee:               trade.fee               ?? 0,
    pnlPercent:        trade.pnlPercent         ?? null,
    closeReason:       trade.reason            ?? null,
    trailingActive:    trade.trailingActive ? 1 : 0,
    trailingStopPrice: trade.trailingStopPrice  ?? 0,
    bestPrice:         trade.bestPrice          ?? trade.entryPrice,
  });
}

export function saveEquityPoint(point: EquityPoint): void {
  getDb().prepare('INSERT INTO equity_curve (time, value) VALUES (?, ?)').run(point.time, point.value);
}

export function loadTradeHistory(limit = 500): Trade[] {
  const rows = getDb().prepare(
    `SELECT * FROM trades WHERE status = 'closed' ORDER BY close_time DESC LIMIT ?`
  ).all(limit) as Record<string, unknown>[];
  return rows.map(rowToTrade);
}

export function loadEquityCurve(limit = 1000): EquityPoint[] {
  const rows = getDb().prepare(
    `SELECT time, value FROM equity_curve ORDER BY time DESC LIMIT ?`
  ).all(limit) as { time: number; value: number }[];
  return rows.reverse();
}

export function queryTrades(opts: {
  robotId?: string;
  symbol?: string;
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
}): { trades: Trade[]; total: number } {
  const conditions: string[] = ["status = 'closed'"];
  const params: (string | number)[] = [];

  if (opts.robotId) { conditions.push('robot_id = ?'); params.push(opts.robotId); }
  if (opts.symbol)  { conditions.push('symbol = ?');   params.push(opts.symbol); }
  if (opts.from)    { conditions.push('close_time >= ?'); params.push(opts.from); }
  if (opts.to)      { conditions.push('close_time <= ?'); params.push(opts.to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit  = opts.limit  ?? 100;
  const offset = opts.offset ?? 0;

  const total = (getDb().prepare(`SELECT COUNT(*) as n FROM trades ${where}`).get(...params) as { n: number }).n;
  const rows  = getDb().prepare(`SELECT * FROM trades ${where} ORDER BY close_time DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Record<string, unknown>[];

  return { trades: rows.map(rowToTrade), total };
}

export function getStats(robotId?: string): {
  totalTrades: number;
  wins: number;
  losses: number;
  totalPnl: number;
  avgPnl: number;
  bestTrade: number;
  worstTrade: number;
  avgDurationMs: number;
} {
  const filter = robotId ? "AND robot_id = ?" : '';
  const param  = robotId ? [robotId] : [];

  const row = getDb().prepare(`
    SELECT
      COUNT(*)                           AS totalTrades,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) AS losses,
      COALESCE(SUM(pnl), 0)              AS totalPnl,
      COALESCE(AVG(pnl), 0)              AS avgPnl,
      COALESCE(MAX(pnl), 0)              AS bestTrade,
      COALESCE(MIN(pnl), 0)              AS worstTrade,
      COALESCE(AVG(close_time - open_time), 0) AS avgDurationMs
    FROM trades
    WHERE status = 'closed' ${filter}
  `).get(...param) as Record<string, number>;

  return {
    totalTrades:  row.totalTrades,
    wins:         row.wins,
    losses:       row.losses,
    totalPnl:     row.totalPnl,
    avgPnl:       row.avgPnl,
    bestTrade:    row.bestTrade,
    worstTrade:   row.worstTrade,
    avgDurationMs: row.avgDurationMs,
  };
}

function rowToTrade(row: Record<string, unknown>): Trade {
  return {
    id:                    row.id           as string,
    robotId:               row.robot_id     as string,
    symbol:                row.symbol       as string,
    direction:             row.direction    as 'LONG' | 'SHORT',
    status:                row.status       as 'open' | 'closed' | 'cancelled',
    entryPrice:            row.entry_price  as number,
    exitPrice:             row.exit_price   as number | undefined,
    size:                  row.size         as number,
    leverage:              row.leverage     as number,
    notional:              row.notional     as number,
    tpPrice:               row.tp_price     as number,
    slPrice:               row.sl_price     as number,
    openTime:              row.open_time    as number,
    closeTime:             row.close_time   as number | undefined,
    pnl:                   row.pnl          as number | undefined,
    pnlGross:              row.pnl_gross    as number | undefined,
    fee:                   row.fee          as number | undefined,
    pnlPercent:            row.pnl_percent  as number | undefined,
    orderId:               row.order_id     as string | undefined,
    trailingStop:          Boolean(row.trailing_stop),
    trailingActive:        Boolean(row.trailing_active),
    trailingStopPrice:     (row.trailing_stop_price as number) ?? 0,
    trailingActivationPct: RISK_CONFIG.trailingActivationPct,
    trailingDistancePct:   RISK_CONFIG.trailingDistancePct,
    bestPrice:             (row.best_price  as number) ?? (row.entry_price as number),
  };
}
