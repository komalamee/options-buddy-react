"""FastAPI backend for Options Buddy React app."""

from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Tuple
from datetime import datetime, date, time
import pytz
import logging
import httpx
import json
import csv
import io
import re

from config import settings
from put_call_parity import (
    calculate_put_call_parity_violation,
    calculate_synthetic_prices,
    detect_statistical_outliers,
    calculate_opportunity_score as calc_parity_opportunity_score
)
from database import (
    get_open_positions,
    get_closed_positions,
    get_position_by_id,
    create_position,
    create_closed_position,
    close_position,
    update_position,
    clear_all_positions,
    get_stock_holdings,
    upsert_stock_holding,
    delete_stock_holding,
    get_watchlists,
    create_watchlist,
    add_symbol_to_watchlist,
    remove_symbol_from_watchlist,
    get_performance_stats,
    get_open_positions_with_pnl,
    record_import,
    get_import_history,
    clear_import_history,
    get_setting,
    set_setting,
    get_all_settings,
    init_db,
    # Wheel chain functions (manual)
    get_all_wheel_chains,
    get_wheel_chain_by_id,
    get_wheel_chains_by_underlying,
    get_active_chain_for_underlying,
    create_wheel_chain as db_create_wheel_chain,
    update_wheel_chain,
    delete_wheel_chain,
    link_position_to_chain,
    unlink_position_from_chain,
    add_premium_to_chain,
    record_chain_assignment,
    record_chain_exit,
    get_positions_for_chain,
    # Auto wheel analysis functions
    get_auto_wheel_analysis,
    get_auto_wheel_summary
)
from ibkr_service import get_ibkr_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Options Buddy API",
    description="Backend API for Options Buddy trading dashboard",
    version="1.0.0"
)

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== PYDANTIC MODELS ====================

class ConnectionRequest(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = None
    client_id: Optional[int] = None


class PositionCreate(BaseModel):
    underlying: str
    option_type: str  # CALL or PUT
    strike: float
    expiry: str
    quantity: int
    premium_collected: float
    strategy_type: str
    open_date: Optional[str] = None
    notes: Optional[str] = None


class PositionClose(BaseModel):
    close_price: float
    close_date: Optional[str] = None
    status: Optional[str] = "CLOSED"


class PositionUpdate(BaseModel):
    underlying: Optional[str] = None
    option_type: Optional[str] = None
    strike: Optional[float] = None
    expiry: Optional[str] = None
    quantity: Optional[int] = None
    premium_collected: Optional[float] = None
    strategy_type: Optional[str] = None
    notes: Optional[str] = None


class StockHoldingUpsert(BaseModel):
    symbol: str
    quantity: int
    avg_cost: Optional[float] = None
    current_price: Optional[float] = None


class WatchlistCreate(BaseModel):
    name: str
    description: Optional[str] = None
    symbols: Optional[List[str]] = None


class WatchlistSymbol(BaseModel):
    symbol: str


class ScanRequest(BaseModel):
    symbols: List[str]
    strategy: str  # csp, cc, etc.
    min_dte: int = 14
    max_dte: int = 45
    min_delta: float = 0.15
    max_delta: float = 0.35


class ParityScanRequest(BaseModel):
    symbol: str
    min_dte: int = 7
    max_dte: int = 45
    risk_free_rate: float = 0.045
    parity_threshold: float = 0.02
    max_results: int = 10


class MispricedOption(BaseModel):
    symbol: str
    strike: float
    expiry: str
    dte: int

    # Call data
    call_bid: float
    call_ask: float
    call_mid: float
    call_iv: Optional[float]
    call_volume: int

    # Put data
    put_bid: float
    put_ask: float
    put_mid: float
    put_iv: Optional[float]
    put_volume: int

    # Put-Call Parity Analysis
    parity_value: float
    market_spread: float
    violation_dollars: float
    violation_pct: float
    is_violation: bool
    arbitrage_type: str

    # Synthetic prices
    synthetic_call: float
    synthetic_put: float

    # Statistical outlier detection
    iv_z_score: float
    is_iv_outlier: bool

    # Greeks
    avg_delta: Optional[float]

    # Scoring
    opportunity_score: int


class ParityScanResponse(BaseModel):
    symbol: str
    stock_price: float
    scan_timestamp: str
    risk_free_rate: float
    avg_iv: float
    iv_std_dev: float
    opportunities: List[MispricedOption]


class AISettingsUpdate(BaseModel):
    provider: str  # anthropic, openai, google, xai, perplexity
    api_key: str
    model: Optional[str] = None  # specific model ID


class SettingUpdate(BaseModel):
    key: str
    value: str


class ChatMessage(BaseModel):
    role: str  # user or assistant
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


# ==================== WHEEL CHAIN MODELS ====================

class WheelChainCreate(BaseModel):
    underlying: str


class WheelChainAssignment(BaseModel):
    strike: float
    shares: int = 100
    assignment_date: Optional[str] = None


class WheelChainExit(BaseModel):
    exit_price: float
    exit_type: str  # CALLED_AWAY or SOLD
    exit_date: Optional[str] = None


# System prompt for the AI advisor - NOT user configurable
AI_SYSTEM_PROMPT = """You are an expert options trading advisor integrated into Options Buddy, a premium-selling focused options analysis platform.

## Core Philosophy
You help users **earn income through option premiums** while working toward their long-term stock accumulation goals. The app uses Black-Scholes pricing and IV/HV analysis to find mispriced (overpriced) options that are ideal for premium sellers.

## Your Capabilities
You have real-time access to the user's:
- **Open option positions** (CSPs, covered calls, spreads)
- **Stock holdings** with share counts and cost basis
- **Performance stats** (win rate, total P&L, trade history)
- **Covered call lots available** (shares ÷ 100)
- **Scanner results** with BS model pricing, IV/HV ratios, and Greeks

## Premium Selling Strategies
Focus on these strategies based on user's situation:

1. **Cash-Secured Puts (CSPs)**: For stocks the user WANTS to own
   - Ideal: Sell puts on stocks they'd buy anyway at a lower price
   - Look for IV > HV (overpriced premiums)
   - Target delta 0.15-0.30 for good probability of profit

2. **Covered Calls (CCs)**: For stocks the user ALREADY owns
   - Generate income while holding long-term positions
   - Strike selection based on user's exit willingness
   - "Grow position while earning premium" = sell OTM calls, buy more shares with premium

3. **The Wheel Strategy**: CSP → Assignment → CC → Called Away → Repeat
   - Perfect for users wanting to accumulate specific stocks
   - Track cost basis reduction from premiums collected

## Black-Scholes Model Analysis
The scanner uses Black-Scholes to calculate theoretical option prices. Use this to identify mispriced options:

**Interpreting BS vs Market Price:**
- **Overpriced (SELL opportunity)**: Market price > BS theoretical by 10%+ — ideal for premium sellers
- **Fairly priced**: Market price within ±10% of BS price — acceptable but no edge
- **Underpriced (AVOID selling)**: Market price < BS theoretical — poor risk/reward for sellers

**Why options become overpriced:**
- IV spike (earnings, news, market fear) inflates premiums temporarily
- IV > HV means the market expects MORE volatility than historically occurs
- After IV crush (post-earnings), prices revert toward BS theoretical

**When recommending trades, always mention:**
- Whether the option appears overpriced vs BS model
- The IV/HV ratio and what it implies
- Expected IV crush opportunities (e.g., post-earnings)

## Finding Arbitrage/Mispricing Opportunities
The app's core value is identifying overpriced options using:
- **IV/HV Ratio > 1.2**: Implied volatility exceeds historical — option is expensive, edge for sellers
- **IV/HV Ratio 1.0-1.2**: Fairly priced — no significant edge
- **IV/HV Ratio < 1.0**: Underpriced — avoid selling, poor premium for risk taken
- **BS Price Gap**: Market price significantly above theoretical = selling opportunity

## Goal-Aware Recommendations
Always consider the user's long-term goals when advising:
- If they want to GROW a position: Suggest CSPs to accumulate + CCs that are unlikely to be called
- If they want to HOLD a position: Conservative OTM covered calls (70%+ probability of keeping shares)
- If they're WILLING TO SELL: More aggressive ITM/ATM covered calls for max premium
- If they're BUILDING a position: CSPs at their target buy price

## Response Guidelines
- Always reference their ACTUAL positions and holdings from the portfolio context
- Give SPECIFIC strikes, expirations, and premium estimates
- Explain WHY an option is attractive (IV/HV ratio, BS mispricing, probability of profit)
- Calculate premium as % of collateral (annualized yield)
- Warn about assignment risk, earnings dates, ex-dividend dates
- Suggest position sizes based on their holdings and risk tolerance

## Key Metrics to Mention
- **Premium / Collateral** = Return on capital
- **DTE (Days to Expiry)**: 30-45 DTE is optimal for theta decay
- **Delta**: Probability proxy (0.30 delta ≈ 70% profit probability for sellers)
- **IV/HV Ratio**: >1.2 means option is overpriced (edge for sellers)
- **BS Price vs Market**: >10% gap = mispricing opportunity

## Format
- Use **bold** for key numbers and terms
- Use bullet points for lists
- Keep responses concise but complete
- Include specific actionable suggestions

Remember: You provide strategy analysis, not financial advice. Users should verify all data and do their own due diligence before trading."""


# ==================== HEALTH CHECK ====================

@app.get("/")
def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "Options Buddy API is running"}


