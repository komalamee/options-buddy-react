"""Database operations for Options Buddy."""

import sqlite3
import os
from datetime import datetime, date
from typing import List, Optional
from contextlib import contextmanager

from config import settings


@contextmanager
def get_db_connection():
    """Context manager for database connections."""
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Initialize database tables if they don't exist."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Positions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                underlying TEXT NOT NULL,
                option_type TEXT NOT NULL CHECK(option_type IN ('CALL', 'PUT')),
                strike REAL NOT NULL,
                expiry DATE NOT NULL,
                quantity INTEGER NOT NULL,
                premium_collected REAL NOT NULL,
                open_date DATE NOT NULL,
                close_date DATE,
                close_price REAL,
                status TEXT NOT NULL DEFAULT 'OPEN'
                    CHECK(status IN ('OPEN', 'CLOSED', 'ASSIGNED', 'EXPIRED', 'ROLLED')),
                strategy_type TEXT NOT NULL
                    CHECK(strategy_type IN ('CSP', 'CC', 'BULL_PUT', 'BEAR_CALL',
                                            'IRON_CONDOR', 'STRANGLE', 'STRADDLE', 'NAKED')),
                notes TEXT,
                ibkr_con_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Stock holdings table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS stock_holdings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                avg_cost REAL,
                current_price REAL,
                market_value REAL,
                unrealized_pnl REAL,
                ibkr_con_id INTEGER,
                last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(symbol)
            )
        ''')

        # Watchlists table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS watchlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Watchlist symbols table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS watchlist_symbols (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                watchlist_id INTEGER NOT NULL,
                symbol TEXT NOT NULL,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE,
                UNIQUE(watchlist_id, symbol)
            )
        ''')

        # Trades table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                position_id INTEGER NOT NULL,
                action TEXT NOT NULL CHECK(action IN ('OPEN', 'CLOSE', 'ROLL_CLOSE', 'ROLL_OPEN', 'ADJUST')),
                price REAL NOT NULL,
                quantity INTEGER NOT NULL,
                fees REAL DEFAULT 0,
                trade_date TIMESTAMP NOT NULL,
                notes TEXT,
                FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
            )
        ''')

        conn.commit()


# ==================== POSITIONS ====================

def get_open_positions() -> List[dict]:
    """Get all open option positions."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM positions
            WHERE status = 'OPEN'
            ORDER BY expiry ASC
        ''')
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_closed_positions(limit: int = 50) -> List[dict]:
    """Get closed positions."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM positions
            WHERE status != 'OPEN'
            ORDER BY close_date DESC
            LIMIT ?
        ''', (limit,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_position_by_id(position_id: int) -> Optional[dict]:
    """Get a single position by ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM positions WHERE id = ?', (position_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def create_position(
    underlying: str,
    option_type: str,
    strike: float,
    expiry: str,
    quantity: int,
    premium_collected: float,
    strategy_type: str,
    open_date: Optional[str] = None,
    notes: Optional[str] = None,
    ibkr_con_id: Optional[int] = None
) -> int:
    """Create a new position."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO positions (
                underlying, option_type, strike, expiry, quantity,
                premium_collected, strategy_type, open_date, notes, ibkr_con_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            underlying.upper(),
            option_type.upper(),
            strike,
            expiry,
            quantity,
            premium_collected,
            strategy_type.upper(),
            open_date or date.today().isoformat(),
            notes,
            ibkr_con_id
        ))
        conn.commit()
        return cursor.lastrowid


def close_position(
    position_id: int,
    close_price: float,
    close_date: Optional[str] = None,
    status: str = 'CLOSED'
) -> bool:
    """Close a position."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE positions
            SET close_date = ?, close_price = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (
            close_date or date.today().isoformat(),
            close_price,
            status,
            position_id
        ))
        conn.commit()
        return cursor.rowcount > 0


def update_position(position_id: int, **updates) -> bool:
    """Update a position with the provided fields."""
    if not updates:
        return False

    allowed_fields = {
        'underlying', 'option_type', 'strike', 'expiry', 'quantity',
        'premium_collected', 'strategy_type', 'notes', 'ibkr_con_id'
    }

    # Filter to allowed fields
    valid_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    if not valid_updates:
        return False

    set_clause = ', '.join(f'{k} = ?' for k in valid_updates.keys())
    values = list(valid_updates.values()) + [position_id]

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f'''
            UPDATE positions
            SET {set_clause}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', values)
        conn.commit()
        return cursor.rowcount > 0


# ==================== STOCK HOLDINGS ====================

def get_stock_holdings() -> List[dict]:
    """Get all stock holdings."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM stock_holdings ORDER BY symbol')
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def upsert_stock_holding(
    symbol: str,
    quantity: int,
    avg_cost: Optional[float] = None,
    current_price: Optional[float] = None,
    ibkr_con_id: Optional[int] = None
) -> int:
    """Insert or update a stock holding."""
    market_value = (quantity * current_price) if current_price else None
    unrealized_pnl = (quantity * (current_price - avg_cost)) if (current_price and avg_cost) else None

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO stock_holdings (symbol, quantity, avg_cost, current_price, market_value, unrealized_pnl, ibkr_con_id, last_synced)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(symbol) DO UPDATE SET
                quantity = excluded.quantity,
                avg_cost = COALESCE(excluded.avg_cost, stock_holdings.avg_cost),
                current_price = COALESCE(excluded.current_price, stock_holdings.current_price),
                market_value = excluded.market_value,
                unrealized_pnl = excluded.unrealized_pnl,
                ibkr_con_id = COALESCE(excluded.ibkr_con_id, stock_holdings.ibkr_con_id),
                last_synced = CURRENT_TIMESTAMP
        ''', (symbol.upper(), quantity, avg_cost, current_price, market_value, unrealized_pnl, ibkr_con_id))
        conn.commit()
        return cursor.lastrowid


