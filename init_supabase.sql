-- Initialize Supabase PostgreSQL database for Options Buddy
-- Creates all necessary tables and whitelists emails

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Email whitelist table
CREATE TABLE IF NOT EXISTS email_whitelist (
    email VARCHAR(255) PRIMARY KEY,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Magic tokens table
CREATE TABLE IF NOT EXISTS magic_tokens (
    token VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account VARCHAR(50),
    symbol VARCHAR(50),
    position FLOAT,
    market_price FLOAT,
    market_value FLOAT,
    average_cost FLOAT,
    unrealized_pnl FLOAT,
    realized_pnl FLOAT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI settings table
CREATE TABLE IF NOT EXISTS ai_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50),
    model VARCHAR(100),
    api_key TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, symbol)
);

-- Wheel chains table
CREATE TABLE IF NOT EXISTS wheel_chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    shares_per_contract INTEGER NOT NULL,
    initial_cash FLOAT NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wheel chain legs table
CREATE TABLE IF NOT EXISTS wheel_chain_legs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id UUID REFERENCES wheel_chains(id) ON DELETE CASCADE,
    leg_type VARCHAR(20) NOT NULL,
    strike FLOAT,
    premium FLOAT,
    shares INTEGER,
    entry_date TIMESTAMP WITH TIME ZONE,
    exit_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Whitelist the two admin emails
INSERT INTO email_whitelist (email, added_at)
VALUES
  ('komalamee@gmail.com', NOW()),
  ('hjjamin@gmail.com', NOW())
ON CONFLICT (email) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wheel_chains_user_id ON wheel_chains(user_id);
CREATE INDEX IF NOT EXISTS idx_wheel_chain_legs_chain_id ON wheel_chain_legs(chain_id);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_email ON magic_tokens(email);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_expires_at ON magic_tokens(expires_at);