@app.get("/health")
def health_check():
    """Detailed health check."""
    ibkr = get_ibkr_service()
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "ibkr_connected": ibkr.is_connected,
        "db_path": settings.db_path
    }


# ==================== IBKR CONNECTION ====================

@app.get("/api/ibkr/status")
def get_ibkr_status():
    """Get IBKR connection status."""
    ibkr = get_ibkr_service()
    status = ibkr.get_status()
    return status.to_dict()


@app.post("/api/ibkr/connect")
def connect_ibkr(request: ConnectionRequest = None):
    """Connect to IBKR."""
    ibkr = get_ibkr_service()

    host = request.host if request else None
    port = request.port if request else None
    client_id = request.client_id if request else None

    status = ibkr.connect(host=host, port=port, client_id=client_id)
    return status.to_dict()


@app.post("/api/ibkr/disconnect")
def disconnect_ibkr():
    """Disconnect from IBKR."""
    ibkr = get_ibkr_service()
    status = ibkr.disconnect()
    return status.to_dict()


@app.get("/api/ibkr/accounts")
def get_ibkr_accounts():
    """Get list of managed accounts."""
    ibkr = get_ibkr_service()
    if not ibkr.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to IBKR")

    status = ibkr.get_status()
    return {"accounts": status.accounts}


@app.get("/api/ibkr/account-summary")
def get_account_summary(account: Optional[str] = None):
    """Get account summary from IBKR."""
    ibkr = get_ibkr_service()
    if not ibkr.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to IBKR")

    summary = ibkr.get_account_summary(account)
    return summary


# ==================== POSITIONS ====================

@app.get("/api/positions")
def list_positions(status: str = "open"):
    """Get positions from database."""
    if status == "open":
        positions = get_open_positions()
    else:
        positions = get_closed_positions()

    # Calculate days to expiry for open positions
    today = date.today()
    for pos in positions:
        if pos.get('expiry'):
            try:
                expiry_date = datetime.strptime(pos['expiry'], '%Y-%m-%d').date()
                pos['days_to_expiry'] = (expiry_date - today).days
            except:
                pos['days_to_expiry'] = None

    return {"positions": positions}


@app.get("/api/positions/{position_id}")
def get_position(position_id: int):
    """Get a single position by ID."""
    position = get_position_by_id(position_id)
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    return position


@app.post("/api/positions")
def add_position(position: PositionCreate):
    """Create a new position."""
    position_id = create_position(
        underlying=position.underlying,
        option_type=position.option_type,
        strike=position.strike,
        expiry=position.expiry,
        quantity=position.quantity,
        premium_collected=position.premium_collected,
        strategy_type=position.strategy_type,
        open_date=position.open_date,
        notes=position.notes
    )
    return {"id": position_id, "message": "Position created"}


@app.put("/api/positions/{position_id}")
def modify_position(position_id: int, updates: PositionUpdate):
    """Update a position."""
    update_dict = {k: v for k, v in updates.dict().items() if v is not None}
    success = update_position(position_id, **update_dict)
    if not success:
        raise HTTPException(status_code=404, detail="Position not found or no changes made")
    return {"message": "Position updated"}


@app.post("/api/positions/{position_id}/close")
def close_position_endpoint(position_id: int, close_data: PositionClose):
    """Close a position."""
    success = close_position(
        position_id=position_id,
        close_price=close_data.close_price,
        close_date=close_data.close_date,
        status=close_data.status
    )
    if not success:
        raise HTTPException(status_code=404, detail="Position not found")
    return {"message": "Position closed"}


# ==================== IBKR POSITIONS SYNC ====================

@app.get("/api/ibkr/positions")
def get_ibkr_positions(account: Optional[str] = None):
    """Get positions directly from IBKR."""
    ibkr = get_ibkr_service()
    if not ibkr.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to IBKR")

    positions = ibkr.get_positions(account)
    return {"positions": positions}


