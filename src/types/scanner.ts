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
