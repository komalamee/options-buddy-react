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

export interface TradeDetail {
  id: number;
  symbol: string;
  underlying: string;
  option_type: 'CALL' | 'PUT';
  strike: number;
  expiry: string;
  pnl: number;
  premium_collected: number;
  close_price: number;
  quantity: number;
  strategy: string;
  open_date: string;
  close_date: string;
  status: string;
  is_winner: boolean;
}

export interface OpenPositionWithPnl {
  id: number;
  symbol: string;
  underlying: string;
  option_type: 'CALL' | 'PUT';
  strike: number;
  expiry: string;
  premium_collected: number;
  quantity: number;
  strategy: string;
  open_date: string;
  status: string;
  unrealized_pnl: number;
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
  trades: TradeDetail[];
}

export interface OpenPositionsResponse {
  positions: OpenPositionWithPnl[];
  total_unrealized_pnl: number;
  count: number;
}

export interface WheelChain {
  id: string;
  underlying: string;
  status: 'COLLECTING_PREMIUM' | 'HOLDING_SHARES' | 'CLOSED';
  assignment_strike: number | null;
  assignment_date: string | null;
  shares_acquired: number | null;
  total_put_premium: number;
  total_call_premium: number;
  assignment_cost: number | null;
  net_cost_basis: number | null;
  effective_cost_basis: number | null;
  break_even_price: number | null;
  exit_date: string | null;
  exit_price: number | null;
  exit_type: 'CALLED_AWAY' | 'SOLD' | null;
  realized_pnl: number | null;
  positions: Position[];
  days_in_chain: number;
  created_at: string;
  updated_at: string;
}

// Auto-detected wheel analysis (no manual linking required)
export interface AutoWheelAnalysis {
  id: string;
  underlying: string;
  status: 'COLLECTING_PREMIUM' | 'HOLDING_SHARES' | 'CLOSED';
  total_put_premium: number;
  total_call_premium: number;
  total_premium: number;
  pending_put_premium: number;
  pending_call_premium: number;
  pending_premium: number;
  assignment_cost: number | null;
  net_cost_basis: number | null;
  effective_cost_basis: number | null;
  break_even_price: number | null;
  shares_held: number;
  avg_cost: number | null;
  current_price: number | null;
  unrealized_pnl: number | null;
  positions: Position[];
  open_positions: Position[];
  closed_positions: Position[];
  assigned_positions: Position[];
  put_count: number;
  call_count: number;
  open_put_count: number;
  open_call_count: number;
  first_position_date: string | null;
  last_activity_date: string | null;
  days_active: number;
}

export interface AutoWheelSummary {
  total_underlyings: number;
  holding_shares_count: number;
  collecting_premium_count: number;
  total_premium_collected: number;
  total_pending_premium: number;
  average_cost_reduction: number;
}

export interface ImportHistoryRecord {
  id: number;
  filename: string;
  import_type: string;
  trades_imported: number;
  trades_skipped: number;
  errors: string | null;
  imported_at: string;
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