@app.post("/api/ibkr/sync")
def sync_from_ibkr(account: Optional[str] = None):
    """Sync positions and holdings from IBKR to local database."""
    ibkr = get_ibkr_service()
    if not ibkr.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to IBKR")

    # If no account specified, check for saved preference
    if not account:
        saved_account = get_setting("selected_ibkr_account")
        if saved_account:
            account = saved_account
            logger.info(f"Using saved account preference: {account}")

    # If still no account, use first available account
    status = ibkr.get_status()
    if not account and status.accounts:
        account = status.accounts[0]
        logger.info(f"No account specified, using default: {account}")

    positions = ibkr.get_positions(account)

    synced_stocks = 0
    synced_options = 0

    # Separate stocks and options
    stock_positions = [p for p in positions if p['sec_type'] == 'STK']
    option_positions = [p for p in positions if p['sec_type'] == 'OPT']

    # IMPORTANT: Sync stocks FIRST so covered call detection works correctly
    for pos in stock_positions:
        # IBKR avg_cost is already per-share cost - DO NOT divide by quantity
        # The avg_cost from IBKR is the per-share average cost basis
        avg_cost_per_share = pos['avg_cost']

        # Skip price fetching during sync to avoid blocking - prices can be updated separately
        upsert_stock_holding(
            symbol=pos['symbol'],
            quantity=int(pos['quantity']),
            avg_cost=avg_cost_per_share,
            current_price=None,  # Will be fetched separately to avoid blocking sync
            ibkr_con_id=pos['con_id']
        )
        synced_stocks += 1
        logger.info(f"Synced stock: {pos['symbol']} qty={pos['quantity']} avg_cost=${avg_cost_per_share:.2f}")

    # NOW sync options - holdings are already in database for CC detection
    for pos in option_positions:
        # Sync option position to database
        expiry = pos.get('expiry', '')
        # Convert IBKR format (YYYYMMDD) to database format (YYYY-MM-DD)
        if len(expiry) == 8:
            expiry = f"{expiry[:4]}-{expiry[4:6]}-{expiry[6:8]}"

        right = pos.get('right', '')
        option_type = 'CALL' if right == 'C' else 'PUT' if right == 'P' else right

        # Determine strategy type based on holdings (now correctly populated)
        strategy_type = 'CSP'  # Default for puts
        if option_type == 'CALL':
            # Check if user has shares for covered call
            holdings = get_stock_holdings()
            shares_needed = abs(int(pos['quantity'])) * 100
            for h in holdings:
                if h['symbol'] == pos['symbol'] and h['quantity'] >= shares_needed:
                    strategy_type = 'CC'
                    logger.info(f"Detected covered call: {pos['symbol']} has {h['quantity']} shares, needs {shares_needed}")
                    break
            else:
                strategy_type = 'NAKED'
                logger.warning(f"Naked call detected: {pos['symbol']} - no sufficient holdings found")
        elif option_type == 'PUT':
            # Could check for cash-secured vs naked put here if needed
            strategy_type = 'CSP'

        # Calculate premium per share from avg_cost
        # IBKR avg_cost for options is the total cost (negative for short positions)
        avg_cost = pos.get('avg_cost', 0)
        multiplier = int(pos.get('multiplier', '100'))
        premium_per_share = abs(avg_cost) / multiplier if avg_cost else 0

        # Create position if it doesn't exist (check by conId)
        position_id = create_position(
            underlying=pos['symbol'],
            option_type=option_type,
            strike=pos.get('strike', 0),
            expiry=expiry,
            quantity=abs(int(pos['quantity'])),
            premium_collected=premium_per_share,
            strategy_type=strategy_type,
            ibkr_con_id=pos['con_id']
        )

        synced_options += 1
        logger.info(f"Synced option: {pos['symbol']} ${pos.get('strike')} {option_type} exp {expiry} strategy={strategy_type} (ID: {position_id})")

    return {
        "message": "Sync completed",
        "stocks_synced": synced_stocks,
        "options_synced": synced_options,
        "account_used": account
    }


# ==================== STOCK HOLDINGS ====================

@app.get("/api/holdings")
def list_holdings():
    """Get all stock holdings."""
    holdings = get_stock_holdings()
    return {"holdings": holdings}


@app.post("/api/holdings")
def add_or_update_holding(holding: StockHoldingUpsert):
    """Add or update a stock holding."""
    holding_id = upsert_stock_holding(
        symbol=holding.symbol,
        quantity=holding.quantity,
        avg_cost=holding.avg_cost,
        current_price=holding.current_price
    )
    return {"id": holding_id, "message": "Holding saved"}


@app.delete("/api/holdings/{symbol}")
def remove_holding(symbol: str):
    """Delete a stock holding."""
    success = delete_stock_holding(symbol)
    if not success:
        raise HTTPException(status_code=404, detail="Holding not found")
    return {"message": "Holding deleted"}


# ==================== WATCHLISTS ====================

@app.get("/api/watchlists")
def list_watchlists():
    """Get all watchlists."""
    watchlists = get_watchlists()
    return {"watchlists": watchlists}


@app.post("/api/watchlists")
def add_watchlist(watchlist: WatchlistCreate):
    """Create a new watchlist."""
    watchlist_id = create_watchlist(
        name=watchlist.name,
        description=watchlist.description,
        symbols=watchlist.symbols
    )
    return {"id": watchlist_id, "message": "Watchlist created"}


@app.post("/api/watchlists/{watchlist_id}/symbols")
def add_watchlist_symbol(watchlist_id: int, data: WatchlistSymbol):
    """Add a symbol to a watchlist."""
    success = add_symbol_to_watchlist(watchlist_id, data.symbol)
    if not success:
        raise HTTPException(status_code=400, detail="Symbol already exists or watchlist not found")
    return {"message": "Symbol added"}


@app.delete("/api/watchlists/{watchlist_id}/symbols/{symbol}")
def delete_watchlist_symbol(watchlist_id: int, symbol: str):
    """Remove a symbol from a watchlist."""
    success = remove_symbol_from_watchlist(watchlist_id, symbol)
    if not success:
        raise HTTPException(status_code=404, detail="Symbol not found in watchlist")
    return {"message": "Symbol removed"}


# ==================== MARKET STATUS ====================

def get_market_status() -> dict:
    """
    Check if the US stock market is currently open.
    NYSE/NASDAQ hours: 9:30 AM - 4:00 PM ET, Monday-Friday
    Does not account for market holidays.
    """
    eastern = pytz.timezone('America/New_York')
    now = datetime.now(eastern)

    # Check if it's a weekend (Saturday=5, Sunday=6)
    if now.weekday() >= 5:
        return {
            "is_open": False,
            "status": "closed",
            "reason": "weekend",
            "message": "Market is closed (Weekend)",
            "current_time_et": now.strftime("%Y-%m-%d %H:%M:%S ET"),
            "next_open": "Monday 9:30 AM ET"
        }

    market_open = time(9, 30)
    market_close = time(16, 0)
    current_time = now.time()

    if current_time < market_open:
        return {
            "is_open": False,
            "status": "pre_market",
            "reason": "before_hours",
            "message": "Market is closed (Pre-Market)",
            "current_time_et": now.strftime("%Y-%m-%d %H:%M:%S ET"),
            "next_open": "Today 9:30 AM ET"
        }
    elif current_time > market_close:
        next_open = "Tomorrow 9:30 AM ET" if now.weekday() < 4 else "Monday 9:30 AM ET"
        return {
            "is_open": False,
            "status": "after_hours",
            "reason": "after_hours",
            "message": "Market is closed (After-Hours)",
            "current_time_et": now.strftime("%Y-%m-%d %H:%M:%S ET"),
            "next_open": next_open
        }
    else:
        return {
            "is_open": True,
            "status": "open",
            "reason": "regular_hours",
            "message": "Market is open",
            "current_time_et": now.strftime("%Y-%m-%d %H:%M:%S ET"),
            "closes_at": "Today 4:00 PM ET"
        }


@app.get("/api/market/status")
def market_status():
    """Get current market status (open/closed)."""
    return get_market_status()


# ==================== MARKET DATA ====================

@app.get("/api/market/price/{symbol}")
def get_price(symbol: str):
    """Get current price for a symbol."""
    ibkr = get_ibkr_service()
    if not ibkr.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to IBKR")

    price = ibkr.get_stock_price(symbol)
    if price is None:
        raise HTTPException(status_code=404, detail=f"Could not get price for {symbol}")

    return {"symbol": symbol.upper(), "price": price}


@app.get("/api/market/options/expirations/{symbol}")
def get_expirations(symbol: str):
    """Get available option expirations for a symbol."""
    ibkr = get_ibkr_service()
    if not ibkr.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to IBKR")

    expirations = ibkr.get_option_chain_expirations(symbol)
    return {"symbol": symbol.upper(), "expirations": expirations}


@app.get("/api/market/options/strikes/{symbol}/{expiry}")
def get_strikes(symbol: str, expiry: str):
    """Get available strikes for a symbol and expiry."""
    ibkr = get_ibkr_service()
    if not ibkr.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to IBKR")

    strikes = ibkr.get_option_chain_strikes(symbol, expiry)
    return {"symbol": symbol.upper(), "expiry": expiry, "strikes": strikes}


