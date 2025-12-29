// Core types for Options Buddy

export interface Position {
  id: number;
  underlying: string;
  optionType: 'CALL' | 'PUT';
  strike: number;
  expiration: string;
  quantity: number;
  premiumCollected: number;
  openDate: string;
  closeDate?: string;
  closePremium?: number;
  status: 'open' | 'closed';
  daysToExpiry: number;
}

export interface StockHolding {
  id: number;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice?: number;
  marketValue?: number;
  pnl?: number;
  pnlPercent?: number;
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

export interface TradeIdea {
  symbol: string;
  name: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  price: number;
  change: number;
  changePercent: number;
  ivRank: number;
  score: number;
  strategy: string;
  rationale: string;
}

export interface ScanResult {
  symbol: string;
  optionType: 'CALL' | 'PUT';
  strike: number;
  expiration: string;
  bid: number;
  ask: number;
  iv: number;
  delta: number;
  theta: number;
  dte: number;
  score: number;
}

export interface IBKRStatus {
  connected: boolean;
  account?: string;
  lastSync?: string;
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  position?: Position;
}
