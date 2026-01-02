"""PostgreSQL database operations for Options Buddy production environment.

This module provides user-scoped database operations for multi-tenant support.
All data is isolated by user_id to ensure users only see their own data.
"""

import asyncpg
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
import uuid

from config import settings


# Connection pool
_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """Get or create the connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=2,
            max_size=10
        )
    return _pool


async def close_pool():
    """Close the connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def get_connection():
    """Get a connection from the pool."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


async def init_db():
    """Initialize database tables."""
    async with get_connection() as conn:
        # Users table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email TEXT UNIQUE NOT NULL,
                is_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                last_login TIMESTAMPTZ
            )
        ''')

        # Email whitelist (invite-only access)
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS email_whitelist (
                email TEXT PRIMARY KEY,
                added_by UUID REFERENCES users(id),
                added_at TIMESTAMPTZ DEFAULT NOW()
            )
        ''')

        # Magic link tokens
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS magic_tokens (
                token TEXT PRIMARY KEY,
                user_id UUID REFERENCES users(id),
                expires_at TIMESTAMPTZ NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        ''')

        # Positions table with user_id
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS positions (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id),
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
                wheel_chain_id TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        ''')

        # Stock holdings table with user_id
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS stock_holdings (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id),
                symbol TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                avg_cost REAL,
                current_price REAL,
                market_value REAL,
                unrealized_pnl REAL,
                ibkr_con_id INTEGER,
                wheel_chain_id TEXT,
                premium_adjusted_cost REAL,
                last_synced TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, symbol)
            )
        ''')

        # Watchlists table with user_id
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS watchlists (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id),
                name TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, name)
            )
        ''')

        # Watchlist symbols table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS watchlist_symbols (
                id SERIAL PRIMARY KEY,
                watchlist_id INTEGER NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
                symbol TEXT NOT NULL,
                added_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(watchlist_id, symbol)
            )
        ''')

        # Trades table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS trades (
                id SERIAL PRIMARY KEY,
                position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
                action TEXT NOT NULL CHECK(action IN ('OPEN', 'CLOSE', 'ROLL_CLOSE', 'ROLL_OPEN', 'ADJUST')),
                price REAL NOT NULL,
                quantity INTEGER NOT NULL,
                fees REAL DEFAULT 0,
                trade_date TIMESTAMPTZ NOT NULL,
                notes TEXT
            )
        ''')

        # User settings table (key-value store with user_id)
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id UUID NOT NULL REFERENCES users(id),
                key TEXT NOT NULL,
                value TEXT,
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (user_id, key)
            )
        ''')

        # Wheel chains table with user_id
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS wheel_chains (
                id TEXT PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id),
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
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        ''')

        # Create indexes for performance
        await conn.execute('CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id)')
        await conn.execute('CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(user_id, status)')
        await conn.execute('CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON stock_holdings(user_id)')
        await conn.execute('CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id)')
        await conn.execute('CREATE INDEX IF NOT EXISTS idx_wheel_chains_user_id ON wheel_chains(user_id)')
        await conn.execute('CREATE INDEX IF NOT EXISTS idx_magic_tokens_expires ON magic_tokens(expires_at)')


# ==================== USER MANAGEMENT ====================

async def is_email_whitelisted(email: str) -> bool:
    """Check if an email is in the whitelist."""
    async with get_connection() as conn:
        result = await conn.fetchval(
            'SELECT 1 FROM email_whitelist WHERE LOWER(email) = LOWER($1)',
            email
        )
        return result is not None


async def add_email_to_whitelist(email: str, added_by: Optional[str] = None) -> bool:
    """Add an email to the whitelist."""
    async with get_connection() as conn:
        try:
            await conn.execute(
                'INSERT INTO email_whitelist (email, added_by) VALUES (LOWER($1), $2)',
                email, added_by
            )
            return True
        except asyncpg.UniqueViolationError:
            return False


async def remove_email_from_whitelist(email: str) -> bool:
    """Remove an email from the whitelist."""
    async with get_connection() as conn:
        result = await conn.execute(
            'DELETE FROM email_whitelist WHERE LOWER(email) = LOWER($1)',
            email
        )
        return 'DELETE 1' in result


async def get_whitelist() -> List[Dict[str, Any]]:
    """Get all whitelisted emails."""
    async with get_connection() as conn:
        rows = await conn.fetch(
            'SELECT email, added_at FROM email_whitelist ORDER BY added_at DESC'
        )
        return [dict(row) for row in rows]


async def get_or_create_user(email: str) -> Dict[str, Any]:
    """Get existing user or create new one if whitelisted."""
    async with get_connection() as conn:
        # Check if user exists
        user = await conn.fetchrow(
            'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
            email
        )

        if user:
            return dict(user)

        # Check whitelist
        if not await is_email_whitelisted(email):
            raise ValueError("Email not whitelisted")

        # Create new user
        user_id = str(uuid.uuid4())

        # First user becomes admin
        is_first_user = await conn.fetchval('SELECT COUNT(*) FROM users') == 0

        await conn.execute(
            '''INSERT INTO users (id, email, is_admin) VALUES ($1, LOWER($2), $3)''',
            user_id, email, is_first_user
        )

        user = await conn.fetchrow('SELECT * FROM users WHERE id = $1', user_id)
        return dict(user)


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user by ID."""
    async with get_connection() as conn:
        row = await conn.fetchrow('SELECT * FROM users WHERE id = $1', user_id)
        return dict(row) if row else None


