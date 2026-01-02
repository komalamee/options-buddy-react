"""Database operations for Options Buddy."""

import sqlite3
import os
import uuid
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

        # App settings table (key-value store)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Import history table - tracks CSV imports
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS import_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                import_type TEXT NOT NULL DEFAULT 'IBKR',
                trades_imported INTEGER NOT NULL DEFAULT 0,
                trades_skipped INTEGER NOT NULL DEFAULT 0,
                errors TEXT,
                imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Wheel chains table - tracks premium accumulation across multiple positions
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS wheel_chains (
                id TEXT PRIMARY KEY,
                underlying TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'COLLECTING_PREMIUM'
                    CHECK(status IN ('COLLECTING_PREMIUM', 'HOLDING_SHARES', 'CLOSED')),
                assignment_strike REAL,
                assignment_date DATE,
                shares_acquired INTEGER DEFAULT 100,
                total_put_premium REAL NOT NULL DEFAULT 0,
                total_call_premium REAL NOT NULL DEFAULT 0,
                assignment_cost REAL,
                net_cost_basis REAL,
                effective_cost_basis REAL,
                exit_date DATE,
                exit_price REAL,
                exit_type TEXT CHECK(exit_type IS NULL OR exit_type IN ('CALLED_AWAY', 'SOLD')),
                realized_pnl REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        conn.commit()

        # Run migrations for existing tables
        _run_migrations(conn)


def _run_migrations(conn):
    """Run database migrations to add new columns to existing tables."""
    cursor = conn.cursor()

    # Check and add wheel_chain_id to positions table
    cursor.execute("PRAGMA table_info(positions)")
    position_columns = [col[1] for col in cursor.fetchall()]
    if 'wheel_chain_id' not in position_columns:
        cursor.execute('ALTER TABLE positions ADD COLUMN wheel_chain_id TEXT REFERENCES wheel_chains(id)')

    # Check and add columns to stock_holdings table
    cursor.execute("PRAGMA table_info(stock_holdings)")
    holdings_columns = [col[1] for col in cursor.fetchall()]
    if 'wheel_chain_id' not in holdings_columns:
        cursor.execute('ALTER TABLE stock_holdings ADD COLUMN wheel_chain_id TEXT REFERENCES wheel_chains(id)')
    if 'premium_adjusted_cost' not in holdings_columns:
        cursor.execute('ALTER TABLE stock_holdings ADD COLUMN premium_adjusted_cost REAL')

    conn.commit()


# ==================== POSITIONS ====================

def create_closed_position(
    underlying: str,
    option_type: str,
    strike: float,
    expiry: str,
    quantity: int,
    premium_collected: float,
    strategy_type: str,
    open_date: str,
    close_date: str,
    close_price: float,
    status: str = 'CLOSED',
    notes: Optional[str] = None
) -> int:
    """Create a position that is already closed (for CSV imports)."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO positions (
                underlying, option_type, strike, expiry, quantity,
                premium_collected, strategy_type, open_date, close_date,
                close_price, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            underlying.upper(),
            option_type.upper(),
            strike,
            expiry,
            quantity,
            premium_collected,
            strategy_type.upper(),
            open_date,
            close_date,
            close_price,
            status,
            notes
        ))
        conn.commit()
        return cursor.lastrowid


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


def clear_all_positions() -> int:
    """Delete all positions from the database. Returns number deleted."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM positions')
        count = cursor.fetchone()[0]
        cursor.execute('DELETE FROM positions')
        conn.commit()
        return count


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
    """Create a new position or update existing one if ibkr_con_id matches."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # If we have an IBKR con_id, check if position already exists
        if ibkr_con_id:
            cursor.execute(
                'SELECT id FROM positions WHERE ibkr_con_id = ? AND status = ?',
                (ibkr_con_id, 'OPEN')
            )
            existing = cursor.fetchone()
            if existing:
                # Update existing position
                cursor.execute('''
                    UPDATE positions SET
                        quantity = ?, premium_collected = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (quantity, premium_collected, existing['id']))
                conn.commit()
                return existing['id']

        # Create new position
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

        # Get all closed positions with full details
        cursor.execute('''
            SELECT
                id,
                underlying,
                option_type,
                strike,
                expiry,
                premium_collected,
                close_price,
                quantity,
                strategy_type,
                open_date,
                close_date,
                status,
                notes
            FROM positions
            WHERE status IN ('CLOSED', 'EXPIRED', 'ASSIGNED')
            ORDER BY close_date DESC
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
                'profit_factor': 0,
                'trades': []
            }

        pnl_list = []
        trades = []
        for row in closed:
            # P&L = (premium_collected - close_price) * quantity * 100
            pnl = (row['premium_collected'] - (row['close_price'] or 0)) * row['quantity'] * 100

            # Format symbol for display: TSLA $410 PUT 10/17
            expiry_formatted = row['expiry'][5:7] + '/' + row['expiry'][8:10] if row['expiry'] else ''
            display_symbol = f"{row['underlying']} ${row['strike']:.0f} {row['option_type']} {expiry_formatted}"

            trade_detail = {
                'id': row['id'],
                'symbol': display_symbol,
                'underlying': row['underlying'],
                'option_type': row['option_type'],
                'strike': row['strike'],
                'expiry': row['expiry'],
                'pnl': round(pnl, 2),
                'premium_collected': row['premium_collected'],
                'close_price': row['close_price'] or 0,
                'quantity': row['quantity'],
                'strategy': row['strategy_type'],
                'open_date': row['open_date'],
                'close_date': row['close_date'],
                'status': row['status'],
                'is_winner': pnl > 0
            }
            trades.append(trade_detail)

            pnl_list.append({
                'symbol': row['underlying'],
                'pnl': pnl,
                'strategy': row['strategy_type']
            })

        wins = [p for p in pnl_list if p['pnl'] > 0]
        losses = [p for p in pnl_list if p['pnl'] <= 0]

        total_wins = sum(p['pnl'] for p in wins)
        total_losses = abs(sum(p['pnl'] for p in losses))

        # Get best and worst with full symbol info from trades list
        best_trade = max(trades, key=lambda x: x['pnl']) if trades else None
        worst_trade = min(trades, key=lambda x: x['pnl']) if trades else None

        return {
            'total_trades': len(pnl_list),
            'winning_trades': len(wins),
            'losing_trades': len(losses),
            'win_rate': (len(wins) / len(pnl_list) * 100) if pnl_list else 0,
            'total_realized_pnl': round(sum(p['pnl'] for p in pnl_list), 2),
            'avg_win': round((total_wins / len(wins)), 2) if wins else 0,
            'avg_loss': round((total_losses / len(losses)), 2) if losses else 0,
            'best_trade': {'symbol': best_trade['symbol'], 'pnl': best_trade['pnl']} if best_trade else None,
            'worst_trade': {'symbol': worst_trade['symbol'], 'pnl': worst_trade['pnl']} if worst_trade else None,
            'profit_factor': round((total_wins / total_losses), 2) if total_losses > 0 else float('inf'),
            'trades': trades
        }


def get_open_positions_with_pnl() -> list:
    """Get all open positions with unrealized P&L calculated."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT
                id,
                underlying,
                option_type,
                strike,
                expiry,
                premium_collected,
                quantity,
                strategy_type,
                open_date,
                status,
                notes
            FROM positions
            WHERE status = 'OPEN'
            ORDER BY expiry ASC
        ''')
        rows = cursor.fetchall()

        positions = []
        for row in rows:
            # Format symbol for display
            expiry_formatted = row['expiry'][5:7] + '/' + row['expiry'][8:10] if row['expiry'] else ''
            display_symbol = f"{row['underlying']} ${row['strike']:.0f} {row['option_type']} {expiry_formatted}"

            # Calculate unrealized P&L (for sold options, premium collected is the max profit)
            # This is a simplified calculation - ideally we'd have current market price
            unrealized_pnl = row['premium_collected'] * row['quantity'] * 100

            positions.append({
                'id': row['id'],
                'symbol': display_symbol,
                'underlying': row['underlying'],
                'option_type': row['option_type'],
                'strike': row['strike'],
                'expiry': row['expiry'],
                'premium_collected': row['premium_collected'],
                'quantity': row['quantity'],
                'strategy': row['strategy_type'],
                'open_date': row['open_date'],
                'status': row['status'],
                'unrealized_pnl': round(unrealized_pnl, 2)
            })

        return positions


# ==================== IMPORT HISTORY ====================

def record_import(filename: str, trades_imported: int, trades_skipped: int, errors: list = None) -> int:
    """Record an import in the history. Returns the import ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO import_history (filename, trades_imported, trades_skipped, errors)
            VALUES (?, ?, ?, ?)
        ''', (filename, trades_imported, trades_skipped, ','.join(errors) if errors else None))
        conn.commit()
        return cursor.lastrowid


