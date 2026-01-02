import { create } from 'zustand';
import { api, ConnectionStatus, PortfolioSummary as ApiPortfolioSummary, PerformanceStats, WheelChain, AutoWheelAnalysis, AutoWheelSummary, TradeDetail, OpenPositionWithPnl, OpenPositionsResponse } from '@/lib/api';

// ==================== Types ====================

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

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  positionId?: number;
}

export interface IBKRStatus {
  connected: boolean;
  host?: string;
  port?: number;
  accounts?: string[];
  lastSync?: string;
  error?: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalStockValue: number;
  openPremium: number;
  realizedPnl: number;
  unrealizedPnl: number;
  openPositions: number;
  winRate: number;
  totalTrades: number;
  ccLotsAvailable: number;
}

export interface WheelChainSummary {
  totalChains: number;
  activeChains: number;
  holdingSharesChains: number;
  totalPremiumCollected: number;
  averageCostBasisReduction: number;
}

// Re-export types from api.ts for convenience
export type { WheelChain, AutoWheelAnalysis, AutoWheelSummary, TradeDetail, OpenPositionWithPnl } from '@/lib/api';

// ==================== Store Interface ====================

interface PortfolioState {
  // Data
  positions: Position[];
  closedPositions: Position[];
  stockHoldings: StockHolding[];
  summary: PortfolioSummary;
  alerts: Alert[];
  ibkrStatus: IBKRStatus;
  performance: PerformanceStats | null;
  openPositionsWithPnl: OpenPositionWithPnl[];
  totalUnrealizedPnl: number;

  // Wheel chains (manual - legacy)
  wheelChains: WheelChain[];
  wheelChainSummary: WheelChainSummary;
  selectedChainId: string | null;

  // Auto wheel analysis (automatic - no manual linking required)
  autoWheelAnalysis: AutoWheelAnalysis[];
  autoWheelSummary: AutoWheelSummary;
  selectedAutoWheelSymbol: string | null;

  // Loading states
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;

  // Actions
  setPositions: (positions: Position[]) => void;
  setClosedPositions: (positions: Position[]) => void;
  setStockHoldings: (holdings: StockHolding[]) => void;
  setSummary: (summary: PortfolioSummary) => void;
  setAlerts: (alerts: Alert[]) => void;
  setIBKRStatus: (status: IBKRStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // API actions
  fetchIBKRStatus: () => Promise<void>;
  connectIBKR: (host?: string, port?: number) => Promise<boolean>;
  disconnectIBKR: () => Promise<void>;
  fetchPositions: () => Promise<void>;
  fetchClosedPositions: () => Promise<void>;
  fetchHoldings: () => Promise<void>;
  fetchSummary: () => Promise<void>;
  fetchPerformance: () => Promise<void>;
  fetchOpenPositionsWithPnl: () => Promise<void>;
  fetchAll: () => Promise<void>;
  syncWithIBKR: (account?: string) => Promise<boolean>;
  generateAlerts: () => void;

  // Wheel chain actions (manual - legacy)
  fetchWheelChains: () => Promise<void>;
  createWheelChain: (underlying: string) => Promise<WheelChain | null>;
  deleteWheelChain: (chainId: string) => Promise<boolean>;
  linkPositionToChain: (positionId: number, chainId: string) => Promise<boolean>;
  unlinkPositionFromChain: (positionId: number) => Promise<boolean>;
  recordAssignment: (chainId: string, strike: number, shares?: number) => Promise<WheelChain | null>;
  recordChainExit: (chainId: string, exitPrice: number, exitType: 'CALLED_AWAY' | 'SOLD') => Promise<WheelChain | null>;
  setSelectedChainId: (chainId: string | null) => void;
  getChainById: (chainId: string) => WheelChain | undefined;
  getActiveChainForUnderlying: (symbol: string) => WheelChain | undefined;

  // Auto wheel analysis actions (automatic - no manual linking)
  fetchAutoWheelAnalysis: () => Promise<void>;
  setSelectedAutoWheelSymbol: (symbol: string | null) => void;
  getAutoWheelBySymbol: (symbol: string) => AutoWheelAnalysis | undefined;
}

// ==================== Default Values ====================

const defaultSummary: PortfolioSummary = {
  totalValue: 0,
  totalStockValue: 0,
  openPremium: 0,
  realizedPnl: 0,
  unrealizedPnl: 0,
  openPositions: 0,
  winRate: 0,
  totalTrades: 0,
  ccLotsAvailable: 0,
};

const defaultWheelChainSummary: WheelChainSummary = {
  totalChains: 0,
  activeChains: 0,
  holdingSharesChains: 0,
  totalPremiumCollected: 0,
  averageCostBasisReduction: 0,
};

const defaultAutoWheelSummary: AutoWheelSummary = {
  total_underlyings: 0,
  holding_shares_count: 0,
  collecting_premium_count: 0,
  total_premium_collected: 0,
  total_pending_premium: 0,
  average_cost_reduction: 0,
};

// ==================== Store ====================

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  positions: [],
  closedPositions: [],
  stockHoldings: [],
  summary: defaultSummary,
  alerts: [],
  ibkrStatus: { connected: false },
  performance: null,
  openPositionsWithPnl: [],
  totalUnrealizedPnl: 0,
  wheelChains: [],
  wheelChainSummary: defaultWheelChainSummary,
  selectedChainId: null,
  autoWheelAnalysis: [],
  autoWheelSummary: defaultAutoWheelSummary,
  selectedAutoWheelSymbol: null,
  isLoading: false,
  isSyncing: false,
  error: null,