@app.get("/api/market/options/data")
def get_option_data(
    symbol: str,
    expiry: str,
    strike: float,
    right: str
):
    """Get data for a specific option contract."""
    ibkr = get_ibkr_service()
    if not ibkr.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to IBKR")

    data = ibkr.get_option_data(symbol, expiry, strike, right)
    if data is None:
        raise HTTPException(status_code=404, detail="Could not get option data")

    return data


class BulkOptionRequest(BaseModel):
    symbol: str
    expiry: str
    strikes: List[float]


@app.post("/api/market/options/chain")
def get_option_chain_bulk(request: BulkOptionRequest):
    """Get option data for multiple strikes at once (more efficient)."""
    ibkr = get_ibkr_service()
    if not ibkr.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to IBKR")

    data = ibkr.get_option_chain_bulk(request.symbol, request.expiry, request.strikes)
    return {"options": data}


# ==================== SCANNER ====================

@app.post("/api/scanner/scan")
def run_scan(request: ScanRequest):
    """
    Scan for option opportunities.

    This is a simplified scanner that fetches option data for
    the specified symbols and filters based on criteria.
    """
    ibkr = get_ibkr_service()
    if not ibkr.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to IBKR")

    results = []

    for symbol in request.symbols:
        try:
            # Get current stock price
            stock_price = ibkr.get_stock_price(symbol)
            if not stock_price:
                continue

            # Get available expirations
            expirations = ibkr.get_option_chain_expirations(symbol)

            # Filter to desired DTE range
            today = date.today()
            valid_expirations = []
            for exp in expirations:
                try:
                    exp_date = datetime.strptime(exp, '%Y%m%d').date()
                    dte = (exp_date - today).days
                    if request.min_dte <= dte <= request.max_dte:
                        valid_expirations.append((exp, dte))
                except:
                    continue

            # For each valid expiration, get strikes near the money
            for exp, dte in valid_expirations[:2]:  # Limit to first 2 expirations
                strikes = ibkr.get_option_chain_strikes(symbol, exp)

                # Filter strikes to +/- 20% of current price
                otm_strikes = [
                    s for s in strikes
                    if stock_price * 0.8 <= s <= stock_price * 1.2
                ]

                # Determine right based on strategy
                right = 'P' if request.strategy in ['csp', 'ps'] else 'C'

                # Get data for a few strikes
                for strike in otm_strikes[:5]:
                    option_data = ibkr.get_option_data(symbol, exp, strike, right)
                    if option_data and option_data.get('bid'):
                        # Check delta if available
                        delta = option_data.get('delta')
                        if delta:
                            abs_delta = abs(delta)
                            if not (request.min_delta <= abs_delta <= request.max_delta):
                                continue

                        # Calculate simple score
                        score = calculate_opportunity_score(
                            option_data,
                            stock_price,
                            dte
                        )

                        results.append({
                            'symbol': symbol,
                            'strike': strike,
                            'expiry': exp,
                            'dte': dte,
                            'option_type': 'PUT' if right == 'P' else 'CALL',
                            'bid': option_data.get('bid'),
                            'ask': option_data.get('ask'),
                            'iv': option_data.get('iv'),
                            'delta': delta,
                            'theta': option_data.get('theta'),
                            'score': score
                        })

        except Exception as e:
            logger.error(f"Error scanning {symbol}: {e}")
            continue

    # Sort by score descending
    results.sort(key=lambda x: x.get('score', 0), reverse=True)

    return {"results": results[:20]}  # Return top 20


def calculate_opportunity_score(option_data: dict, stock_price: float, dte: int) -> int:
    """Calculate a simple opportunity score (0-100)."""
    score = 50  # Base score

    # IV boost (higher IV = more premium)
    iv = option_data.get('iv')
    if iv:
        if iv > 0.5:
            score += 20
        elif iv > 0.3:
            score += 10

    # Delta scoring (prefer 0.20-0.30)
    delta = option_data.get('delta')
    if delta:
        abs_delta = abs(delta)
        if 0.20 <= abs_delta <= 0.30:
            score += 15
        elif 0.15 <= abs_delta <= 0.35:
            score += 10

    # DTE scoring (prefer 30-45 days)
    if 30 <= dte <= 45:
        score += 15
    elif 21 <= dte <= 50:
        score += 10

    # Bid/Ask spread scoring
    bid = option_data.get('bid', 0)
    ask = option_data.get('ask', 0)
    if bid and ask and ask > 0:
        spread_pct = (ask - bid) / ask
        if spread_pct < 0.05:
            score += 10
        elif spread_pct < 0.10:
            score += 5

    return min(100, max(0, score))


