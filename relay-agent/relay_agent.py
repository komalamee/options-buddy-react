#!/usr/bin/env python3
"""Options Buddy IBKR Relay Agent.

This script runs on the user's local machine alongside IB Gateway.
It bridges the local IB Gateway to the cloud Options Buddy backend
via a secure WebSocket connection.

Usage:
    python relay_agent.py --token <your-jwt-token> --server wss://your-backend.railway.app

Requirements:
    pip install ib_insync websockets
"""

import argparse
import asyncio
import json
import logging
import signal
import sys
from datetime import datetime
from typing import Optional, Dict, Any

import websockets
from websockets.exceptions import ConnectionClosed

# IB Gateway connection
try:
    from ib_insync import IB, Stock, Option, util
    IB_AVAILABLE = True
except ImportError:
    IB_AVAILABLE = False
    print("Warning: ib_insync not installed. Install with: pip install ib_insync")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class IBKRRelayAgent:
    """Relay agent that bridges local IB Gateway to cloud backend."""

    def __init__(
        self,
        token: str,
        server_url: str,
        ibkr_host: str = "127.0.0.1",
        ibkr_port: int = 4001,
        ibkr_client_id: int = 10  # Use different ID from main app
    ):
        self.token = token
        self.server_url = server_url
        self.ibkr_host = ibkr_host
        self.ibkr_port = ibkr_port
        self.ibkr_client_id = ibkr_client_id

        self.ib: Optional[IB] = None
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.running = False
        self.reconnect_delay = 5

    async def connect_ibkr(self) -> bool:
        """Connect to local IB Gateway."""
        if not IB_AVAILABLE:
            logger.error("ib_insync not available")
            return False

        try:
            self.ib = IB()
            await asyncio.wait_for(
                asyncio.to_thread(
                    self.ib.connect,
                    self.ibkr_host,
                    self.ibkr_port,
                    clientId=self.ibkr_client_id,
                    readonly=True
                ),
                timeout=10.0
            )
            logger.info(f"Connected to IB Gateway at {self.ibkr_host}:{self.ibkr_port}")
            return True

        except asyncio.TimeoutError:
            logger.error("Timeout connecting to IB Gateway")
            return False
        except Exception as e:
            logger.error(f"Failed to connect to IB Gateway: {e}")
            return False

    async def disconnect_ibkr(self):
        """Disconnect from IB Gateway."""
        if self.ib and self.ib.isConnected():
            self.ib.disconnect()
            logger.info("Disconnected from IB Gateway")

    async def connect_server(self) -> bool:
        """Connect to cloud backend WebSocket."""
        try:
            ws_url = f"{self.server_url}/api/ibkr/relay"
            headers = {"Authorization": f"Bearer {self.token}"}

            self.ws = await websockets.connect(
                ws_url,
                extra_headers=headers,
                ping_interval=30,
                ping_timeout=10
            )
            logger.info(f"Connected to server: {self.server_url}")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to server: {e}")
            return False

    async def send_status(self):
        """Send current status to server."""
        if not self.ws:
            return

        status = {
            "type": "status",
            "ibkr_connected": self.ib.isConnected() if self.ib else False,
            "account": self.ib.managedAccounts()[0] if self.ib and self.ib.managedAccounts() else None,
            "timestamp": datetime.utcnow().isoformat()
        }

        try:
            await self.ws.send(json.dumps(status))
        except Exception as e:
            logger.error(f"Failed to send status: {e}")

    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle an IBKR request from the server.

        Args:
            request: The request containing action and params

        Returns:
            Response dict with data or error
        """
        request_id = request.get("id", "unknown")
        action = request.get("action", "")
        params = request.get("params", {})

        logger.info(f"Handling request: {action}")

        try:
            if not self.ib or not self.ib.isConnected():
                return {
                    "id": request_id,
                    "type": "response",
                    "error": "IB Gateway not connected"
                }

            data = await self._execute_action(action, params)

            return {
                "id": request_id,
                "type": "response",
                "data": data
            }

        except Exception as e:
            logger.error(f"Error handling {action}: {e}")
            return {
                "id": request_id,
                "type": "response",
                "error": str(e)
            }

    async def _execute_action(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute an IBKR action."""

        if action == "get_accounts":
            accounts = self.ib.managedAccounts()
            return {"accounts": accounts}

        elif action == "get_positions":
            positions = self.ib.positions(params.get("account"))
            return {
                "positions": [
                    {
                        "account": pos.account,
                        "symbol": pos.contract.symbol,
                        "secType": pos.contract.secType,
                        "exchange": pos.contract.exchange,
                        "currency": pos.contract.currency,
                        "position": pos.position,
                        "avgCost": pos.avgCost,
                        "conId": pos.contract.conId,
                        # Option-specific fields
                        "strike": getattr(pos.contract, 'strike', None),
                        "right": getattr(pos.contract, 'right', None),
                        "expiry": getattr(pos.contract, 'lastTradeDateOrContractMonth', None),
                    }
                    for pos in positions
                ]
            }

        elif action == "get_portfolio":
            portfolio = self.ib.portfolio(params.get("account"))
            return {
                "portfolio": [
                    {
                        "account": item.account,
                        "symbol": item.contract.symbol,
                        "secType": item.contract.secType,
                        "position": item.position,
                        "marketPrice": item.marketPrice,
                        "marketValue": item.marketValue,
                        "averageCost": item.averageCost,
                        "unrealizedPNL": item.unrealizedPNL,
                        "realizedPNL": item.realizedPNL,
                        "conId": item.contract.conId,
                    }
                    for item in portfolio
                ]
            }

        elif action == "get_price":
            symbol = params.get("symbol", "").upper()
            contract = Stock(symbol, "SMART", "USD")
            self.ib.qualifyContracts(contract)

            ticker = self.ib.reqMktData(contract, snapshot=True)
            await asyncio.sleep(2)  # Wait for data
            self.ib.cancelMktData(contract)

            price = ticker.marketPrice()
            if price != price:  # NaN check
                price = ticker.close or ticker.last

            return {"price": price if price == price else None}

        elif action == "get_option_expirations":
            symbol = params.get("symbol", "").upper()
            contract = Stock(symbol, "SMART", "USD")
            self.ib.qualifyContracts(contract)

            chains = self.ib.reqSecDefOptParams(
                contract.symbol,
                "",
                contract.secType,
                contract.conId
            )

            expirations = set()
            for chain in chains:
                expirations.update(chain.expirations)

            return {"expirations": sorted(list(expirations))}

        elif action == "get_option_strikes":
            symbol = params.get("symbol", "").upper()
            expiry = params.get("expiry", "")

            contract = Stock(symbol, "SMART", "USD")
            self.ib.qualifyContracts(contract)

            chains = self.ib.reqSecDefOptParams(
                contract.symbol,
                "",
                contract.secType,
                contract.conId
            )

            strikes = set()
            for chain in chains:
                if expiry in chain.expirations:
                    strikes.update(chain.strikes)

            return {"strikes": sorted(list(strikes))}

        elif action == "get_option_data":
            symbol = params.get("symbol", "").upper()
            expiry = params.get("expiry", "")
            strike = params.get("strike", 0)
            option_type = params.get("option_type", "C")

            right = "C" if option_type.upper() in ["C", "CALL"] else "P"
            contract = Option(symbol, expiry, strike, right, "SMART")
            self.ib.qualifyContracts(contract)

            ticker = self.ib.reqMktData(contract, snapshot=True)
            await asyncio.sleep(2)
            self.ib.cancelMktData(contract)

            return {
                "bid": ticker.bid if ticker.bid == ticker.bid else None,
                "ask": ticker.ask if ticker.ask == ticker.ask else None,
                "last": ticker.last if ticker.last == ticker.last else None,
                "volume": ticker.volume if ticker.volume == ticker.volume else 0,
                "delta": ticker.modelGreeks.delta if ticker.modelGreeks else None,
                "gamma": ticker.modelGreeks.gamma if ticker.modelGreeks else None,
                "theta": ticker.modelGreeks.theta if ticker.modelGreeks else None,
                "vega": ticker.modelGreeks.vega if ticker.modelGreeks else None,
                "iv": ticker.modelGreeks.impliedVol if ticker.modelGreeks else None,
            }

        elif action == "get_option_chain":
            symbol = params.get("symbol", "").upper()
            expiry = params.get("expiry", "")
            strikes = params.get("strikes", [])

            chain_data = {"calls": [], "puts": []}

            for strike in strikes[:20]:  # Limit to 20 strikes
                for right in ["C", "P"]:
                    try:
                        contract = Option(symbol, expiry, strike, right, "SMART")
                        self.ib.qualifyContracts(contract)

                        ticker = self.ib.reqMktData(contract, snapshot=True)
                        await asyncio.sleep(0.5)
                        self.ib.cancelMktData(contract)

                        option_data = {
                            "strike": strike,
                            "bid": ticker.bid if ticker.bid == ticker.bid else None,
                            "ask": ticker.ask if ticker.ask == ticker.ask else None,
                            "last": ticker.last if ticker.last == ticker.last else None,
                            "volume": ticker.volume if ticker.volume == ticker.volume else 0,
                            "delta": ticker.modelGreeks.delta if ticker.modelGreeks else None,
                            "iv": ticker.modelGreeks.impliedVol if ticker.modelGreeks else None,
                        }

                        if right == "C":
                            chain_data["calls"].append(option_data)
                        else:
                            chain_data["puts"].append(option_data)

                    except Exception as e:
                        logger.warning(f"Failed to get data for {symbol} {expiry} {strike}{right}: {e}")

            return chain_data

        else:
            raise ValueError(f"Unknown action: {action}")

    async def message_loop(self):
        """Main loop for handling WebSocket messages."""
        if not self.ws:
            return

        try:
            async for message in self.ws:
                try:
                    request = json.loads(message)
                    response = await self.handle_request(request)
                    await self.ws.send(json.dumps(response))
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON received: {message}")
                except Exception as e:
                    logger.error(f"Error processing message: {e}")

        except ConnectionClosed:
            logger.warning("WebSocket connection closed")

    async def heartbeat_loop(self):
        """Send periodic heartbeats and status updates."""
        while self.running:
            try:
                await self.send_status()
                await asyncio.sleep(30)
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
                break

    async def run(self):
        """Main run loop with reconnection logic."""
        self.running = True

        # Set up signal handlers
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, lambda: asyncio.create_task(self.stop()))

        while self.running:
            try:
                # Connect to IB Gateway
                if not await self.connect_ibkr():
                    logger.warning(f"Retrying IBKR connection in {self.reconnect_delay}s...")
                    await asyncio.sleep(self.reconnect_delay)
                    continue

                # Connect to server
                if not await self.connect_server():
                    logger.warning(f"Retrying server connection in {self.reconnect_delay}s...")
                    await asyncio.sleep(self.reconnect_delay)
                    continue

                # Send initial status
                await self.send_status()

                # Run message and heartbeat loops
                await asyncio.gather(
                    self.message_loop(),
                    self.heartbeat_loop()
                )

            except Exception as e:
                logger.error(f"Connection error: {e}")

            finally:
                await self.disconnect_ibkr()
                if self.ws:
                    await self.ws.close()
                    self.ws = None

            if self.running:
                logger.info(f"Reconnecting in {self.reconnect_delay}s...")
                await asyncio.sleep(self.reconnect_delay)

    async def stop(self):
        """Stop the relay agent."""
        logger.info("Shutting down relay agent...")
        self.running = False
        await self.disconnect_ibkr()
        if self.ws:
            await self.ws.close()