  // Basic setters
  setPositions: (positions) => set({ positions }),
  setClosedPositions: (closedPositions) => set({ closedPositions }),
  setStockHoldings: (stockHoldings) => set({ stockHoldings }),
  setSummary: (summary) => set({ summary }),
  setAlerts: (alerts) => set({ alerts }),
  setIBKRStatus: (ibkrStatus) => set({ ibkrStatus }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // ==================== IBKR Connection ====================

  fetchIBKRStatus: async () => {
    try {
      const status = await api.getIBKRStatus();
      set({
        ibkrStatus: {
          connected: status.is_connected,
          host: status.host,
          port: status.port,
          accounts: status.accounts || [],
          error: status.error_message,
        },
      });
    } catch (error) {
      set({
        ibkrStatus: { connected: false, error: 'Failed to check IBKR status' },
      });
    }
  },

  connectIBKR: async (host?: string, port?: number) => {
    set({ isLoading: true, error: null });
    try {
      const status = await api.connectIBKR(host, port);
      set({
        ibkrStatus: {
          connected: status.is_connected,
          host: status.host,
          port: status.port,
          accounts: status.accounts || [],
          error: status.error_message,
        },
        isLoading: false,
      });
      return status.is_connected;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      set({
        ibkrStatus: { connected: false, error: message },
        error: message,
        isLoading: false,
      });
      return false;
    }
  },

  disconnectIBKR: async () => {
    try {
      await api.disconnectIBKR();
      set({
        ibkrStatus: { connected: false },
      });
    } catch (error) {
      // Still set as disconnected
      set({
        ibkrStatus: { connected: false },
      });
    }
  },

  // ==================== Fetch Data ====================

  fetchPositions: async () => {
    try {
      const { positions } = await api.getPositions('open');
      set({ positions });
      get().generateAlerts();
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    }
  },

  fetchClosedPositions: async () => {
    try {
      const { positions } = await api.getPositions('closed');
      set({ closedPositions: positions });
    } catch (error) {
      console.error('Failed to fetch closed positions:', error);
    }
  },

  fetchHoldings: async () => {
    try {
      const { holdings } = await api.getHoldings();
      set({ stockHoldings: holdings });
    } catch (error) {
      console.error('Failed to fetch holdings:', error);
    }
  },

  fetchSummary: async () => {
    try {
      const apiSummary = await api.getPortfolioSummary();
      set({
        summary: {
          totalValue: apiSummary.holdings_value + apiSummary.total_premium,
          totalStockValue: apiSummary.holdings_value,
          openPremium: apiSummary.total_premium,
          realizedPnl: apiSummary.realized_pnl,
          unrealizedPnl: apiSummary.holdings_pnl,
          openPositions: apiSummary.open_positions,
          winRate: apiSummary.win_rate,
          totalTrades: apiSummary.total_trades,
          ccLotsAvailable: apiSummary.cc_lots_available,
        },
      });
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  },

  fetchPerformance: async () => {
    try {
      const performance = await api.getPerformance();
      set({ performance });
    } catch (error) {
      console.error('Failed to fetch performance:', error);
    }
  },

  fetchOpenPositionsWithPnl: async () => {
    try {
      const response = await api.getOpenPositionsWithPnl();
      set({
        openPositionsWithPnl: response.positions,
        totalUnrealizedPnl: response.total_unrealized_pnl,
      });
    } catch (error) {
      console.error('Failed to fetch open positions with P&L:', error);
    }
  },

  fetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      await Promise.all([
        get().fetchIBKRStatus(),
        get().fetchPositions(),
        get().fetchHoldings(),
        get().fetchSummary(),
        get().fetchPerformance(),
      ]);
      set({ isLoading: false });
    } catch (error) {
      set({
        error: 'Failed to load portfolio data',
        isLoading: false,
      });
    }
  },