def get_import_history(limit: int = 20) -> list:
    """Get the import history, most recent first."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, filename, import_type, trades_imported, trades_skipped, errors, imported_at
            FROM import_history
            ORDER BY imported_at DESC
            LIMIT ?
        ''', (limit,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def clear_import_history() -> int:
    """Clear all import history. Returns number deleted."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM import_history')
        count = cursor.fetchone()[0]
        cursor.execute('DELETE FROM import_history')
        conn.commit()
        return count


# ==================== APP SETTINGS ====================

def get_setting(key: str) -> Optional[str]:
    """Get a setting value by key."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT value FROM app_settings WHERE key = ?', (key,))
        row = cursor.fetchone()
        return row['value'] if row else None


def set_setting(key: str, value: str) -> bool:
    """Set a setting value."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO app_settings (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP
        ''', (key, value))
        conn.commit()
        return True


def get_all_settings() -> dict:
    """Get all settings as a dictionary."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT key, value FROM app_settings')
        return {row['key']: row['value'] for row in cursor.fetchall()}


def delete_setting(key: str) -> bool:
    """Delete a setting."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM app_settings WHERE key = ?', (key,))
        conn.commit()
        return cursor.rowcount > 0


# ==================== WHEEL CHAINS ====================

def get_all_wheel_chains() -> List[dict]:
    """Get all wheel chains with their linked positions."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM wheel_chains
            ORDER BY
                CASE status
                    WHEN 'HOLDING_SHARES' THEN 1
                    WHEN 'COLLECTING_PREMIUM' THEN 2
                    WHEN 'CLOSED' THEN 3
                END,
                created_at DESC
        ''')
        chains = [dict(row) for row in cursor.fetchall()]

        # Fetch linked positions for each chain
        for chain in chains:
            cursor.execute('''
                SELECT * FROM positions
                WHERE wheel_chain_id = ?
                ORDER BY open_date DESC
            ''', (chain['id'],))
            chain['positions'] = [dict(row) for row in cursor.fetchall()]

            # Calculate days in chain
            created = datetime.fromisoformat(chain['created_at'].replace('Z', '+00:00') if 'Z' in chain['created_at'] else chain['created_at'])
            chain['days_in_chain'] = (datetime.now() - created.replace(tzinfo=None)).days

            # Calculate break-even price if holding shares
            if chain['effective_cost_basis'] and chain['shares_acquired']:
                chain['break_even_price'] = chain['effective_cost_basis'] / chain['shares_acquired']
            else:
                chain['break_even_price'] = None

        return chains


