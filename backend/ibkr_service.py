"""Interactive Brokers API service using ib_insync."""

import logging
import asyncio
import random
from typing import Optional, List
from dataclasses import dataclass, asdict
from datetime import datetime

# Apply nest_asyncio only if we're not in uvloop
try:
    import nest_asyncio
    loop = asyncio.get_event_loop()
    if not type(loop).__name__.startswith('uvloop'):
        nest_asyncio.apply()
except Exception:
    pass

from config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lazy imports to avoid event loop issues at module load time
_ib_insync_imported = False
IB = None
Stock = None
Option = None
Contract = None
util = None


def _ensure_ib_insync_imported():
    """Lazily import ib_insync to avoid event loop issues."""
    global _ib_insync_imported, IB, Stock, Option, Contract, util
    if not _ib_insync_imported:
        from ib_insync import IB as _IB, Stock as _Stock, Option as _Option, Contract as _Contract, util as _util
        IB = _IB
        Stock = _Stock
        Option = _Option
        Contract = _Contract
        util = _util
        _ib_insync_imported = True


def generate_client_id() -> int:
    """Generate a random client ID to avoid conflicts."""
    return random.randint(100, 999)


@dataclass
class ConnectionStatus:
    """Represents the IBKR connection status."""
    is_connected: bool
    host: str
    port: int
    client_id: int
    server_version: Optional[int] = None
    connection_time: Optional[str] = None
    error_message: Optional[str] = None
    accounts: List[str] = None

    def to_dict(self):
        return asdict(self)


