// Scanner page type definitions

export interface FilterConfig {
  minDte: number;
  maxDte: number;
  minDelta: number;
  maxDelta: number;
  minIv: number;
  minVolume: number;
  weeklyOnly: boolean;
  highIvOnly: boolean;
}

export interface FilterPreset {
  id: string;
  name: string;
  config: FilterConfig;
  createdAt: string;
}

export interface OptionLeg {
  bid: number;
  ask: number;
  iv: number;
  delta: number;
  theta: number;
  gamma: number;
  vega: number;
  volume: number;
  openInterest: number;
}

export interface OptionsChainRow {
  strike: number;
  isItm: { call: boolean; put: boolean };
  call: OptionLeg | null;
  put: OptionLeg | null;
}

export interface OptionsChainData {
  expiration: string;
  dte: number;
  rows: OptionsChainRow[];
}

export interface HighlightResult {
  isHighIv: boolean;
  isGoodDelta: boolean;
  isHighVolume: boolean;
  isArbitrage: boolean;
  isPerfectMatch: boolean;
  matchCount: number;
}

export const DEFAULT_FILTERS: FilterConfig = {
  minDte: 0,
  maxDte: 45,
  minDelta: 0.15,
  maxDelta: 0.35,
  minIv: 0,
  minVolume: 0,
  weeklyOnly: false,
  highIvOnly: false,
};

export const DEFAULT_WEEKLY_HIGH_IV_PRESET: FilterPreset = {
  id: 'default-weekly-high-iv',
  name: 'Weekly High IV',
  config: {
    minDte: 0,
    maxDte: 7,
    minDelta: 0.15,
    maxDelta: 0.35,
    minIv: 30,
    minVolume: 0,
    weeklyOnly: true,
    highIvOnly: true,
  },
  createdAt: new Date().toISOString(),
};

export const PRESETS_STORAGE_KEY = 'options-buddy-scanner-presets';

// ==================== PUT-CALL PARITY SCANNER ====================

export interface MispricedOption {
  symbol: string;
  strike: number;
  expiry: string;
  dte: number;

  // Call data
  call_bid: number;
  call_ask: number;
  call_mid: number;
  call_iv: number | null;
  call_volume: number;

  // Put data
  put_bid: number;
  put_ask: number;
  put_mid: number;
  put_iv: number | null;
  put_volume: number;

  // Put-Call Parity Analysis
  parity_value: number;
  market_spread: number;
  violation_dollars: number;
  violation_pct: number;
  is_violation: boolean;
  arbitrage_type: 'call_overpriced' | 'put_overpriced' | 'no_violation';

  // Synthetic prices
  synthetic_call: number;
  synthetic_put: number;

  // Statistical outlier detection
  iv_z_score: number;
  is_iv_outlier: boolean;

  // Greeks
  avg_delta: number | null;

  // Scoring
  opportunity_score: number;
}

export interface ParityScanResponse {
  symbol: string;
  stock_price: number;
  scan_timestamp: string;
  risk_free_rate: number;
  avg_iv: number;
  iv_std_dev: number;
  opportunities: MispricedOption[];
}