async def update_user_last_login(user_id: str):
    """Update user's last login timestamp."""
    async with get_connection() as conn:
        await conn.execute(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            user_id
        )


# ==================== MAGIC TOKEN MANAGEMENT ====================

async def create_magic_token(user_id: str, token: str, expires_minutes: int = 10) -> bool:
    """Create a magic link token."""
    async with get_connection() as conn:
        expires_at = datetime.utcnow() + timedelta(minutes=expires_minutes)
        await conn.execute(
            '''INSERT INTO magic_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)''',
            token, user_id, expires_at
        )
        return True


async def verify_magic_token(token: str) -> Optional[str]:
    """Verify a magic token and return user_id if valid."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            '''SELECT user_id FROM magic_tokens
               WHERE token = $1 AND used = FALSE AND expires_at > NOW()''',
            token
        )

        if row:
            # Mark token as used
            await conn.execute(
                'UPDATE magic_tokens SET used = TRUE WHERE token = $1',
                token
            )
            return str(row['user_id'])

        return None


async def cleanup_expired_tokens():
    """Remove expired magic tokens."""
    async with get_connection() as conn:
        await conn.execute(
            'DELETE FROM magic_tokens WHERE expires_at < NOW()'
        )


# ==================== POSITIONS (User-Scoped) ====================

async def get_open_positions(user_id: str) -> List[Dict[str, Any]]:
    """Get all open option positions for a user."""
    async with get_connection() as conn:
        rows = await conn.fetch(
            '''SELECT * FROM positions
               WHERE user_id = $1 AND status = 'OPEN'
               ORDER BY expiry ASC''',
            user_id
        )
        return [dict(row) for row in rows]


async def get_closed_positions(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Get closed positions for a user."""
    async with get_connection() as conn:
        rows = await conn.fetch(
            '''SELECT * FROM positions
               WHERE user_id = $1 AND status != 'OPEN'
               ORDER BY close_date DESC
               LIMIT $2''',
            user_id, limit
        )
        return [dict(row) for row in rows]