def get_wheel_chain_by_id(chain_id: str) -> Optional[dict]:
    """Get a single wheel chain by ID with all linked positions."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM wheel_chains WHERE id = ?', (chain_id,))
        row = cursor.fetchone()
        if not row:
            return None

        chain = dict(row)

        # Fetch linked positions
        cursor.execute('''
            SELECT * FROM positions
            WHERE wheel_chain_id = ?
            ORDER BY open_date DESC
        ''', (chain_id,))
        chain['positions'] = [dict(row) for row in cursor.fetchall()]

        # Calculate days in chain
        created = datetime.fromisoformat(chain['created_at'].replace('Z', '+00:00') if 'Z' in chain['created_at'] else chain['created_at'])
        chain['days_in_chain'] = (datetime.now() - created.replace(tzinfo=None)).days

        # Calculate break-even price
        if chain['effective_cost_basis'] and chain['shares_acquired']:
            chain['break_even_price'] = chain['effective_cost_basis'] / chain['shares_acquired']
        else:
            chain['break_even_price'] = None

        return chain


def get_wheel_chains_by_underlying(symbol: str) -> List[dict]:
    """Get all wheel chains for a specific underlying."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM wheel_chains
            WHERE underlying = ?
            ORDER BY created_at DESC
        ''', (symbol.upper(),))
        chains = [dict(row) for row in cursor.fetchall()]

        for chain in chains:
            cursor.execute('''
                SELECT * FROM positions
                WHERE wheel_chain_id = ?
                ORDER BY open_date DESC
            ''', (chain['id'],))
            chain['positions'] = [dict(row) for row in cursor.fetchall()]

        return chains


def get_active_chain_for_underlying(symbol: str) -> Optional[dict]:
    """Get the active (non-closed) wheel chain for a specific underlying."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM wheel_chains
            WHERE underlying = ? AND status != 'CLOSED'
            ORDER BY created_at DESC
            LIMIT 1
        ''', (symbol.upper(),))
        row = cursor.fetchone()
        if row:
            chain = dict(row)
            cursor.execute('''
                SELECT * FROM positions
                WHERE wheel_chain_id = ?
                ORDER BY open_date DESC
            ''', (chain['id'],))
            chain['positions'] = [dict(row) for row in cursor.fetchall()]
            return chain
        return None