def main():
    parser = argparse.ArgumentParser(
        description="Options Buddy IBKR Relay Agent"
    )
    parser.add_argument(
        "--token", "-t",
        required=True,
        help="JWT authentication token from Options Buddy"
    )
    parser.add_argument(
        "--server", "-s",
        default="wss://options-buddy-api.railway.app",
        help="WebSocket server URL"
    )
    parser.add_argument(
        "--ibkr-host",
        default="127.0.0.1",
        help="IB Gateway host (default: 127.0.0.1)"
    )
    parser.add_argument(
        "--ibkr-port",
        type=int,
        default=4001,
        help="IB Gateway port (default: 4001)"
    )
    parser.add_argument(
        "--client-id",
        type=int,
        default=10,
        help="IBKR client ID (default: 10)"
    )

    args = parser.parse_args()

    if not IB_AVAILABLE:
        print("Error: ib_insync is required. Install with: pip install ib_insync")
        sys.exit(1)

    agent = IBKRRelayAgent(
        token=args.token,
        server_url=args.server,
        ibkr_host=args.ibkr_host,
        ibkr_port=args.ibkr_port,
        ibkr_client_id=args.client_id
    )

    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║           Options Buddy IBKR Relay Agent                      ║
╠═══════════════════════════════════════════════════════════════╣
║  Server:     {args.server:<46} ║
║  IB Gateway: {args.ibkr_host}:{args.ibkr_port:<40} ║
║  Client ID:  {args.client_id:<46} ║
╚═══════════════════════════════════════════════════════════════╝

Starting relay agent... Press Ctrl+C to stop.
    """)

    asyncio.run(agent.run())


if __name__ == "__main__":
    main()
