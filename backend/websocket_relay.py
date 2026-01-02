"""WebSocket relay manager for IBKR connections.

This module manages WebSocket connections from user relay agents.
Each user runs a local relay agent that:
1. Connects to their local IB Gateway
2. Opens a WebSocket to this server
3. Proxies IBKR commands back and forth

This allows the cloud backend to communicate with each user's
local IB Gateway without requiring port forwarding or VPN.
"""

import asyncio
import json
import logging
from typing import Dict, Optional, Any, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime
import uuid

from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)


@dataclass
class RelayConnection:
    """Represents a connected relay agent."""
    user_id: str
    websocket: WebSocket
    connected_at: datetime = field(default_factory=datetime.utcnow)
    last_heartbeat: datetime = field(default_factory=datetime.utcnow)
    ibkr_connected: bool = False
    ibkr_account: Optional[str] = None
    pending_requests: Dict[str, asyncio.Future] = field(default_factory=dict)


class RelayManager:
    """Manages WebSocket connections from user relay agents."""

    def __init__(self):
        self._connections: Dict[str, RelayConnection] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, websocket: WebSocket) -> bool:
        """Register a new relay connection for a user.

        Args:
            user_id: The authenticated user's ID
            websocket: The WebSocket connection

        Returns:
            True if connected successfully
        """
        async with self._lock:
            # Close existing connection if any
            if user_id in self._connections:
                old_conn = self._connections[user_id]
                try:
                    await old_conn.websocket.close(code=1000, reason="New connection")
                except Exception:
                    pass

            self._connections[user_id] = RelayConnection(
                user_id=user_id,
                websocket=websocket
            )
            logger.info(f"Relay connected for user {user_id}")
            return True

    async def disconnect(self, user_id: str):
        """Remove a relay connection."""
        async with self._lock:
            if user_id in self._connections:
                conn = self._connections.pop(user_id)
                # Cancel all pending requests
                for future in conn.pending_requests.values():
                    if not future.done():
                        future.cancel()
                logger.info(f"Relay disconnected for user {user_id}")

    def is_connected(self, user_id: str) -> bool:
        """Check if a user's relay is connected."""
        if user_id not in self._connections:
            return False

        conn = self._connections[user_id]
        return conn.websocket.client_state == WebSocketState.CONNECTED

    def get_connection_status(self, user_id: str) -> Dict[str, Any]:
        """Get detailed connection status for a user."""
        if user_id not in self._connections:
            return {
                "connected": False,
                "ibkr_connected": False,
                "account": None
            }

        conn = self._connections[user_id]
        return {
            "connected": conn.websocket.client_state == WebSocketState.CONNECTED,
            "ibkr_connected": conn.ibkr_connected,
            "account": conn.ibkr_account,
            "connected_at": conn.connected_at.isoformat(),
            "last_heartbeat": conn.last_heartbeat.isoformat()
        }

    async def send_request(
        self,
        user_id: str,
        action: str,
        params: Optional[Dict[str, Any]] = None,
        timeout: float = 30.0
    ) -> Dict[str, Any]:
        """Send a request to the user's relay agent and wait for response.

        Args:
            user_id: The user's ID
            action: The action to perform (e.g., "get_positions", "get_price")
            params: Optional parameters for the action
            timeout: Request timeout in seconds

        Returns:
            The response from the relay agent

        Raises:
            ConnectionError: If relay is not connected
            TimeoutError: If request times out
            RuntimeError: If relay returns an error
        """
        if not self.is_connected(user_id):
            raise ConnectionError("IBKR relay not connected")

        conn = self._connections[user_id]

        # Generate request ID
        request_id = str(uuid.uuid4())

        # Create future for response
        response_future: asyncio.Future = asyncio.Future()
        conn.pending_requests[request_id] = response_future

        try:
            # Send request
            request = {
                "id": request_id,
                "action": action,
                "params": params or {}
            }
            await conn.websocket.send_json(request)

            # Wait for response with timeout
            try:
                response = await asyncio.wait_for(response_future, timeout=timeout)
            except asyncio.TimeoutError:
                raise TimeoutError(f"Request {action} timed out after {timeout}s")

            # Check for error
            if response.get("error"):
                raise RuntimeError(response["error"])

            return response.get("data", {})

        finally:
            # Clean up pending request
            conn.pending_requests.pop(request_id, None)

    async def handle_message(self, user_id: str, message: Dict[str, Any]):
        """Handle an incoming message from a relay agent.

        Messages can be:
        - Response to a request (has "id" matching a pending request)
        - Status update (e.g., IBKR connection status)
        - Heartbeat
        """
        if user_id not in self._connections:
            return

        conn = self._connections[user_id]
        conn.last_heartbeat = datetime.utcnow()

        message_type = message.get("type", "response")

        if message_type == "response":
            # Match to pending request
            request_id = message.get("id")
            if request_id and request_id in conn.pending_requests:
                future = conn.pending_requests[request_id]
                if not future.done():
                    future.set_result(message)

        elif message_type == "status":
            # Update connection status
            conn.ibkr_connected = message.get("ibkr_connected", False)
            conn.ibkr_account = message.get("account")
            logger.info(f"Relay status update for {user_id}: IBKR={conn.ibkr_connected}")

        elif message_type == "heartbeat":
            # Just update last_heartbeat (already done above)
            pass

    async def broadcast_to_user(self, user_id: str, message: Dict[str, Any]):
        """Send a message to a specific user's relay (if connected)."""
        if self.is_connected(user_id):
            conn = self._connections[user_id]
            try:
                await conn.websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to relay {user_id}: {e}")

    def get_all_connections(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all connections (for admin monitoring)."""
        return {
            user_id: self.get_connection_status(user_id)
            for user_id in self._connections
        }


# Singleton instance
relay_manager = RelayManager()


# ==================== IBKR PROXY SERVICE ====================

class IBKRProxyService:
    """Proxy service that routes IBKR requests through WebSocket relay.

    This replaces direct IBKR connections in production.
    Each method sends a request to the user's relay agent.
    """

    def __init__(self, user_id: str):
        self.user_id = user_id
        self.relay = relay_manager

    def is_connected(self) -> bool:
        """Check if the IBKR relay is connected."""
        status = self.relay.get_connection_status(self.user_id)
        return status.get("ibkr_connected", False)

    def get_status(self) -> Dict[str, Any]:
        """Get IBKR connection status."""
        return self.relay.get_connection_status(self.user_id)

    async def get_accounts(self) -> list:
        """Get list of managed accounts."""
        result = await self.relay.send_request(
            self.user_id,
            "get_accounts"
        )
        return result.get("accounts", [])

    async def get_positions(self, account: Optional[str] = None) -> list:
        """Get current positions from IBKR."""
        result = await self.relay.send_request(
            self.user_id,
            "get_positions",
            {"account": account}
        )
        return result.get("positions", [])

    async def get_portfolio(self, account: Optional[str] = None) -> list:
        """Get portfolio items (stocks) from IBKR."""
        result = await self.relay.send_request(
            self.user_id,
            "get_portfolio",
            {"account": account}
        )
        return result.get("portfolio", [])

    async def get_price(self, symbol: str) -> Optional[float]:
        """Get current price for a symbol."""
        result = await self.relay.send_request(
            self.user_id,
            "get_price",
            {"symbol": symbol}
        )
        return result.get("price")

    async def get_option_expirations(self, symbol: str) -> list:
        """Get available option expirations for a symbol."""
        result = await self.relay.send_request(
            self.user_id,
            "get_option_expirations",
            {"symbol": symbol}
        )
        return result.get("expirations", [])

    async def get_option_strikes(self, symbol: str, expiry: str) -> list:
        """Get available strikes for a symbol and expiration."""
        result = await self.relay.send_request(
            self.user_id,
            "get_option_strikes",
            {"symbol": symbol, "expiry": expiry}
        )
        return result.get("strikes", [])

    async def get_option_data(
        self,
        symbol: str,
        expiry: str,
        strike: float,
        option_type: str
    ) -> Dict[str, Any]:
        """Get option quote data including Greeks."""
        result = await self.relay.send_request(
            self.user_id,
            "get_option_data",
            {
                "symbol": symbol,
                "expiry": expiry,
                "strike": strike,
                "option_type": option_type
            }
        )
        return result

    async def get_option_chain(
        self,
        symbol: str,
        expiry: str,
        strikes: Optional[list] = None
    ) -> Dict[str, Any]:
        """Get full option chain for a symbol and expiration."""
        result = await self.relay.send_request(
            self.user_id,
            "get_option_chain",
            {
                "symbol": symbol,
                "expiry": expiry,
                "strikes": strikes
            },
            timeout=60.0  # Longer timeout for chain data
        )
        return result


def get_ibkr_proxy(user_id: str) -> IBKRProxyService:
    """Factory function to get IBKR proxy for a user."""
    return IBKRProxyService(user_id)