def create_wheel_chain(underlying: str) -> str:
    """Create a new wheel chain. Returns the chain ID."""
    chain_id = str(uuid.uuid4())
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO wheel_chains (id, underlying)
            VALUES (?, ?)
        ''', (chain_id, underlying.upper()))
        conn.commit()
        return chain_id


def update_wheel_chain(chain_id: str, **updates) -> bool:
    """Update a wheel chain with the provided fields."""
    if not updates:
        return False

    allowed_fields = {
        'status', 'assignment_strike', 'assignment_date', 'shares_acquired',
        'total_put_premium', 'total_call_premium', 'assignment_cost',
        'net_cost_basis', 'effective_cost_basis', 'exit_date', 'exit_price',
        'exit_type', 'realized_pnl'
    }

    valid_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    if not valid_updates:
        return False

    set_clause = ', '.join(f'{k} = ?' for k in valid_updates.keys())
    values = list(valid_updates.values()) + [chain_id]

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f'''
            UPDATE wheel_chains
            SET {set_clause}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', values)
        conn.commit()
        return cursor.rowcount > 0


def delete_wheel_chain(chain_id: str) -> bool:
    """Delete a wheel chain and unlink all positions."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Unlink positions first
        cursor.execute('UPDATE positions SET wheel_chain_id = NULL WHERE wheel_chain_id = ?', (chain_id,))
        # Unlink holdings
        cursor.execute('UPDATE stock_holdings SET wheel_chain_id = NULL, premium_adjusted_cost = NULL WHERE wheel_chain_id = ?', (chain_id,))
        # Delete chain
        cursor.execute('DELETE FROM wheel_chains WHERE id = ?', (chain_id,))
        conn.commit()
        return cursor.rowcount > 0


def link_position_to_chain(position_id: int, chain_id: str) -> bool:
    """Link a position to a wheel chain and update premium totals."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Get the position
        cursor.execute('SELECT * FROM positions WHERE id = ?', (position_id,))
        position = cursor.fetchone()
        if not position:
            return False

        # Update position with chain ID
        cursor.execute('''
            UPDATE positions SET wheel_chain_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (chain_id, position_id))

        # If position is closed/expired/assigned, add premium to chain totals
        if position['status'] in ('CLOSED', 'EXPIRED', 'ASSIGNED'):
            is_put = position['option_type'] == 'PUT'
            premium = position['premium_collected'] * position['quantity'] * 100
            if is_put:
                cursor.execute('''
                    UPDATE wheel_chains
                    SET total_put_premium = total_put_premium + ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (premium, chain_id))
            else:
                cursor.execute('''
                    UPDATE wheel_chains
                    SET total_call_premium = total_call_premium + ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (premium, chain_id))

            # Recalculate effective cost basis if holding shares
            _recalculate_chain_metrics(cursor, chain_id)

        conn.commit()
        return True


def unlink_position_from_chain(position_id: int) -> bool:
    """Unlink a position from its wheel chain and update premium totals."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Get the position with chain ID
        cursor.execute('SELECT * FROM positions WHERE id = ?', (position_id,))
        position = cursor.fetchone()
        if not position or not position['wheel_chain_id']:
            return False

        chain_id = position['wheel_chain_id']

        # If position was closed, subtract premium from chain totals
        if position['status'] in ('CLOSED', 'EXPIRED', 'ASSIGNED'):
            is_put = position['option_type'] == 'PUT'
            premium = position['premium_collected'] * position['quantity'] * 100
            if is_put:
                cursor.execute('''
                    UPDATE wheel_chains
                    SET total_put_premium = total_put_premium - ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (premium, chain_id))
            else:
                cursor.execute('''
                    UPDATE wheel_chains
                    SET total_call_premium = total_call_premium - ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (premium, chain_id))

        # Unlink the position
        cursor.execute('''
            UPDATE positions SET wheel_chain_id = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (position_id,))

        # Recalculate chain metrics
        _recalculate_chain_metrics(cursor, chain_id)

        conn.commit()
        return True


