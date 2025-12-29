/**
 * API client for Options Buddy backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ==================== Types ====================

export interface ConnectionStatus {
  is_connected: boolean;
  host: string;
  port: number;
  client_id: number;
  server_version?: number;
  connection_time?: string;
  error_message?: string;
  accounts?: string[];
}

export interface Position {
  id: number;
  underlying: string;
  option_type: 'CALL' | 'PUT';
  strike: number;
  expiry: string;
  quantity: number;
  premium_collected: number;
  open_date: string;
  close_date?: string;
  close_price?: number;
  status: string;
  strategy_type: string;
  notes?: string;
  days_to_expiry?: number;
}

export interface StockHolding {
  id: number;
  symbol: string;
  quantity: number;
  avg_cost?: number;
  current_price?: number;
  market_value?: number;
  unrealized_pnl?: number;
  last_synced?: string;
}

export interface Watchlist {
  id: number;
  name: string;
  description?: string;
  symbols: string[];
}

export interface ScanResult {
  symbol: string;
  strike: number;
  expiry: string;
  dte: number;
  option_type: 'CALL' | 'PUT';
  bid?: number;
  ask?: number;
  iv?: number;
  delta?: number;
  theta?: number;
  score: number;
}

export interface PortfolioSummary {
  open_positions: number;
  total_premium: number;
  stock_holdings: number;
  holdings_value: number;
  holdings_pnl: number;
  cc_lots_available: number;
  realized_pnl: number;
  win_rate: number;
  total_trades: number;
}

export interface PerformanceStats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_realized_pnl: number;
  avg_win: number;
  avg_loss: number;
  best_trade?: { symbol: string; pnl: number };
  worst_trade?: { symbol: string; pnl: number };
  profit_factor: number;
}

// ==================== API Client ====================

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `API error: ${response.status}`);
    }

    return response.json();
  }

  // ==================== Health ====================

  async healthCheck(): Promise<{ status: string; ibkr_connected: boolean }> {
    return this.request('/health');
  }

  // ==================== IBKR Connection ====================

  async getIBKRStatus(): Promise<ConnectionStatus> {
    return this.request('/api/ibkr/status');
  }

  async connectIBKR(
    host?: string,
    port?: number,
    clientId?: number
  ): Promise<ConnectionStatus> {
    return this.request('/api/ibkr/connect', {
      method: 'POST',
      body: JSON.stringify({ host, port, client_id: clientId }),
    });
  }

  async disconnectIBKR(): Promise<ConnectionStatus> {
    return this.request('/api/ibkr/disconnect', { method: 'POST' });
  }

  async getIBKRAccounts(): Promise<{ accounts: string[] }> {
    return this.request('/api/ibkr/accounts');
  }

  async getAccountSummary(account?: string): Promise<Record<string, { value: string; currency: string }>> {
    const params = account ? `?account=${account}` : '';
    return this.request(`/api/ibkr/account-summary${params}`);
  }

  // ==================== Positions ====================

  async getPositions(status: 'open' | 'closed' = 'open'): Promise<{ positions: Position[] }> {
    return this.request(`/api/positions?status=${status}`);
  }

  async getPosition(id: number): Promise<Position> {
    return this.request(`/api/positions/${id}`);
  }

  async createPosition(position: Omit<Position, 'id' | 'status' | 'days_to_expiry'>): Promise<{ id: number }> {
    return this.request('/api/positions', {
      method: 'POST',
      body: JSON.stringify(position),
    });
  }

  async updatePosition(id: number, updates: Partial<Position>): Promise<{ message: string }> {
    return this.request(`/api/positions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async closePosition(
    id: number,
    closePrice: number,
    closeDate?: string,
    status?: string
  ): Promise<{ message: string }> {
    return this.request(`/api/positions/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ close_price: closePrice, close_date: closeDate, status }),
    });
  }

  // ==================== IBKR Sync ====================

  async getIBKRPositions(account?: string): Promise<{ positions: any[] }> {
    const params = account ? `?account=${account}` : '';
    return this.request(`/api/ibkr/positions${params}`);
  }

  async syncFromIBKR(account?: string): Promise<{ message: string; stocks_synced: number; options_found: number }> {
    const params = account ? `?account=${account}` : '';
    return this.request(`/api/ibkr/sync${params}`, { method: 'POST' });
  }

  // ==================== Stock Holdings ====================

  async getHoldings(): Promise<{ holdings: StockHolding[] }> {
    return this.request('/api/holdings');
  }

  async upsertHolding(holding: {
    symbol: string;
    quantity: number;
    avg_cost?: number;
    current_price?: number;
  }): Promise<{ id: number }> {
    return this.request('/api/holdings', {
      method: 'POST',
      body: JSON.stringify(holding),
    });
  }

  async deleteHolding(symbol: string): Promise<{ message: string }> {
    return this.request(`/api/holdings/${symbol}`, { method: 'DELETE' });
  }

  // ==================== Watchlists ====================

  async getWatchlists(): Promise<{ watchlists: Watchlist[] }> {
    return this.request('/api/watchlists');
  }

  async createWatchlist(
    name: string,
    description?: string,
    symbols?: string[]
  ): Promise<{ id: number }> {
    return this.request('/api/watchlists', {
      method: 'POST',
      body: JSON.stringify({ name, description, symbols }),
    });
  }

  async addSymbolToWatchlist(watchlistId: number, symbol: string): Promise<{ message: string }> {
    return this.request(`/api/watchlists/${watchlistId}/symbols`, {
      method: 'POST',
      body: JSON.stringify({ symbol }),
    });
  }

  async removeSymbolFromWatchlist(watchlistId: number, symbol: string): Promise<{ message: string }> {
    return this.request(`/api/watchlists/${watchlistId}/symbols/${symbol}`, {
      method: 'DELETE',
    });
  }

  // ==================== Market Data ====================

  async getStockPrice(symbol: string): Promise<{ symbol: string; price: number }> {
    return this.request(`/api/market/price/${symbol}`);
  }

  async getOptionExpirations(symbol: string): Promise<{ symbol: string; expirations: string[] }> {
    return this.request(`/api/market/options/expirations/${symbol}`);
  }

  async getOptionStrikes(symbol: string, expiry: string): Promise<{ symbol: string; expiry: string; strikes: number[] }> {
    return this.request(`/api/market/options/strikes/${symbol}/${expiry}`);
  }

  async getOptionData(
    symbol: string,
    expiry: string,
    strike: number,
    right: 'C' | 'P'
  ): Promise<{
    symbol: string;
    expiry: string;
    strike: number;
    right: string;
    bid?: number;
    ask?: number;
    last?: number;
    volume?: number;
    open_interest?: number;
    iv?: number;
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  }> {
    return this.request(
      `/api/market/options/data?symbol=${symbol}&expiry=${expiry}&strike=${strike}&right=${right}`
    );
  }

  // ==================== Scanner ====================

  async runScan(request: {
    symbols: string[];
    strategy: string;
    min_dte?: number;
    max_dte?: number;
    min_delta?: number;
    max_delta?: number;
  }): Promise<{ results: ScanResult[] }> {
    return this.request('/api/scanner/scan', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ==================== Performance ====================

  async getPerformance(): Promise<PerformanceStats> {
    return this.request('/api/performance');
  }

  // ==================== Portfolio Summary ====================

  async getPortfolioSummary(): Promise<PortfolioSummary> {
    return this.request('/api/portfolio/summary');
  }
}

// Export singleton instance
export const api = new ApiClient();

// Export class for custom instances
export { ApiClient };