  async getIBKRPositions(account?: string): Promise<{ positions: unknown[] }> {
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

  // ==================== Market Status ====================

  async getMarketStatus(): Promise<{
    is_open: boolean;
    status: 'open' | 'closed' | 'pre_market' | 'after_hours';
    reason: string;
    message: string;
    current_time_et: string;
    next_open?: string;
    closes_at?: string;
  }> {
    return this.request('/api/market/status');
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

  async getOptionChainBulk(
    symbol: string,
    expiry: string,
    strikes: number[]
  ): Promise<{
    options: Array<{
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
    }>;
  }> {
    return this.request('/api/market/options/chain', {
      method: 'POST',
      body: JSON.stringify({ symbol, expiry, strikes }),
    });
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

  async runParityScan(request: {
    symbol: string;
    min_dte?: number;
    max_dte?: number;
    risk_free_rate?: number;
    parity_threshold?: number;
    max_results?: number;
  }): Promise<import('@/types/scanner').ParityScanResponse> {
    return this.request('/api/scanner/parity-scan', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ==================== Performance ====================

  async getPerformance(): Promise<PerformanceStats> {
    return this.request('/api/performance');
  }

  async getOpenPositionsWithPnl(): Promise<OpenPositionsResponse> {
    return this.request('/api/performance/open-positions');
  }

  // ==================== Portfolio Summary ====================

  async getPortfolioSummary(): Promise<PortfolioSummary> {
    return this.request('/api/portfolio/summary');
  }

  // ==================== Settings ====================

  async getAISettings(): Promise<{
    provider: string;
    model: string | null;
    api_key_set: boolean;
    available_providers: Record<string, boolean>;
  }> {
    return this.request('/api/settings/ai');
  }

  async saveAISettings(provider: string, apiKey: string, model?: string): Promise<{
    success: boolean;
    provider: string;
    model: string | null;
    api_key_set: boolean;
  }> {
    return this.request('/api/settings/ai', {
      method: 'POST',
      body: JSON.stringify({ provider, api_key: apiKey, model }),
    });
  }

  async testAIConnection(): Promise<{
    success: boolean;
    provider: string;
    model: string;
    message: string;
  }> {
    return this.request('/api/settings/ai/test', { method: 'POST' });
  }

  // ==================== AI Chat ====================

  async sendChatMessage(messages: { role: string; content: string }[]): Promise<{
    response: string;
    provider: string;
  }> {
    return this.request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
  }

  // ==================== Wheel Chains ====================

  async getWheelChains(): Promise<{ chains: WheelChain[] }> {
    return this.request('/api/wheel-chains');
  }

  async getWheelChain(chainId: string): Promise<WheelChain> {
    return this.request(`/api/wheel-chains/${chainId}`);
  }

  async createWheelChain(underlying: string): Promise<{ id: string; chain: WheelChain; message: string }> {
    return this.request('/api/wheel-chains', {
      method: 'POST',
      body: JSON.stringify({ underlying }),
    });
  }

  async deleteWheelChain(chainId: string): Promise<{ message: string }> {
    return this.request(`/api/wheel-chains/${chainId}`, { method: 'DELETE' });
  }

  async getWheelChainsByUnderlying(symbol: string): Promise<{ chains: WheelChain[] }> {
    return this.request(`/api/wheel-chains/by-underlying/${symbol}`);
  }

  async getActiveWheelChain(symbol: string): Promise<{ chain: WheelChain | null }> {
    return this.request(`/api/wheel-chains/active/${symbol}`);
  }

  async recordChainAssignment(
    chainId: string,
    strike: number,
    shares: number = 100,
    assignmentDate?: string
  ): Promise<{ message: string; chain: WheelChain }> {
    return this.request(`/api/wheel-chains/${chainId}/assignment`, {
      method: 'POST',
      body: JSON.stringify({ strike, shares, assignment_date: assignmentDate }),
    });
  }

  async recordChainExit(
    chainId: string,
    exitPrice: number,
    exitType: 'CALLED_AWAY' | 'SOLD',
    exitDate?: string
  ): Promise<{ message: string; chain: WheelChain }> {
    return this.request(`/api/wheel-chains/${chainId}/exit`, {
      method: 'POST',
      body: JSON.stringify({ exit_price: exitPrice, exit_type: exitType, exit_date: exitDate }),
    });
  }

  async linkPositionToChain(positionId: number, chainId: string): Promise<{ message: string }> {
    return this.request(`/api/positions/${positionId}/link-chain/${chainId}`, {
      method: 'POST',
    });
  }

  async unlinkPositionFromChain(positionId: number): Promise<{ message: string }> {
    return this.request(`/api/positions/${positionId}/unlink-chain`, {
      method: 'POST',
    });
  }

  // ==================== Auto Wheel Analysis ====================
  // These endpoints automatically analyze historical positions - no manual linking required

  async getAutoWheelAnalysis(): Promise<{ analysis: AutoWheelAnalysis[]; summary: AutoWheelSummary }> {
    return this.request('/api/wheel/analysis');
  }

  async getAutoWheelAnalysisForSymbol(symbol: string): Promise<AutoWheelAnalysis> {
    return this.request(`/api/wheel/analysis/${symbol}`);
  }

  async getAutoWheelSummary(): Promise<AutoWheelSummary> {
    return this.request('/api/wheel/summary');
  }

  // ==================== Data Import ====================

  async importIBKRTrades(file: File, clearExisting: boolean = false): Promise<{
    success: boolean;
    imported: number;
    skipped: number;
    cleared: number;
    errors: string[];
    message: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const url = new URL(`${this.baseUrl}/api/import/ibkr-trades`);
    if (clearExisting) {
      url.searchParams.set('clear_existing', 'true');
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      body: formData,
      // Note: Don't set Content-Type header - browser will set it with boundary for FormData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `API error: ${response.status}`);
    }

    return response.json();
  }

  async getImportHistory(limit: number = 20): Promise<{ history: ImportHistoryRecord[] }> {
    const response = await fetch(`${this.baseUrl}/api/import/history?limit=${limit}`);
    if (!response.ok) {
      throw new Error(`Failed to get import history: ${response.status}`);
    }
    return response.json();
  }

  async clearImportHistory(): Promise<{ cleared: number; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/import/history`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to clear import history: ${response.status}`);
    }
    return response.json();
  }
}

// Export singleton instance
export const api = new ApiClient();

// Export class for custom instances
export { ApiClient };
