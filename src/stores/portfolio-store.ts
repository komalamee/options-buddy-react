import { create } from 'zustand';
import { api, ConnectionStatus, PortfolioSummary as ApiPortfolioSummary, PerformanceStats } from '@/lib/api';

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
  fetchAll: () => Promise<void>;
  syncWithIBKR: (account?: string) => Promise<boolean>;
  generateAlerts: () => void;
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

// ==================== Store ====================

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  positions: [],
  closedPositions: [],
  stockHoldings: [],
  summary: defaultSummary,
  alerts: [],
  ibkrStatus: { connected: false },
  performance: null,
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
}));