def delete_stock_holding(symbol: str) -> bool:
    """Delete a stock holding."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM stock_holdings WHERE symbol = ?', (symbol.upper(),))
        conn.commit()
        return cursor.rowcount > 0


# ==================== WATCHLISTS ====================

def get_watchlists() -> List[dict]:
    """Get all watchlists with their symbols."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM watchlists ORDER BY name')
        watchlists = [dict(row) for row in cursor.fetchall()]

        for wl in watchlists:
            cursor.execute(
                'SELECT symbol FROM watchlist_symbols WHERE watchlist_id = ? ORDER BY symbol',
                (wl['id'],)
            )
            wl['symbols'] = [row['symbol'] for row in cursor.fetchall()]

        return watchlists


def create_watchlist(name: str, description: Optional[str] = None, symbols: Optional[List[str]] = None) -> int:
    """Create a new watchlist."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO watchlists (name, description) VALUES (?, ?)',
            (name, description)
        )
        watchlist_id = cursor.lastrowid

        if symbols:
            for symbol in symbols:
                cursor.execute(
                    'INSERT OR IGNORE INTO watchlist_symbols (watchlist_id, symbol) VALUES (?, ?)',
                    (watchlist_id, symbol.upper())
                )

        conn.commit()
        return watchlist_id


def add_symbol_to_watchlist(watchlist_id: int, symbol: str) -> bool:
    """Add a symbol to a watchlist."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                'INSERT INTO watchlist_symbols (watchlist_id, symbol) VALUES (?, ?)',
                (watchlist_id, symbol.upper())
            )
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False


def remove_symbol_from_watchlist(watchlist_id: int, symbol: str) -> bool:
    """Remove a symbol from a watchlist."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'DELETE FROM watchlist_symbols WHERE watchlist_id = ? AND symbol = ?',
            (watchlist_id, symbol.upper())
        )
        conn.commit()
        return cursor.rowcount > 0


# ==================== PERFORMANCE STATS ====================

def get_performance_stats() -> dict:
    """Calculate performance statistics from closed trades."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Get all closed positions
        cursor.execute('''
            SELECT
                underlying,
                option_type,
                premium_collected,
                close_price,
                quantity,
                strategy_type,
                open_date,
                close_date
            FROM positions
            WHERE status IN ('CLOSED', 'EXPIRED', 'ASSIGNED')
        ''')

        closed = cursor.fetchall()

        if not closed:
            return {
                'total_trades': 0,
                'winning_trades': 0,
                'losing_trades': 0,
                'win_rate': 0,
                'total_realized_pnl': 0,
                'avg_win': 0,
                'avg_loss': 0,
                'best_trade': None,
                'worst_trade': None,
                'profit_factor': 0
            }

        pnl_list = []
        for row in closed:
            # P&L = (premium_collected - close_price) * quantity * 100
            pnl = (row['premium_collected'] - (row['close_price'] or 0)) * row['quantity'] * 100
            pnl_list.append({
                'symbol': row['underlying'],
                'pnl': pnl,
                'strategy': row['strategy_type']
            })

        wins = [p for p in pnl_list if p['pnl'] > 0]
        losses = [p for p in pnl_list if p['pnl'] <= 0]

        total_wins = sum(p['pnl'] for p in wins)
        total_losses = abs(sum(p['pnl'] for p in losses))

        return {
            'total_trades': len(pnl_list),
            'winning_trades': len(wins),
            'losing_trades': len(losses),
            'win_rate': (len(wins) / len(pnl_list) * 100) if pnl_list else 0,
            'total_realized_pnl': sum(p['pnl'] for p in pnl_list),
            'avg_win': (total_wins / len(wins)) if wins else 0,
            'avg_loss': (total_losses / len(losses)) if losses else 0,
            'best_trade': max(pnl_list, key=lambda x: x['pnl']) if pnl_list else None,
            'worst_trade': min(pnl_list, key=lambda x: x['pnl']) if pnl_list else None,
            'profit_factor': (total_wins / total_losses) if total_losses > 0 else float('inf')
        }


# Initialize DB on module load
if os.path.exists(settings.db_path):
    # DB exists, just verify connection
    pass
else:
    # Create directory if needed
    os.makedirs(os.path.dirname(settings.db_path), exist_ok=True)
    init_db()