  // ==================== IBKR Sync ====================

  syncWithIBKR: async (account?: string) => {
    const { ibkrStatus } = get();
    if (!ibkrStatus.connected) {
      set({ error: 'Not connected to IBKR' });
      return false;
    }

    set({ isSyncing: true, error: null });
    try {
      const result = await api.syncFromIBKR(account);

      // Refresh data after sync
      await Promise.all([
        get().fetchPositions(),
        get().fetchHoldings(),
        get().fetchSummary(),
      ]);

      set({
        ibkrStatus: {
          ...ibkrStatus,
          lastSync: new Date().toISOString(),
        },
        isSyncing: false,
      });

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      set({
        error: message,
        isSyncing: false,
      });
      return false;
    }
  },

  // ==================== Generate Alerts ====================

  generateAlerts: () => {
    const { positions } = get();
    const alerts: Alert[] = [];

    for (const pos of positions) {
      const dte = pos.days_to_expiry;

      // Critical: Very close to expiry
      if (dte !== undefined && dte <= 3) {
        alerts.push({
          id: `expiry-critical-${pos.id}`,
          type: 'critical',
          title: 'Expiring Soon',
          message: `${pos.underlying} $${pos.strike} ${pos.option_type} expires in ${dte} day${dte !== 1 ? 's' : ''}`,
          positionId: pos.id,
        });
      }
      // Warning: Approaching expiry
      else if (dte !== undefined && dte <= 7) {
        alerts.push({
          id: `expiry-warning-${pos.id}`,
          type: 'warning',
          title: 'Expiry Watch',
          message: `${pos.underlying} $${pos.strike} ${pos.option_type} expires in ${dte} days`,
          positionId: pos.id,
        });
      }
    }

    set({ alerts });
  },

  // ==================== Wheel Chains ====================