def add_premium_to_chain(chain_id: str, premium: float, is_put: bool) -> bool:
    """Add premium to a chain's totals. Called when a linked position closes."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_put:
            cursor.execute('''
                UPDATE wheel_chains
                SET total_put_premium = total_put_premium + ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (premium, chain_id))
        else:
            cursor.execute('''
                UPDATE wheel_chains
                SET total_call_premium = total_call_premium + ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (premium, chain_id))

        # Recalculate effective cost basis if holding shares
        _recalculate_chain_metrics(cursor, chain_id)

        conn.commit()
        return cursor.rowcount > 0


def _recalculate_chain_metrics(cursor, chain_id: str):
    """Recalculate cost basis metrics for a chain. Internal helper."""
    cursor.execute('SELECT * FROM wheel_chains WHERE id = ?', (chain_id,))
    chain = cursor.fetchone()
    if not chain:
        return

    # Only recalculate if holding shares (has assignment)
    if chain['status'] == 'HOLDING_SHARES' and chain['assignment_cost']:
        net_cost_basis = chain['assignment_cost'] - chain['total_put_premium']
        effective_cost_basis = net_cost_basis - chain['total_call_premium']

        cursor.execute('''
            UPDATE wheel_chains
            SET net_cost_basis = ?, effective_cost_basis = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (net_cost_basis, effective_cost_basis, chain_id))

        # Also update the linked stock holding
        if chain['shares_acquired']:
            premium_adjusted_cost = effective_cost_basis / chain['shares_acquired']
            cursor.execute('''
                UPDATE stock_holdings
                SET premium_adjusted_cost = ?
                WHERE wheel_chain_id = ?
            ''', (premium_adjusted_cost, chain_id))


def record_chain_assignment(
    chain_id: str,
    strike: float,
    shares: int = 100,
    assignment_date: Optional[str] = None
) -> bool:
    """Record an assignment event on a wheel chain."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Get current chain data
        cursor.execute('SELECT * FROM wheel_chains WHERE id = ?', (chain_id,))
        chain = cursor.fetchone()
        if not chain:
            return False

        assignment_cost = strike * shares
        net_cost_basis = assignment_cost - chain['total_put_premium']
        effective_cost_basis = net_cost_basis - chain['total_call_premium']

        cursor.execute('''
            UPDATE wheel_chains
            SET status = 'HOLDING_SHARES',
                assignment_strike = ?,
                assignment_date = ?,
                shares_acquired = ?,
                assignment_cost = ?,
                net_cost_basis = ?,
                effective_cost_basis = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (
            strike,
            assignment_date or date.today().isoformat(),
            shares,
            assignment_cost,
            net_cost_basis,
            effective_cost_basis,
            chain_id
        ))

        # Create or update stock holding with premium-adjusted cost
        underlying = chain['underlying']
        premium_adjusted_cost = effective_cost_basis / shares

        cursor.execute('''
            INSERT INTO stock_holdings (symbol, quantity, avg_cost, premium_adjusted_cost, wheel_chain_id, last_synced)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(symbol) DO UPDATE SET
                quantity = stock_holdings.quantity + excluded.quantity,
                avg_cost = COALESCE(excluded.avg_cost, stock_holdings.avg_cost),
                premium_adjusted_cost = excluded.premium_adjusted_cost,
                wheel_chain_id = excluded.wheel_chain_id,
                last_synced = CURRENT_TIMESTAMP
        ''', (underlying, shares, strike, premium_adjusted_cost, chain_id))

        conn.commit()
        return True


def record_chain_exit(
    chain_id: str,
    exit_price: float,
    exit_type: str,
    exit_date: Optional[str] = None
) -> bool:
    """Record an exit event (shares called away or sold) on a wheel chain."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Get current chain data
        cursor.execute('SELECT * FROM wheel_chains WHERE id = ?', (chain_id,))
        chain = cursor.fetchone()
        if not chain or chain['status'] != 'HOLDING_SHARES':
            return False

        # Calculate realized P&L
        # P&L = (exit_price * shares) - effective_cost_basis
        shares = chain['shares_acquired'] or 100
        proceeds = exit_price * shares
        realized_pnl = proceeds - (chain['effective_cost_basis'] or 0)

        cursor.execute('''
            UPDATE wheel_chains
            SET status = 'CLOSED',
                exit_date = ?,
                exit_price = ?,
                exit_type = ?,
                realized_pnl = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (
            exit_date or date.today().isoformat(),
            exit_price,
            exit_type,
            realized_pnl,
            chain_id
        ))

        # Update or remove stock holding
        underlying = chain['underlying']
        cursor.execute('''
            UPDATE stock_holdings
            SET quantity = quantity - ?,
                wheel_chain_id = NULL,
                premium_adjusted_cost = NULL,
                last_synced = CURRENT_TIMESTAMP
            WHERE symbol = ?
        ''', (shares, underlying))

        # Remove holding if quantity is 0 or negative
        cursor.execute('DELETE FROM stock_holdings WHERE symbol = ? AND quantity <= 0', (underlying,))

        conn.commit()
        return True