@app.post("/api/scanner/parity-scan")
def run_parity_scan(request: ParityScanRequest):
    """
    Scan for options mispricing using put-call parity analysis.

    Detects:
    1. Put-call parity violations (arbitrage opportunities)
    2. Statistical outliers in implied volatility

    Returns top mispriced options sorted by opportunity score.
    """
    ibkr = get_ibkr_service()
    if not ibkr.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to IBKR")

    try:
        # Get current stock price
        stock_price = ibkr.get_stock_price(request.symbol)
        if not stock_price:
            raise HTTPException(status_code=404, detail=f"Could not get stock price for {request.symbol}")

        # Get available expirations
        expirations = ibkr.get_option_chain_expirations(request.symbol)

        # Filter to desired DTE range
        today = date.today()
        valid_expirations = []
        for exp in expirations:
            try:
                exp_date = datetime.strptime(exp, '%Y%m%d').date()
                dte = (exp_date - today).days
                if request.min_dte <= dte <= request.max_dte:
                    valid_expirations.append((exp, dte))
            except:
                continue

        if not valid_expirations:
            return ParityScanResponse(
                symbol=request.symbol.upper(),
                stock_price=stock_price,
                scan_timestamp=datetime.now().isoformat(),
                risk_free_rate=request.risk_free_rate,
                avg_iv=0.0,
                iv_std_dev=0.0,
                opportunities=[]
            )

        # Limit to first 3 expirations
        valid_expirations = valid_expirations[:3]

        # Collect all call-put pairs
        all_pairs = []

        for exp, dte in valid_expirations:
            # Get strikes within ±20% of current price
            strikes = ibkr.get_option_chain_strikes(request.symbol, exp)
            nearby_strikes = [
                s for s in strikes
                if stock_price * 0.80 <= s <= stock_price * 1.20
            ]

            # Limit to 15 strikes per expiration
            nearby_strikes = nearby_strikes[:15]

            if not nearby_strikes:
                continue

            # Bulk fetch BOTH calls AND puts for all strikes
            chain_data = ibkr.get_option_chain_bulk(request.symbol, exp, nearby_strikes)

            # Group by strike to create call-put pairs
            strike_map = {}
            for opt in chain_data:
                strike = opt['strike']
                right = opt['right']

                if strike not in strike_map:
                    strike_map[strike] = {'strike': strike, 'expiry': exp, 'dte': dte}

                # Calculate mid price
                bid = opt.get('bid')
                ask = opt.get('ask')
                mid = (bid + ask) / 2 if bid is not None and ask is not None else None

                if right == 'C':
                    strike_map[strike]['call'] = opt
                    strike_map[strike]['call_mid'] = mid
                elif right == 'P':
                    strike_map[strike]['put'] = opt
                    strike_map[strike]['put_mid'] = mid

            # Create pairs where we have BOTH call and put
            for strike, data in strike_map.items():
                if 'call' in data and 'put' in data and data.get('call_mid') and data.get('put_mid'):
                    all_pairs.append(data)

        if not all_pairs:
            return ParityScanResponse(
                symbol=request.symbol.upper(),
                stock_price=stock_price,
                scan_timestamp=datetime.now().isoformat(),
                risk_free_rate=request.risk_free_rate,
                avg_iv=0.0,
                iv_std_dev=0.0,
                opportunities=[]
            )

        # Calculate put-call parity violations for each pair
        opportunities = []

        for pair in all_pairs:
            call_data = pair['call']
            put_data = pair['put']
            strike = pair['strike']
            dte = pair['dte']
            time_to_expiry = dte / 365.0

            # Get prices
            call_mid = pair['call_mid']
            put_mid = pair['put_mid']

            # Calculate put-call parity violation
            parity_result = calculate_put_call_parity_violation(
                call_price=call_mid,
                put_price=put_mid,
                stock_price=stock_price,
                strike=strike,
                time_to_expiry=time_to_expiry,
                risk_free_rate=request.risk_free_rate,
                threshold=request.parity_threshold
            )

            # Calculate synthetic prices
            synthetics = calculate_synthetic_prices(
                stock_price=stock_price,
                strike=strike,
                time_to_expiry=time_to_expiry,
                risk_free_rate=request.risk_free_rate,
                call_price=call_mid,
                put_price=put_mid
            )

            # Prepare opportunity data
            opp = {
                'symbol': request.symbol.upper(),
                'strike': strike,
                'expiry': pair['expiry'],
                'dte': dte,
                'call_bid': call_data.get('bid', 0.0),
                'call_ask': call_data.get('ask', 0.0),
                'call_mid': call_mid,
                'call_iv': call_data.get('iv'),
                'call_volume': call_data.get('volume', 0),
                'put_bid': put_data.get('bid', 0.0),
                'put_ask': put_data.get('ask', 0.0),
                'put_mid': put_mid,
                'put_iv': put_data.get('iv'),
                'put_volume': put_data.get('volume', 0),
                'parity_value': parity_result['parity_value'],
                'market_spread': parity_result['market_spread'],
                'violation_dollars': parity_result['violation_dollars'],
                'violation_pct': parity_result['violation_pct'],
                'is_violation': parity_result['is_violation'],
                'arbitrage_type': parity_result['arbitrage_type'],
                'synthetic_call': synthetics['synthetic_call'],
                'synthetic_put': synthetics['synthetic_put'],
                'avg_delta': None,
                'iv': (call_data.get('iv', 0) + put_data.get('iv', 0)) / 2 if call_data.get('iv') and put_data.get('iv') else None
            }

            # Calculate average delta if available
            call_delta = call_data.get('delta')
            put_delta = put_data.get('delta')
            if call_delta is not None and put_delta is not None:
                opp['avg_delta'] = (abs(call_delta) + abs(put_delta)) / 2

            opportunities.append(opp)

        # Detect IV outliers across all options
        opportunities = detect_statistical_outliers(opportunities, metric='iv', threshold=2.0)

        # Calculate IV statistics
        ivs = [opp['iv'] for opp in opportunities if opp.get('iv') is not None]
        avg_iv = sum(ivs) / len(ivs) if ivs else 0.0

        import math
        if len(ivs) > 1:
            variance = sum((x - avg_iv) ** 2 for x in ivs) / (len(ivs) - 1)
            iv_std_dev = math.sqrt(variance)
        else:
            iv_std_dev = 0.0

        # Calculate opportunity scores
        for opp in opportunities:
            moneyness = stock_price / opp['strike'] if opp['strike'] > 0 else 1.0
            total_volume = opp['call_volume'] + opp['put_volume']

            opp['opportunity_score'] = calc_parity_opportunity_score(
                violation_pct=opp['violation_pct'],
                is_violation=opp['is_violation'],
                iv_z_score=opp.get('iv_z_score', 0.0),
                is_iv_outlier=opp.get('is_iv_outlier', False),
                total_volume=total_volume,
                moneyness=moneyness
            )

        # Filter to violations OR outliers
        filtered_opportunities = [
            opp for opp in opportunities
            if opp['is_violation'] or opp.get('is_iv_outlier', False)
        ]

        # Sort by opportunity score descending
        filtered_opportunities.sort(key=lambda x: x['opportunity_score'], reverse=True)

        # Return top N results
        top_opportunities = filtered_opportunities[:request.max_results]

        # Convert to Pydantic models
        mispriced_options = [MispricedOption(**opp) for opp in top_opportunities]

        return ParityScanResponse(
            symbol=request.symbol.upper(),
            stock_price=stock_price,
            scan_timestamp=datetime.now().isoformat(),
            risk_free_rate=request.risk_free_rate,
            avg_iv=avg_iv,
            iv_std_dev=iv_std_dev,
            opportunities=mispriced_options
        )

    except Exception as e:
        logger.error(f"Error in parity scan for {request.symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Scanner error: {str(e)}")


# ==================== PERFORMANCE ====================

@app.get("/api/performance")
def get_performance():
    """Get performance statistics including detailed trade breakdown."""
    stats = get_performance_stats()
    return stats


@app.get("/api/performance/open-positions")
def get_performance_open_positions():
    """Get open positions with unrealized P&L for the performance page."""
    positions = get_open_positions_with_pnl()
    total_unrealized = sum(p['unrealized_pnl'] for p in positions)
    return {
        'positions': positions,
        'total_unrealized_pnl': round(total_unrealized, 2),
        'count': len(positions)
    }


# ==================== PORTFOLIO SUMMARY ====================

@app.get("/api/portfolio/summary")
def get_portfolio_summary():
    """Get portfolio summary combining positions and holdings."""
    positions = get_open_positions()
    holdings = get_stock_holdings()
    stats = get_performance_stats()

    # Calculate totals
    total_premium = sum(p['premium_collected'] * p['quantity'] * 100 for p in positions)

    holdings_value = sum(h.get('market_value', 0) or 0 for h in holdings)
    holdings_pnl = sum(h.get('unrealized_pnl', 0) or 0 for h in holdings)

    # Calculate covered call lots available
    cc_lots = 0
    for h in holdings:
        shares = h.get('quantity', 0)
        cc_lots += shares // 100

    return {
        "open_positions": len(positions),
        "total_premium": total_premium,
        "stock_holdings": len(holdings),
        "holdings_value": holdings_value,
        "holdings_pnl": holdings_pnl,
        "cc_lots_available": cc_lots,
        "realized_pnl": stats.get('total_realized_pnl', 0),
        "win_rate": stats.get('win_rate', 0),
        "total_trades": stats.get('total_trades', 0)
    }


# ==================== WHEEL CHAINS ====================

@app.get("/api/wheel-chains")
def list_wheel_chains():
    """Get all wheel chains with linked positions."""
    chains = get_all_wheel_chains()
    return {"chains": chains}


@app.post("/api/wheel-chains")
def create_wheel_chain_endpoint(data: WheelChainCreate):
    """Create a new wheel chain."""
    chain_id = db_create_wheel_chain(data.underlying)
    chain = get_wheel_chain_by_id(chain_id)
    return {"id": chain_id, "chain": chain, "message": "Wheel chain created"}


@app.get("/api/wheel-chains/{chain_id}")
def get_wheel_chain(chain_id: str):
    """Get a single wheel chain by ID with all linked positions."""
    chain = get_wheel_chain_by_id(chain_id)
    if not chain:
        raise HTTPException(status_code=404, detail="Wheel chain not found")
    return chain