class IBKRService:
    """
    Service for Interactive Brokers connectivity.

    Provides a simplified interface for:
    - Connecting/disconnecting to TWS or IB Gateway
    - Fetching positions and account data
    - Getting market data
    """

    _instance: Optional["IBKRService"] = None

    def __init__(self):
        """Initialize the IBKR service."""
        self._ib = None
        self._connected = False
        self._connection_time: Optional[datetime] = None
        self._active_client_id: Optional[int] = None
        self._accounts: List[str] = []

    def _get_ib(self):
        """Get or create the IB instance."""
        if self._ib is None:
            _ensure_ib_insync_imported()
            self._ib = IB()
        return self._ib

    @classmethod
    def get_instance(cls) -> "IBKRService":
        """Get or create the singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls):
        """Reset the singleton instance."""
        if cls._instance is not None:
            try:
                if cls._instance._ib and cls._instance._ib.isConnected():
                    cls._instance._ib.disconnect()
            except:
                pass
            cls._instance = None

    @property
    def is_connected(self) -> bool:
        """Check if connected to IBKR."""
        try:
            if self._ib is None:
                return False
            return self._ib.isConnected()
        except:
            return False

    def connect(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        client_id: Optional[int] = None,
        timeout: int = 10,
        _retry_count: int = 0
    ) -> ConnectionStatus:
        """
        Connect to TWS or IB Gateway.

        Args:
            host: IBKR host (default from settings)
            port: IBKR port (default from settings)
            client_id: Client ID (uses random by default)
            timeout: Connection timeout in seconds

        Returns:
            ConnectionStatus with connection details
        """
        host = host or settings.ibkr_host
        port = port or settings.ibkr_port

        # Always use random client ID to avoid conflicts
        if client_id is None:
            client_id = generate_client_id()
            logger.info(f"Generated random client ID: {client_id}")

        try:
            # Clean up existing connection
            if self._ib is not None:
                try:
                    if self._ib.isConnected():
                        self._ib.disconnect()
                except Exception as e:
                    logger.warning(f"Cleanup warning: {e}")
                finally:
                    self._ib = None

            import time
            time.sleep(0.5)

            logger.info(f"Connecting to IBKR at {host}:{port} with client ID {client_id}")

            ib = self._get_ib()

            try:
                ib.connect(
                    host=host,
                    port=port,
                    clientId=client_id,
                    timeout=timeout,
                    readonly=True
                )
            except asyncio.TimeoutError:
                logger.warning("Connection sync timed out, checking if still connected...")
                if not ib.isConnected():
                    raise

            if not ib.isConnected():
                raise ConnectionError("Connection failed")

            # Set market data type
            ib.reqMarketDataType(settings.ibkr_market_data_type)

            # Get managed accounts
            self._accounts = ib.managedAccounts()
            logger.info(f"Found accounts: {self._accounts}")

            self._connected = True
            self._connection_time = datetime.now()
            self._active_client_id = client_id

            logger.info(f"Successfully connected to IBKR")

            return ConnectionStatus(
                is_connected=True,
                host=host,
                port=port,
                client_id=client_id,
                server_version=ib.client.serverVersion() if ib.client else None,
                connection_time=self._connection_time.isoformat() if self._connection_time else None,
                accounts=self._accounts
            )

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to connect to IBKR: {error_msg}")

            self._ib = None

            # Retry logic
            max_retries = 3
            is_conflict = any(phrase in error_msg.lower() for phrase in [
                "client id", "already in use", "duplicate", "clientid", "connection refused"
            ])

            if is_conflict and _retry_count < max_retries:
                logger.info(f"Connection issue, retry {_retry_count + 1}/{max_retries}...")
                import time
                time.sleep(1)

                return self.connect(
                    host=host,
                    port=port,
                    client_id=generate_client_id(),
                    timeout=timeout,
                    _retry_count=_retry_count + 1
                )

            return ConnectionStatus(
                is_connected=False,
                host=host,
                port=port,
                client_id=client_id,
                error_message=error_msg,
                accounts=[]
            )

    def disconnect(self) -> ConnectionStatus:
        """Disconnect from IBKR."""
        logger.info("Disconnecting from IBKR...")
        try:
            if self._ib and self._ib.isConnected():
                self._ib.disconnect()
        except Exception as e:
            logger.warning(f"Disconnect warning: {e}")
        finally:
            self._ib = None
            self._connected = False
            self._connection_time = None
            self._active_client_id = None
            self._accounts = []

        return ConnectionStatus(
            is_connected=False,
            host=settings.ibkr_host,
            port=settings.ibkr_port,
            client_id=0,
            accounts=[]
        )

    def get_status(self) -> ConnectionStatus:
        """Get current connection status."""
        return ConnectionStatus(
            is_connected=self.is_connected,
            host=settings.ibkr_host,
            port=settings.ibkr_port,
            client_id=self._active_client_id or 0,
            connection_time=self._connection_time.isoformat() if self._connection_time else None,
            accounts=self._accounts if self._accounts else []
        )

    def get_positions(self, account: Optional[str] = None) -> List[dict]:
        """Get current positions from IBKR."""
        if not self.is_connected:
            logger.warning("get_positions: Not connected")
            return []

        try:
            logger.info("Requesting positions from IBKR...")

            positions = self._ib.positions()

            if not positions:
                logger.info("No cached positions, requesting...")
                self._ib.reqPositions()
                self._ib.sleep(2)
                positions = self._ib.positions()

            if account:
                positions = [p for p in positions if p.account == account]

            logger.info(f"Found {len(positions)} position(s)")

            result = []
            for pos in positions:
                position_data = {
                    'account': pos.account,
                    'symbol': pos.contract.symbol,
                    'sec_type': pos.contract.secType,
                    'quantity': float(pos.position),
                    'avg_cost': float(pos.avgCost),
                    'con_id': pos.contract.conId
                }

                # Add option-specific fields
                if pos.contract.secType == 'OPT':
                    position_data.update({
                        'strike': float(pos.contract.strike) if pos.contract.strike else None,
                        'expiry': pos.contract.lastTradeDateOrContractMonth,
                        'right': pos.contract.right,
                        'multiplier': pos.contract.multiplier or '100'
                    })

                result.append(position_data)

            return result

        except Exception as e:
            logger.error(f"Error getting positions: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []

    def get_account_summary(self, account: Optional[str] = None) -> dict:
        """Get account summary from IBKR."""
        if not self.is_connected:
            return {}

        try:
            if not account and self._accounts:
                account = self._accounts[0]

            if not account:
                return {}

            summary = {}
            account_values = self._ib.accountValues(account)

            for av in account_values:
                if av.currency == 'USD' or av.currency == '':
                    summary[av.tag] = {
                        'value': av.value,
                        'currency': av.currency
                    }

            return summary

        except Exception as e:
            logger.error(f"Error getting account summary: {e}")
            return {}

    def get_stock_price(self, symbol: str) -> Optional[float]:
        """Get current price for a stock."""
        if not self.is_connected:
            logger.warning(f"get_stock_price: Not connected")
            return None

        _ensure_ib_insync_imported()

        try:
            contract = Stock(symbol.upper(), 'SMART', 'USD')
            self._ib.qualifyContracts(contract)

            ticker = self._ib.reqMktData(contract, '', False, False)

            # Wait for data with a short timeout loop
            for _ in range(10):  # Max 5 seconds (10 * 0.5s)
                self._ib.sleep(0.5)
                price = ticker.marketPrice()
                if not util.isNan(price):
                    self._ib.cancelMktData(contract)
                    return float(price)

            # If still NaN after waiting, try last price
            self._ib.cancelMktData(contract)
            if ticker.last and not util.isNan(ticker.last):
                return float(ticker.last)
            if ticker.close and not util.isNan(ticker.close):
                return float(ticker.close)

            logger.warning(f"No price data available for {symbol}")
            return None

        except Exception as e:
            logger.error(f"Error getting price for {symbol}: {e}")
            return None

    def get_option_chain_expirations(self, symbol: str) -> List[str]:
        """Get available option expirations for a symbol."""
        if not self.is_connected:
            logger.warning(f"get_option_chain_expirations: Not connected")
            return []

        _ensure_ib_insync_imported()

        try:
            contract = Stock(symbol.upper(), 'SMART', 'USD')
            self._ib.qualifyContracts(contract)

            chains = self._ib.reqSecDefOptParams(
                contract.symbol,
                '',
                contract.secType,
                contract.conId
            )

            expirations = set()
            for chain in chains:
                expirations.update(chain.expirations)

            return sorted(list(expirations))
        except Exception as e:
            logger.error(f"Error getting expirations for {symbol}: {e}")
            return []

    def get_option_chain_strikes(self, symbol: str, expiry: str) -> List[float]:
        """Get available strikes for a symbol and expiry."""
        if not self.is_connected:
            logger.warning(f"get_option_chain_strikes: Not connected")
            return []

        _ensure_ib_insync_imported()

        try:
            contract = Stock(symbol.upper(), 'SMART', 'USD')
            self._ib.qualifyContracts(contract)

            chains = self._ib.reqSecDefOptParams(
                contract.symbol,
                '',
                contract.secType,
                contract.conId
            )

            strikes = set()
            for chain in chains:
                if expiry in chain.expirations:
                    strikes.update(chain.strikes)

            return sorted([float(s) for s in strikes])
        except Exception as e:
            logger.error(f"Error getting strikes for {symbol} {expiry}: {e}")
            return []

    def get_option_data(
        self,
        symbol: str,
        expiry: str,
        strike: float,
        right: str
    ) -> Optional[dict]:
        """Get data for a specific option contract."""
        if not self.is_connected:
            logger.warning(f"get_option_data: Not connected")
            return None

        _ensure_ib_insync_imported()

        try:
            contract = Option(
                symbol=symbol.upper(),
                lastTradeDateOrContractMonth=expiry,
                strike=strike,
                right=right.upper(),
                exchange='SMART',
                currency='USD'
            )

            self._ib.qualifyContracts(contract)

            ticker = self._ib.reqMktData(contract, '', False, False)

            # Wait for data - reduced timeout (max 1 second)
            for _ in range(2):
                self._ib.sleep(0.5)
                if ticker.bid and not util.isNan(ticker.bid):
                    break

            result = {
                'symbol': symbol,
                'expiry': expiry,
                'strike': strike,
                'right': right,
                'bid': float(ticker.bid) if ticker.bid and not util.isNan(ticker.bid) else None,
                'ask': float(ticker.ask) if ticker.ask and not util.isNan(ticker.ask) else None,
                'last': float(ticker.last) if ticker.last and not util.isNan(ticker.last) else None,
                'volume': int(ticker.volume) if ticker.volume and not util.isNan(ticker.volume) else 0,
                'open_interest': 0  # Open interest requires separate request
            }

            # Get Greeks if available
            if ticker.modelGreeks:
                result.update({
                    'iv': float(ticker.modelGreeks.impliedVol) if ticker.modelGreeks.impliedVol else None,
                    'delta': float(ticker.modelGreeks.delta) if ticker.modelGreeks.delta else None,
                    'gamma': float(ticker.modelGreeks.gamma) if ticker.modelGreeks.gamma else None,
                    'theta': float(ticker.modelGreeks.theta) if ticker.modelGreeks.theta else None,
                    'vega': float(ticker.modelGreeks.vega) if ticker.modelGreeks.vega else None
                })

            self._ib.cancelMktData(contract)

            return result
        except Exception as e:
            logger.error(f"Error getting option data for {symbol}: {e}")
            return None

    def get_option_chain_bulk(
        self,
        symbol: str,
        expiry: str,
        strikes: List[float]
    ) -> List[dict]:
        """Get option data for multiple strikes at once (more efficient)."""
        if not self.is_connected:
            logger.warning(f"get_option_chain_bulk: Not connected")
            return []

        _ensure_ib_insync_imported()

        results = []
        tickers = []
        contracts = []

        try:
            # Create all contracts first
            for strike in strikes:
                for right in ['C', 'P']:
                    contract = Option(
                        symbol=symbol.upper(),
                        lastTradeDateOrContractMonth=expiry,
                        strike=strike,
                        right=right,
                        exchange='SMART',
                        currency='USD'
                    )
                    contracts.append((contract, strike, right))

            # Qualify all contracts
            contract_list = [c[0] for c in contracts]
            self._ib.qualifyContracts(*contract_list)

            # Request market data for all at once
            for contract, strike, right in contracts:
                ticker = self._ib.reqMktData(contract, '', False, False)
                tickers.append((ticker, contract, strike, right))

            # Wait for data to arrive (single wait for all)
            self._ib.sleep(1.5)

            # Collect results
            for ticker, contract, strike, right in tickers:
                result = {
                    'symbol': symbol,
                    'expiry': expiry,
                    'strike': strike,
                    'right': right,
                    'bid': float(ticker.bid) if ticker.bid and not util.isNan(ticker.bid) else None,
                    'ask': float(ticker.ask) if ticker.ask and not util.isNan(ticker.ask) else None,
                    'last': float(ticker.last) if ticker.last and not util.isNan(ticker.last) else None,
                    'volume': int(ticker.volume) if ticker.volume and not util.isNan(ticker.volume) else 0,
                    'open_interest': 0
                }

                if ticker.modelGreeks:
                    result.update({
                        'iv': float(ticker.modelGreeks.impliedVol) if ticker.modelGreeks.impliedVol else None,
                        'delta': float(ticker.modelGreeks.delta) if ticker.modelGreeks.delta else None,
                        'gamma': float(ticker.modelGreeks.gamma) if ticker.modelGreeks.gamma else None,
                        'theta': float(ticker.modelGreeks.theta) if ticker.modelGreeks.theta else None,
                        'vega': float(ticker.modelGreeks.vega) if ticker.modelGreeks.vega else None
                    })

                results.append(result)
                self._ib.cancelMktData(contract)

            return results
        except Exception as e:
            logger.error(f"Error getting bulk option data for {symbol}: {e}")
            # Cancel any pending market data
            for ticker, contract, _, _ in tickers:
                try:
                    self._ib.cancelMktData(contract)
                except:
                    pass
            return []


# Convenience function
def get_ibkr_service() -> IBKRService:
    """Get the IBKR service singleton."""
    return IBKRService.get_instance()