def get_positions_for_chain(chain_id: str) -> List[dict]:
    """Get all positions linked to a wheel chain."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM positions
            WHERE wheel_chain_id = ?
            ORDER BY open_date DESC
        ''', (chain_id,))
        return [dict(row) for row in cursor.fetchall()]


# ==================== AUTO-DETECTED WHEEL ANALYSIS ====================

def get_auto_wheel_analysis() -> List[dict]:
    """
    Automatically analyze all positions to detect wheel patterns and calculate
    premium accumulation per underlying. No manual linking required.

    This groups all CSP/CC positions by underlying and calculates:
    - Total put premium collected (all closed CSPs)
    - Total call premium collected (all closed CCs)
    - Current status (collecting premium vs holding shares)
    - Adjusted cost basis if shares are held
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Get all unique underlyings with options activity
        cursor.execute('''
            SELECT DISTINCT underlying FROM positions
            WHERE strategy_type IN ('CSP', 'CC')
            ORDER BY underlying
        ''')
        underlyings = [row['underlying'] for row in cursor.fetchall()]

        wheel_data = []

        for symbol in underlyings:
            # Get all positions for this underlying
            cursor.execute('''
                SELECT * FROM positions
                WHERE underlying = ? AND strategy_type IN ('CSP', 'CC')
                ORDER BY open_date ASC
            ''', (symbol,))
            positions = [dict(row) for row in cursor.fetchall()]

            # Get stock holding for this symbol
            cursor.execute('SELECT * FROM stock_holdings WHERE symbol = ?', (symbol,))
            holding_row = cursor.fetchone()
            holding = dict(holding_row) if holding_row else None

            # Calculate premiums
            put_positions = [p for p in positions if p['option_type'] == 'PUT']
            call_positions = [p for p in positions if p['option_type'] == 'CALL']

            # Calculate total put premium (from closed positions)
            closed_puts = [p for p in put_positions if p['status'] in ('CLOSED', 'EXPIRED', 'ASSIGNED')]
            total_put_premium = sum(
                p['premium_collected'] * abs(p['quantity']) * 100
                for p in closed_puts
            )

            # Calculate total call premium (from closed positions)
            closed_calls = [p for p in call_positions if p['status'] in ('CLOSED', 'EXPIRED', 'ASSIGNED')]
            total_call_premium = sum(
                p['premium_collected'] * abs(p['quantity']) * 100
                for p in closed_calls
            )

            # Open positions (still collecting premium)
            open_puts = [p for p in put_positions if p['status'] == 'OPEN']
            open_calls = [p for p in call_positions if p['status'] == 'OPEN']

            # Pending premium (from open positions)
            pending_put_premium = sum(
                p['premium_collected'] * abs(p['quantity']) * 100
                for p in open_puts
            )
            pending_call_premium = sum(
                p['premium_collected'] * abs(p['quantity']) * 100
                for p in open_calls
            )

            # Detect assigned puts
            assigned_puts = [p for p in put_positions if p['status'] == 'ASSIGNED']

            # Determine status
            if holding and holding['quantity'] > 0:
                status = 'HOLDING_SHARES'
            elif open_puts or open_calls:
                status = 'COLLECTING_PREMIUM'
            elif positions:
                status = 'CLOSED'
            else:
                continue  # No relevant activity

            # Calculate cost basis if holding shares
            assignment_cost = None
            net_cost_basis = None
            effective_cost_basis = None
            break_even_price = None
            shares_held = 0
            avg_cost = None

            if holding and holding['quantity'] > 0:
                shares_held = holding['quantity']
                avg_cost = holding['avg_cost']

                if avg_cost:
                    assignment_cost = avg_cost * shares_held
                    net_cost_basis = assignment_cost - total_put_premium
                    effective_cost_basis = net_cost_basis - total_call_premium
                    break_even_price = effective_cost_basis / shares_held if shares_held > 0 else None

            # Calculate earliest and latest dates
            if positions:
                first_position_date = min(p['open_date'] for p in positions)
                last_activity_date = max(
                    p['close_date'] or p['open_date'] for p in positions
                )
            else:
                first_position_date = None
                last_activity_date = None

            # Days active
            if first_position_date:
                first_date = datetime.strptime(first_position_date, '%Y-%m-%d')
                days_active = (datetime.now() - first_date).days
            else:
                days_active = 0

            wheel_entry = {
                'id': f'auto_{symbol}',  # Auto-generated ID
                'underlying': symbol,
                'status': status,
                'total_put_premium': total_put_premium,
                'total_call_premium': total_call_premium,
                'total_premium': total_put_premium + total_call_premium,
                'pending_put_premium': pending_put_premium,
                'pending_call_premium': pending_call_premium,
                'pending_premium': pending_put_premium + pending_call_premium,
                'assignment_cost': assignment_cost,
                'net_cost_basis': net_cost_basis,
                'effective_cost_basis': effective_cost_basis,
                'break_even_price': break_even_price,
                'shares_held': shares_held,
                'avg_cost': avg_cost,
                'positions': positions,
                'open_positions': open_puts + open_calls,
                'closed_positions': closed_puts + closed_calls,
                'assigned_positions': assigned_puts,
                'put_count': len(put_positions),
                'call_count': len(call_positions),
                'open_put_count': len(open_puts),
                'open_call_count': len(open_calls),
                'first_position_date': first_position_date,
                'last_activity_date': last_activity_date,
                'days_active': days_active,
                'current_price': holding['current_price'] if holding else None,
                'unrealized_pnl': None
            }

            # Calculate unrealized P&L if holding shares with current price
            if holding and holding['current_price'] and effective_cost_basis:
                current_value = holding['current_price'] * shares_held
                wheel_entry['unrealized_pnl'] = current_value - effective_cost_basis

            wheel_data.append(wheel_entry)

        # Sort: holding shares first, then collecting premium, then closed
        status_order = {'HOLDING_SHARES': 0, 'COLLECTING_PREMIUM': 1, 'CLOSED': 2}
        wheel_data.sort(key=lambda x: (status_order.get(x['status'], 3), -x['total_premium']))

        return wheel_data