async def get_position_by_id(user_id: str, position_id: int) -> Optional[Dict[str, Any]]:
    """Get a single position by ID, scoped to user."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            'SELECT * FROM positions WHERE id = $1 AND user_id = $2',
            position_id, user_id
        )
        return dict(row) if row else None


async def create_position(
    user_id: str,
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
    """Create a new position for a user."""
    async with get_connection() as conn:
        # Check for existing position with same IBKR con_id
        if ibkr_con_id:
            existing = await conn.fetchval(
                '''SELECT id FROM positions
                   WHERE user_id = $1 AND ibkr_con_id = $2 AND status = 'OPEN' ''',
                user_id, ibkr_con_id
            )
            if existing:
                # Update existing position
                await conn.execute(
                    '''UPDATE positions SET
                       quantity = $1, premium_collected = $2, updated_at = NOW()
                       WHERE id = $3''',
                    quantity, premium_collected, existing
                )
                return existing

        # Create new position
        position_id = await conn.fetchval(
            '''INSERT INTO positions (
                user_id, underlying, option_type, strike, expiry, quantity,
                premium_collected, strategy_type, open_date, notes, ibkr_con_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id''',
            user_id,
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
        )
        return position_id


async def close_position(
    user_id: str,
    position_id: int,
    close_price: float,
    close_date: Optional[str] = None,
    status: str = 'CLOSED'
) -> bool:
    """Close a position."""
    async with get_connection() as conn:
        result = await conn.execute(
            '''UPDATE positions
               SET close_date = $1, close_price = $2, status = $3, updated_at = NOW()
               WHERE id = $4 AND user_id = $5''',
            close_date or date.today().isoformat(),
            close_price,
            status,
            position_id,
            user_id
        )
        return 'UPDATE 1' in result


# ==================== STOCK HOLDINGS (User-Scoped) ====================

async def get_stock_holdings(user_id: str) -> List[Dict[str, Any]]:
    """Get all stock holdings for a user."""
    async with get_connection() as conn:
        rows = await conn.fetch(
            'SELECT * FROM stock_holdings WHERE user_id = $1 ORDER BY symbol',
            user_id
        )
        return [dict(row) for row in rows]


async def upsert_stock_holding(
    user_id: str,
    symbol: str,
    quantity: int,
    avg_cost: Optional[float] = None,
    current_price: Optional[float] = None,
    ibkr_con_id: Optional[int] = None
) -> int:
    """Insert or update a stock holding."""
    market_value = (quantity * current_price) if current_price else None
    unrealized_pnl = (quantity * (current_price - avg_cost)) if (current_price and avg_cost) else None

    async with get_connection() as conn:
        result = await conn.fetchval(
            '''INSERT INTO stock_holdings (user_id, symbol, quantity, avg_cost, current_price,
                                          market_value, unrealized_pnl, ibkr_con_id, last_synced)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
               ON CONFLICT (user_id, symbol) DO UPDATE SET
                   quantity = EXCLUDED.quantity,
                   avg_cost = COALESCE(EXCLUDED.avg_cost, stock_holdings.avg_cost),
                   current_price = COALESCE(EXCLUDED.current_price, stock_holdings.current_price),
                   market_value = EXCLUDED.market_value,
                   unrealized_pnl = EXCLUDED.unrealized_pnl,
                   ibkr_con_id = COALESCE(EXCLUDED.ibkr_con_id, stock_holdings.ibkr_con_id),
                   last_synced = NOW()
               RETURNING id''',
            user_id, symbol.upper(), quantity, avg_cost, current_price,
            market_value, unrealized_pnl, ibkr_con_id
        )
        return result


# ==================== WATCHLISTS (User-Scoped) ====================

async def get_watchlists(user_id: str) -> List[Dict[str, Any]]:
    """Get all watchlists with their symbols for a user."""
    async with get_connection() as conn:
        rows = await conn.fetch(
            'SELECT * FROM watchlists WHERE user_id = $1 ORDER BY name',
            user_id
        )
        watchlists = [dict(row) for row in rows]

        for wl in watchlists:
            symbols = await conn.fetch(
                '''SELECT symbol FROM watchlist_symbols
                   WHERE watchlist_id = $1 ORDER BY symbol''',
                wl['id']
            )
            wl['symbols'] = [row['symbol'] for row in symbols]

        return watchlists


async def create_watchlist(
    user_id: str,
    name: str,
    description: Optional[str] = None,
    symbols: Optional[List[str]] = None
) -> int:
    """Create a new watchlist."""
    async with get_connection() as conn:
        watchlist_id = await conn.fetchval(
            '''INSERT INTO watchlists (user_id, name, description)
               VALUES ($1, $2, $3) RETURNING id''',
            user_id, name, description
        )

        if symbols:
            for symbol in symbols:
                await conn.execute(
                    '''INSERT INTO watchlist_symbols (watchlist_id, symbol)
                       VALUES ($1, $2) ON CONFLICT DO NOTHING''',
                    watchlist_id, symbol.upper()
                )

        return watchlist_id


# ==================== USER SETTINGS (User-Scoped) ====================

async def get_setting(user_id: str, key: str) -> Optional[str]:
    """Get a setting value by key for a user."""
    async with get_connection() as conn:
        result = await conn.fetchval(
            'SELECT value FROM user_settings WHERE user_id = $1 AND key = $2',
            user_id, key
        )
        return result


async def set_setting(user_id: str, key: str, value: str) -> bool:
    """Set a setting value for a user."""
    async with get_connection() as conn:
        await conn.execute(
            '''INSERT INTO user_settings (user_id, key, value, updated_at)
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT (user_id, key) DO UPDATE SET
                   value = EXCLUDED.value,
                   updated_at = NOW()''',
            user_id, key, value
        )
        return True


async def get_all_settings(user_id: str) -> Dict[str, str]:
    """Get all settings as a dictionary for a user."""
    async with get_connection() as conn:
        rows = await conn.fetch(
            'SELECT key, value FROM user_settings WHERE user_id = $1',
            user_id
        )
        return {row['key']: row['value'] for row in rows}


async def delete_setting(user_id: str, key: str) -> bool:
    """Delete a setting for a user."""
    async with get_connection() as conn:
        result = await conn.execute(
            'DELETE FROM user_settings WHERE user_id = $1 AND key = $2',
            user_id, key
        )
        return 'DELETE 1' in result


# ==================== PERFORMANCE STATS (User-Scoped) ====================

async def get_performance_stats(user_id: str) -> Dict[str, Any]:
    """Calculate performance statistics from closed trades for a user."""
    async with get_connection() as conn:
        rows = await conn.fetch(
            '''SELECT underlying, option_type, premium_collected, close_price,
                      quantity, strategy_type, open_date, close_date
               FROM positions
               WHERE user_id = $1 AND status IN ('CLOSED', 'EXPIRED', 'ASSIGNED')''',
            user_id
        )

        if not rows:
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
        for row in rows:
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