@app.delete("/api/wheel-chains/{chain_id}")
def delete_wheel_chain_endpoint(chain_id: str):
    """Delete a wheel chain and unlink all positions."""
    success = delete_wheel_chain(chain_id)
    if not success:
        raise HTTPException(status_code=404, detail="Wheel chain not found")
    return {"message": "Wheel chain deleted"}


@app.get("/api/wheel-chains/by-underlying/{symbol}")
def get_chains_by_underlying(symbol: str):
    """Get all wheel chains for a specific underlying."""
    chains = get_wheel_chains_by_underlying(symbol)
    return {"chains": chains}


@app.get("/api/wheel-chains/active/{symbol}")
def get_active_chain(symbol: str):
    """Get the active (non-closed) wheel chain for a specific underlying."""
    chain = get_active_chain_for_underlying(symbol)
    if not chain:
        return {"chain": None}
    return {"chain": chain}


@app.post("/api/wheel-chains/{chain_id}/assignment")
def record_assignment(chain_id: str, data: WheelChainAssignment):
    """Record an assignment event on a wheel chain."""
    chain = get_wheel_chain_by_id(chain_id)
    if not chain:
        raise HTTPException(status_code=404, detail="Wheel chain not found")

    if chain['status'] != 'COLLECTING_PREMIUM':
        raise HTTPException(status_code=400, detail="Chain is not in COLLECTING_PREMIUM status")

    success = record_chain_assignment(
        chain_id=chain_id,
        strike=data.strike,
        shares=data.shares,
        assignment_date=data.assignment_date
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to record assignment")

    updated_chain = get_wheel_chain_by_id(chain_id)
    return {"message": "Assignment recorded", "chain": updated_chain}


@app.post("/api/wheel-chains/{chain_id}/exit")
def record_exit(chain_id: str, data: WheelChainExit):
    """Record an exit event (shares called away or sold) on a wheel chain."""
    chain = get_wheel_chain_by_id(chain_id)
    if not chain:
        raise HTTPException(status_code=404, detail="Wheel chain not found")

    if chain['status'] != 'HOLDING_SHARES':
        raise HTTPException(status_code=400, detail="Chain is not in HOLDING_SHARES status")

    if data.exit_type not in ('CALLED_AWAY', 'SOLD'):
        raise HTTPException(status_code=400, detail="exit_type must be CALLED_AWAY or SOLD")

    success = record_chain_exit(
        chain_id=chain_id,
        exit_price=data.exit_price,
        exit_type=data.exit_type,
        exit_date=data.exit_date
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to record exit")

    updated_chain = get_wheel_chain_by_id(chain_id)
    return {"message": "Exit recorded", "chain": updated_chain}


@app.post("/api/positions/{position_id}/link-chain/{chain_id}")
def link_position_to_chain_endpoint(position_id: int, chain_id: str):
    """Link a position to a wheel chain."""
    chain = get_wheel_chain_by_id(chain_id)
    if not chain:
        raise HTTPException(status_code=404, detail="Wheel chain not found")

    position = get_position_by_id(position_id)
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")

    # Verify position underlying matches chain underlying
    if position['underlying'].upper() != chain['underlying'].upper():
        raise HTTPException(
            status_code=400,
            detail=f"Position underlying ({position['underlying']}) doesn't match chain underlying ({chain['underlying']})"
        )

    success = link_position_to_chain(position_id, chain_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to link position to chain")

    return {"message": "Position linked to chain"}


@app.post("/api/positions/{position_id}/unlink-chain")
def unlink_position_from_chain_endpoint(position_id: int):
    """Unlink a position from its wheel chain."""
    position = get_position_by_id(position_id)
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")

    if not position.get('wheel_chain_id'):
        raise HTTPException(status_code=400, detail="Position is not linked to a chain")

    success = unlink_position_from_chain(position_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to unlink position from chain")

    return {"message": "Position unlinked from chain"}


# ==================== AUTO WHEEL ANALYSIS ====================
# These endpoints automatically analyze historical positions to calculate
# premium accumulation per underlying - NO manual linking required

@app.get("/api/wheel/analysis")
def get_wheel_analysis():
    """
    Get auto-calculated wheel analysis for all underlyings.

    This automatically:
    - Groups all CSP/CC positions by underlying
    - Calculates total premium earned (closed positions)
    - Calculates pending premium (open positions)
    - Adjusts cost basis if shares are held
    - Returns all data - no manual linking required
    """
    analysis = get_auto_wheel_analysis()
    summary = get_auto_wheel_summary()
    return {
        "analysis": analysis,
        "summary": summary
    }


@app.get("/api/wheel/analysis/{symbol}")
def get_wheel_analysis_for_symbol(symbol: str):
    """Get auto-calculated wheel analysis for a specific symbol."""
    all_analysis = get_auto_wheel_analysis()

    # Find the analysis for this symbol
    symbol_upper = symbol.upper()
    for entry in all_analysis:
        if entry['underlying'] == symbol_upper:
            return entry

    raise HTTPException(status_code=404, detail=f"No wheel data found for {symbol}")


@app.get("/api/wheel/summary")
def get_wheel_summary():
    """Get summary statistics for all wheel activity."""
    return get_auto_wheel_summary()


# ==================== APP SETTINGS ====================

@app.get("/api/settings")
def get_settings():
    """Get all app settings."""
    all_settings = get_all_settings()
    # Mask API keys for security (only show last 4 chars)
    masked = {}
    for key, value in all_settings.items():
        if 'api_key' in key.lower() and value:
            masked[key] = f"****{value[-4:]}" if len(value) > 4 else "****"
        else:
            masked[key] = value
    return {"settings": masked}


@app.post("/api/settings")
def update_setting(setting: SettingUpdate):
    """Update a single setting."""
    set_setting(setting.key, setting.value)
    return {"success": True, "key": setting.key}


# AI settings routes MUST come before the {key} route to avoid path conflicts
@app.get("/api/settings/ai")
def get_ai_settings():
    """Get current AI settings."""
    provider = get_setting("ai_provider") or "google"
    model = get_setting("ai_model")

    # Check which API keys are set
    keys_status = {
        "anthropic": bool(get_setting("anthropic_api_key")),
        "openai": bool(get_setting("openai_api_key")),
        "google": bool(get_setting("google_api_key")),
        "xai": bool(get_setting("xai_api_key")),
        "perplexity": bool(get_setting("perplexity_api_key")),
    }

    return {
        "provider": provider,
        "model": model,
        "api_key_set": keys_status.get(provider, False),
        "available_providers": keys_status
    }


@app.post("/api/settings/ai")
def update_ai_settings(ai_settings: AISettingsUpdate):
    """Update AI provider, model, and API key."""
    set_setting("ai_provider", ai_settings.provider)
    set_setting(f"{ai_settings.provider}_api_key", ai_settings.api_key)
    if ai_settings.model:
        set_setting("ai_model", ai_settings.model)
    return {
        "success": True,
        "provider": ai_settings.provider,
        "model": ai_settings.model,
        "api_key_set": True
    }


@app.post("/api/settings/ai/test")
def test_ai_connection():
    """Test the AI connection with current settings."""
    provider = get_setting("ai_provider") or "google"
    model = get_setting("ai_model") or "default"
    api_key = get_setting(f"{provider}_api_key")

    if not api_key:
        raise HTTPException(status_code=400, detail=f"No API key set for {provider}")

    # Basic validation - just check key format
    if provider == "anthropic" and not api_key.startswith("sk-ant-"):
        raise HTTPException(status_code=400, detail="Invalid Anthropic API key format")
    if provider == "openai" and not api_key.startswith("sk-"):
        raise HTTPException(status_code=400, detail="Invalid OpenAI API key format")
    if provider == "xai" and not api_key.startswith("xai-"):
        raise HTTPException(status_code=400, detail="Invalid xAI API key format")
    if provider == "perplexity" and not api_key.startswith("pplx-"):
        raise HTTPException(status_code=400, detail="Invalid Perplexity API key format")

    return {
        "success": True,
        "provider": provider,
        "model": model,
        "message": f"API key for {provider} is configured (model: {model})"
    }


# Generic key route MUST come after specific routes like /api/settings/ai
@app.get("/api/settings/{key}")
def get_setting_value(key: str):
    """Get a specific setting."""
    value = get_setting(key)
    if value is None:
        return {"key": key, "value": None}
    # Mask API keys
    if 'api_key' in key.lower() and value:
        masked = f"****{value[-4:]}" if len(value) > 4 else "****"
        return {"key": key, "value": masked, "is_set": True}
    return {"key": key, "value": value}


# ==================== AI CHAT ====================

def get_portfolio_context() -> str:
    """Build context about user's portfolio for the AI."""
    positions = get_open_positions()
    holdings = get_stock_holdings()
    stats = get_performance_stats()

    context_parts = ["Current Portfolio Context:"]

    if positions:
        context_parts.append("\n**Open Positions:**")
        for p in positions:
            days_to_expiry = (datetime.strptime(p['expiry'], '%Y-%m-%d').date() - date.today()).days if p.get('expiry') else 0
            context_parts.append(
                f"- {p['underlying']} ${p['strike']} {p['option_type']} expiring {p['expiry']} "
                f"({days_to_expiry}d) - {p['quantity']} contracts @ ${p['premium_collected']:.2f} premium"
            )
    else:
        context_parts.append("\n**No open option positions.**")

    if holdings:
        context_parts.append("\n**Stock Holdings:**")
        for h in holdings:
            lots = h['quantity'] // 100
            context_parts.append(
                f"- {h['symbol']}: {h['quantity']} shares (avg cost: ${h.get('avg_cost', 0):.2f}) "
                f"- {lots} covered call lots available"
            )
    else:
        context_parts.append("\n**No stock holdings.**")

    context_parts.append(f"\n**Performance:**")
    context_parts.append(f"- Total trades: {stats.get('total_trades', 0)}")
    context_parts.append(f"- Win rate: {stats.get('win_rate', 0):.1f}%")
    context_parts.append(f"- Realized P&L: ${stats.get('total_realized_pnl', 0):.2f}")

    return "\n".join(context_parts)


async def call_google_ai(messages: List[ChatMessage], api_key: str, model: str = "gemini-2.0-flash-exp") -> str:
    """Call Google Gemini API."""
    portfolio_context = get_portfolio_context()
    full_system = f"{AI_SYSTEM_PROMPT}\n\n{portfolio_context}"

    # Convert messages to Gemini format
    contents = []
    for msg in messages:
        role = "user" if msg.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg.content}]})

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
            json={
                "contents": contents,
                "systemInstruction": {"parts": [{"text": full_system}]},
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 2048,
                }
            },
            timeout=60.0
        )

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Google AI error: {response.text}")

        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def call_anthropic_ai(messages: List[ChatMessage], api_key: str, model: str = "claude-3-5-sonnet-20241022") -> str:
    """Call Anthropic Claude API."""
    portfolio_context = get_portfolio_context()
    full_system = f"{AI_SYSTEM_PROMPT}\n\n{portfolio_context}"

    # Convert messages to Anthropic format
    anthropic_messages = []
    for msg in messages:
        anthropic_messages.append({"role": msg.role, "content": msg.content})

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": model,
                "max_tokens": 2048,
                "system": full_system,
                "messages": anthropic_messages
            },
            timeout=60.0
        )

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Anthropic error: {response.text}")

        data = response.json()
        return data["content"][0]["text"]