def get_auto_wheel_summary() -> dict:
    """Get summary statistics for auto-detected wheel analysis."""
    wheel_data = get_auto_wheel_analysis()

    total_premium = sum(w['total_premium'] for w in wheel_data)
    total_pending = sum(w['pending_premium'] for w in wheel_data)

    holding_shares = [w for w in wheel_data if w['status'] == 'HOLDING_SHARES']
    collecting = [w for w in wheel_data if w['status'] == 'COLLECTING_PREMIUM']

    avg_cost_reduction = 0
    if holding_shares:
        reductions = [
            (w['assignment_cost'] - w['effective_cost_basis'])
            for w in holding_shares
            if w['assignment_cost'] and w['effective_cost_basis']
        ]
        if reductions:
            avg_cost_reduction = sum(reductions) / len(reductions)

    return {
        'total_underlyings': len(wheel_data),
        'holding_shares_count': len(holding_shares),
        'collecting_premium_count': len(collecting),
        'total_premium_collected': total_premium,
        'total_pending_premium': total_pending,
        'average_cost_reduction': avg_cost_reduction
    }


# Initialize DB on module load
if os.path.exists(settings.db_path):
    # DB exists, run migrations to add any new columns/tables
    init_db()
else:
    # Create directory if needed
    os.makedirs(os.path.dirname(settings.db_path), exist_ok=True)
    init_db()
