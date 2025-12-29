"""FastAPI backend for Options Buddy React app."""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
import logging

from config import settings
from database import (
    get_open_positions,
    get_closed_positions,
    get_position_by_id,
    create_position,
    close_position,
    update_position,
    get_stock_holdings,
    upsert_stock_holding,
    delete_stock_holding,
    get_watchlists,
    create_watchlist,
    add_symbol_to_watchlist,
    remove_symbol_from_watchlist,
    get_performance_stats
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
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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

    positions = ibkr.get_positions(account)

    synced_stocks = 0
    synced_options = 0

    for pos in positions:
        if pos['sec_type'] == 'STK':
            # Sync stock holding
            upsert_stock_holding(
                symbol=pos['symbol'],
                quantity=int(pos['quantity']),
                avg_cost=pos['avg_cost'] / pos['quantity'] if pos['quantity'] else None,
                ibkr_con_id=pos['con_id']
            )
            synced_stocks += 1
        elif pos['sec_type'] == 'OPT':
            # Options are tracked manually in positions table
            # We don't auto-create them, just log what we found
            synced_options += 1
            logger.info(f"Found option: {pos['symbol']} {pos.get('strike')} {pos.get('right')} {pos.get('expiry')}")

    return {
        "message": "Sync completed",
        "stocks_synced": synced_stocks,
        "options_found": synced_options
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


# ==================== PERFORMANCE ====================

@app.get("/api/performance")
def get_performance():
    """Get performance statistics."""
    stats = get_performance_stats()
    return stats


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


# ==================== RUN SERVER ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True
    )