async def call_openai_ai(messages: List[ChatMessage], api_key: str, model: str = "gpt-4o") -> str:
    """Call OpenAI API."""
    portfolio_context = get_portfolio_context()
    full_system = f"{AI_SYSTEM_PROMPT}\n\n{portfolio_context}"

    # Convert messages to OpenAI format
    openai_messages = [{"role": "system", "content": full_system}]
    for msg in messages:
        openai_messages.append({"role": msg.role, "content": msg.content})

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": openai_messages,
                "max_tokens": 2048,
                "temperature": 0.7
            },
            timeout=60.0
        )

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"OpenAI error: {response.text}")

        data = response.json()
        return data["choices"][0]["message"]["content"]


async def call_xai_ai(messages: List[ChatMessage], api_key: str, model: str = "grok-2") -> str:
    """Call xAI Grok API."""
    portfolio_context = get_portfolio_context()
    full_system = f"{AI_SYSTEM_PROMPT}\n\n{portfolio_context}"

    # Convert messages to xAI format (OpenAI compatible)
    xai_messages = [{"role": "system", "content": full_system}]
    for msg in messages:
        xai_messages.append({"role": msg.role, "content": msg.content})

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.x.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": xai_messages,
                "max_tokens": 2048,
                "temperature": 0.7
            },
            timeout=60.0
        )

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"xAI error: {response.text}")

        data = response.json()
        return data["choices"][0]["message"]["content"]