  fetchWheelChains: async () => {
    try {
      const { chains } = await api.getWheelChains();

      // Calculate summary statistics
      const activeChains = chains.filter(c => c.status === 'COLLECTING_PREMIUM').length;
      const holdingSharesChains = chains.filter(c => c.status === 'HOLDING_SHARES').length;
      const totalPremiumCollected = chains.reduce((sum, c) =>
        sum + c.total_put_premium + c.total_call_premium, 0);

      // Calculate average cost basis reduction for chains holding shares
      const holdingChains = chains.filter(c => c.status === 'HOLDING_SHARES' && c.assignment_cost && c.effective_cost_basis);
      const averageCostBasisReduction = holdingChains.length > 0
        ? holdingChains.reduce((sum, c) => sum + ((c.assignment_cost || 0) - (c.effective_cost_basis || 0)), 0) / holdingChains.length
        : 0;

      set({
        wheelChains: chains,
        wheelChainSummary: {
          totalChains: chains.length,
          activeChains,
          holdingSharesChains,
          totalPremiumCollected,
          averageCostBasisReduction,
        },
      });
    } catch (error) {
      console.error('Failed to fetch wheel chains:', error);
    }
  },

  createWheelChain: async (underlying: string) => {
    try {
      const { chain } = await api.createWheelChain(underlying);
      await get().fetchWheelChains();
      return chain;
    } catch (error) {
      console.error('Failed to create wheel chain:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to create wheel chain' });
      return null;
    }
  },

  deleteWheelChain: async (chainId: string) => {
    try {
      await api.deleteWheelChain(chainId);
      await get().fetchWheelChains();
      return true;
    } catch (error) {
      console.error('Failed to delete wheel chain:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to delete wheel chain' });
      return false;
    }
  },

  linkPositionToChain: async (positionId: number, chainId: string) => {
    try {
      await api.linkPositionToChain(positionId, chainId);
      await get().fetchWheelChains();
      return true;
    } catch (error) {
      console.error('Failed to link position to chain:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to link position' });
      return false;
    }
  },

  unlinkPositionFromChain: async (positionId: number) => {
    try {
      await api.unlinkPositionFromChain(positionId);
      await get().fetchWheelChains();
      return true;
    } catch (error) {
      console.error('Failed to unlink position from chain:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to unlink position' });
      return false;
    }
  },

  recordAssignment: async (chainId: string, strike: number, shares: number = 100) => {
    try {
      const { chain } = await api.recordChainAssignment(chainId, strike, shares);
      await Promise.all([
        get().fetchWheelChains(),
        get().fetchHoldings(),
      ]);
      return chain;
    } catch (error) {
      console.error('Failed to record assignment:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to record assignment' });
      return null;
    }
  },

  recordChainExit: async (chainId: string, exitPrice: number, exitType: 'CALLED_AWAY' | 'SOLD') => {
    try {
      const { chain } = await api.recordChainExit(chainId, exitPrice, exitType);
      await Promise.all([
        get().fetchWheelChains(),
        get().fetchHoldings(),
      ]);
      return chain;
    } catch (error) {
      console.error('Failed to record chain exit:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to record exit' });
      return null;
    }
  },

  setSelectedChainId: (chainId: string | null) => {
    set({ selectedChainId: chainId });
  },

  getChainById: (chainId: string) => {
    return get().wheelChains.find(c => c.id === chainId);
  },

  getActiveChainForUnderlying: (symbol: string) => {
    return get().wheelChains.find(
      c => c.underlying.toUpperCase() === symbol.toUpperCase() && c.status !== 'CLOSED'
    );
  },

  // ==================== Auto Wheel Analysis ====================
  // Automatic analysis - no manual linking required

  fetchAutoWheelAnalysis: async () => {
    try {
      const { analysis, summary } = await api.getAutoWheelAnalysis();
      set({
        autoWheelAnalysis: analysis,
        autoWheelSummary: summary,
      });
    } catch (error) {
      console.error('Failed to fetch auto wheel analysis:', error);
    }
  },

  setSelectedAutoWheelSymbol: (symbol: string | null) => {
    set({ selectedAutoWheelSymbol: symbol });
  },

  getAutoWheelBySymbol: (symbol: string) => {
    return get().autoWheelAnalysis.find(
      a => a.underlying.toUpperCase() === symbol.toUpperCase()
    );
  },
}));