async def call_perplexity_ai(messages: List[ChatMessage], api_key: str, model: str = "llama-3.1-sonar-large-128k-online") -> str:
    """Call Perplexity API."""
    portfolio_context = get_portfolio_context()
    full_system = f"{AI_SYSTEM_PROMPT}\n\n{portfolio_context}"

    # Convert messages to Perplexity format (OpenAI compatible)
    pplx_messages = [{"role": "system", "content": full_system}]
    for msg in messages:
        pplx_messages.append({"role": msg.role, "content": msg.content})

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.perplexity.ai/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": pplx_messages,
                "max_tokens": 2048,
                "temperature": 0.7
            },
            timeout=60.0
        )

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Perplexity error: {response.text}")

        data = response.json()
        return data["choices"][0]["message"]["content"]


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Send a message to the AI advisor."""
    provider = get_setting("ai_provider") or "google"
    model = get_setting("ai_model")
    api_key = get_setting(f"{provider}_api_key")

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail=f"No API key configured for {provider}. Please add your API key in Settings."
        )

    try:
        if provider == "google":
            response = await call_google_ai(request.messages, api_key, model or "gemini-2.0-flash-exp")
        elif provider == "anthropic":
            response = await call_anthropic_ai(request.messages, api_key, model or "claude-3-5-sonnet-20241022")
        elif provider == "openai":
            response = await call_openai_ai(request.messages, api_key, model or "gpt-4o")
        elif provider == "xai":
            response = await call_xai_ai(request.messages, api_key, model or "grok-2")
        elif provider == "perplexity":
            response = await call_perplexity_ai(request.messages, api_key, model or "llama-3.1-sonar-large-128k-online")
        else:
            raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

        return {"response": response, "provider": provider, "model": model}

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI request timed out. Please try again.")
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CSV IMPORT ====================

def parse_ibkr_option_symbol(symbol: str) -> Tuple[str, str, float, str]:
    """
    Parse IBKR option symbol format: "TSLA 17OCT25 410 P"
    Returns: (underlying, expiry_date, strike, option_type)
    """
    parts = symbol.strip().split()
    if len(parts) < 4:
        raise ValueError(f"Invalid option symbol format: {symbol}")

    underlying = parts[0]  # TSLA
    expiry_str = parts[1]  # 17OCT25
    strike = float(parts[2])  # 410
    option_type = "PUT" if parts[3] == "P" else "CALL"

    # Parse expiry: 17OCT25 → 2025-10-17
    month_map = {
        "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
        "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12
    }

    day = int(expiry_str[:2])
    month_str = expiry_str[2:5].upper()
    year = 2000 + int(expiry_str[5:7])

    if month_str not in month_map:
        raise ValueError(f"Invalid month in expiry: {expiry_str}")

    month = month_map[month_str]
    expiry_date = f"{year}-{month:02d}-{day:02d}"

    return underlying, expiry_date, strike, option_type


def parse_ibkr_datetime(datetime_str: str) -> str:
    """
    Parse IBKR datetime format: "2025-10-10, 12:38:13" → "2025-10-10"
    """
    # Extract just the date part
    date_part = datetime_str.split(",")[0].strip()
    return date_part


@app.post("/api/import/ibkr-trades")
async def import_ibkr_trades(
    file: UploadFile = File(...),
    clear_existing: bool = Query(default=False, description="Clear all existing positions before import")
):
    """
    Import historical trades from IBKR Activity Statement CSV.

    Parses the CSV, finds option trades in the "Trades" section,
    matches opening trades with closing trades, and creates
    closed position records.

    Set clear_existing=true to delete all existing positions before importing.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    # Clear existing positions if requested
    cleared = 0
    if clear_existing:
        cleared = clear_all_positions()
        logger.info(f"Cleared {cleared} existing positions before import")

    try:
        content = await file.read()
        text = content.decode('utf-8')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {e}")

    # Parse CSV
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)

    # Find option trades
    # Format: Trades,Data,Order,Equity and Index Options,USD,Account,Symbol,DateTime,Qty,...,Code
    option_trades = []
    for row in rows:
        if len(row) < 17:
            continue
        if row[0] == "Trades" and row[1] == "Data" and row[3] == "Equity and Index Options":
            try:
                trade = {
                    'symbol': row[6],
                    'datetime': row[7],
                    'quantity': int(row[8]),
                    'trade_price': float(row[9]),
                    'proceeds': float(row[11]) if row[11] else 0,
                    'commission': float(row[12]) if row[12] else 0,
                    'code': row[16] if len(row) > 16 else ''
                }
                option_trades.append(trade)
            except (ValueError, IndexError) as e:
                logger.warning(f"Could not parse trade row: {row}, error: {e}")
                continue

    if not option_trades:
        raise HTTPException(
            status_code=400,
            detail="No option trades found in CSV. Make sure this is an IBKR Activity Statement."
        )

    # Group trades by symbol and match opens with closes
    trades_by_symbol: Dict[str, List[dict]] = {}
    for trade in option_trades:
        symbol = trade['symbol']
        if symbol not in trades_by_symbol:
            trades_by_symbol[symbol] = []
        trades_by_symbol[symbol].append(trade)

    # Process each symbol's trades
    imported = 0
    skipped = 0
    errors = []

    for symbol, trades in trades_by_symbol.items():
        # Sort by datetime
        trades.sort(key=lambda t: t['datetime'])

        # Separate opens (O) and closes (C, Ep)
        # Use 'in' check to handle compound codes like 'C;Ep'
        opens = [t for t in trades if 'O' in t['code']]
        closes = [t for t in trades if 'C' in t['code'] or 'Ep' in t['code']]

        # Match opens with closes (simple FIFO matching)
        for open_trade in opens:
            # Find a matching close (same quantity, opposite sign)
            matching_close = None
            for close_trade in closes:
                if close_trade['quantity'] == -open_trade['quantity']:
                    matching_close = close_trade
                    closes.remove(close_trade)
                    break

            if not matching_close:
                # No matching close found - this is an open position, import it as OPEN
                try:
                    underlying, expiry, strike, option_type = parse_ibkr_option_symbol(symbol)
                    open_date = parse_ibkr_datetime(open_trade['datetime'])
                    premium_per_share = open_trade['trade_price']
                    strategy_type = 'CSP' if option_type == 'PUT' else 'NAKED'
                    notes = "Imported from IBKR CSV - Open position"

                    # Create position as OPEN
                    position_id = create_position(
                        underlying=underlying,
                        option_type=option_type,
                        strike=strike,
                        expiry=expiry,
                        quantity=abs(open_trade['quantity']),
                        premium_collected=premium_per_share,
                        strategy_type=strategy_type,
                        open_date=open_date,
                        notes=notes
                    )
                    imported += 1
                    logger.info(f"Imported OPEN: {underlying} ${strike} {option_type} {expiry}")
                except Exception as e:
                    errors.append(f"{symbol} (open): {str(e)}")
                    logger.error(f"Error importing open position {symbol}: {e}")
                continue

            try:
                # Parse the symbol
                underlying, expiry, strike, option_type = parse_ibkr_option_symbol(symbol)
                open_date = parse_ibkr_datetime(open_trade['datetime'])
                close_date = parse_ibkr_datetime(matching_close['datetime'])

                # Calculate premium and close price
                # Open trade: quantity is negative for sell, price is per share
                premium_per_share = open_trade['trade_price']
                # For expired positions (code contains 'Ep'), close price is 0
                close_price = matching_close['trade_price'] if 'C' in matching_close['code'] and 'Ep' not in matching_close['code'] else 0

                # Determine status
                status = 'EXPIRED' if 'Ep' in matching_close['code'] else 'CLOSED'

                # Determine strategy (CSP for puts, assume naked for calls unless we know holdings)
                strategy_type = 'CSP' if option_type == 'PUT' else 'NAKED'

                # Calculate realized P/L for notes
                # P/L = (open proceeds + close proceeds) - total commission
                total_proceeds = open_trade['proceeds'] + matching_close['proceeds']
                total_commission = abs(open_trade['commission']) + abs(matching_close['commission'])
                realized_pnl = total_proceeds - total_commission

                notes = f"Imported from IBKR CSV. P/L: ${realized_pnl:.2f}"

                # Create the closed position
                position_id = create_closed_position(
                    underlying=underlying,
                    option_type=option_type,
                    strike=strike,
                    expiry=expiry,
                    quantity=abs(open_trade['quantity']),
                    premium_collected=premium_per_share,
                    strategy_type=strategy_type,
                    open_date=open_date,
                    close_date=close_date,
                    close_price=close_price,
                    status=status,
                    notes=notes
                )

                imported += 1
                logger.info(f"Imported: {underlying} ${strike} {option_type} {expiry} - {status}")

            except Exception as e:
                errors.append(f"{symbol}: {str(e)}")
                logger.error(f"Error importing {symbol}: {e}")

    message = f"Successfully imported {imported} trades (including open positions)."
    if cleared > 0:
        message = f"Cleared {cleared} existing positions. " + message

    # Record this import in history
    record_import(
        filename=file.filename,
        trades_imported=imported,
        trades_skipped=skipped,
        errors=errors if errors else None
    )

    return {
        "success": True,
        "imported": imported,
        "skipped": skipped,
        "cleared": cleared,
        "errors": errors,
        "message": message
    }


@app.get("/api/import/history")
async def get_import_history_endpoint(limit: int = 20):
    """Get the import history."""
    history = get_import_history(limit)
    return {"history": history}


@app.delete("/api/import/history")
async def clear_import_history_endpoint():
    """Clear all import history."""
    cleared = clear_import_history()
    return {"cleared": cleared, "message": f"Cleared {cleared} import records."}


# ==================== RUN SERVER ====================

# Ensure DB tables exist on startup
init_db()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
        loop="asyncio"  # Required for ib_insync compatibility (uvloop conflicts with nest_asyncio)
    )
