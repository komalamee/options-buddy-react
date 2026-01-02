'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortfolioStore } from '@/stores/portfolio-store';
import { api } from '@/lib/api';
import Link from 'next/link';

import { SymbolSearch } from '@/components/scanner/SymbolSearch';
import { FilterBar } from '@/components/scanner/FilterBar';
import { OptionsChain } from '@/components/scanner/OptionsChain';
import { HighlightLegend } from '@/components/scanner/HighlightLegend';
import { MarketStatusBanner } from '@/components/scanner/MarketStatusBanner';
import {
  FilterConfig,
  FilterPreset,
  OptionsChainData,
  OptionsChainRow,
  OptionLeg,
  DEFAULT_FILTERS,
  DEFAULT_WEEKLY_HIGH_IV_PRESET,
  PRESETS_STORAGE_KEY,
} from '@/types/scanner';

// Calculate days to expiration
function calculateDte(expiry: string): number {
  const expiryDate = new Date(expiry);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = expiryDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Format expiration date for display
function formatExpiration(expiry: string): string {
  const date = new Date(expiry);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// Check if expiration is a weekly (Friday that's not 3rd Friday of month)
function isWeeklyExpiration(expiry: string): boolean {
  const date = new Date(expiry);
  const dayOfWeek = date.getDay();
  if (dayOfWeek !== 5) return false; // Not Friday

  // Check if it's the 3rd Friday (monthly)
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstFriday = new Date(firstDay);
  const daysUntilFriday = (5 - firstDay.getDay() + 7) % 7;
  firstFriday.setDate(1 + daysUntilFriday);
  const thirdFriday = new Date(firstFriday);
  thirdFriday.setDate(firstFriday.getDate() + 14);

  return date.getDate() !== thirdFriday.getDate();
}

// Map API response to OptionLeg
function mapOptionData(data: any): OptionLeg {
  return {
    bid: data.bid || 0,
    ask: data.ask || 0,
    iv: data.iv || 0,
    delta: data.delta || 0,
    theta: data.theta || 0,
    gamma: data.gamma || 0,
    vega: data.vega || 0,
    volume: data.volume || 0,
    openInterest: data.open_interest || 0,
  };
}

export default function ScannerPage() {
  // ===== STATE =====
  // Symbol & Data
  const [symbol, setSymbol] = useState('');
  const [stockPrice, setStockPrice] = useState<number | null>(null);
  const [expirations, setExpirations] = useState<string[]>([]);
  const [selectedExpiration, setSelectedExpiration] = useState<string | null>(null);
  const [chainData, setChainData] = useState<OptionsChainData | null>(null);

  // Loading/Error
  const [isLoadingExpirations, setIsLoadingExpirations] = useState(false);
  const [isLoadingChain, setIsLoadingChain] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<FilterConfig>(DEFAULT_FILTERS);

  // Presets
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  // IBKR Status
  const { ibkrStatus, fetchIBKRStatus } = usePortfolioStore();

  // ===== EFFECTS =====

  // Load IBKR status on mount
  useEffect(() => {
    fetchIBKRStatus();
  }, [fetchIBKRStatus]);

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (saved) {
        setPresets(JSON.parse(saved));
      } else {
        setPresets([DEFAULT_WEEKLY_HIGH_IV_PRESET]);
      }
    } catch {
      setPresets([DEFAULT_WEEKLY_HIGH_IV_PRESET]);
    }
  }, []);

  // Save presets to localStorage when changed
  useEffect(() => {
    if (presets.length > 0) {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
    }
  }, [presets]);

  // ===== FILTERED EXPIRATIONS =====
  const filteredExpirations = useMemo(() => {
    return expirations.filter((exp) => {
      const dte = calculateDte(exp);

      // Filter by DTE range
      if (dte < filters.minDte || dte > filters.maxDte) {
        return false;
      }

      // Filter weekly only
      if (filters.weeklyOnly && !isWeeklyExpiration(exp)) {
        return false;
      }

      return true;
    });
  }, [expirations, filters.minDte, filters.maxDte, filters.weeklyOnly]);

  // ===== HANDLERS =====

  const loadOptionsChain = useCallback(
    async (expiry: string) => {
      if (!symbol || !stockPrice) return;

      setIsLoadingChain(true);
      setError(null);

      try {
        // Get strikes for this expiration
        const strikesResult = await api.getOptionStrikes(symbol, expiry);
        const strikes = strikesResult.strikes;

        // Limit to strikes within reasonable range of current price (±30%)
        const minStrike = stockPrice * 0.7;
        const maxStrike = stockPrice * 1.3;
        const relevantStrikes = strikes.filter(
          (s) => s >= minStrike && s <= maxStrike
        );

        // Use bulk API to fetch all option data at once (much faster)
        const bulkResult = await api.getOptionChainBulk(symbol, expiry, relevantStrikes);

        // Group results by strike
        const strikeMap = new Map<number, { call: any; put: any }>();
        for (const opt of bulkResult.options) {
          const existing = strikeMap.get(opt.strike) || { call: null, put: null };
          if (opt.right === 'C') {
            existing.call = opt;
          } else {
            existing.put = opt;
          }
          strikeMap.set(opt.strike, existing);
        }

        // Build rows
        const rows: OptionsChainRow[] = relevantStrikes.map((strike) => {
          const data = strikeMap.get(strike) || { call: null, put: null };
          return {
            strike,
            isItm: {
              call: strike < stockPrice,
              put: strike > stockPrice,
            },
            call: data.call ? mapOptionData(data.call) : null,
            put: data.put ? mapOptionData(data.put) : null,
          };
        });

        // Sort by strike price
        rows.sort((a, b) => a.strike - b.strike);

        setChainData({
          expiration: expiry,
          dte: calculateDte(expiry),
          rows,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load options chain'
        );
      } finally {
        setIsLoadingChain(false);
      }
    },
    [symbol, stockPrice]
  );

  const handleSearch = async () => {
    if (!symbol.trim() || !ibkrStatus.connected) return;

    setIsLoadingExpirations(true);
    setError(null);
    setChainData(null);
    setExpirations([]);
    setSelectedExpiration(null);

    try {
      // Fetch stock price and expirations in parallel
      const [priceResult, expirationsResult] = await Promise.all([
        api.getStockPrice(symbol.toUpperCase()),
        api.getOptionExpirations(symbol.toUpperCase()),
      ]);

      setStockPrice(priceResult.price);
      setExpirations(expirationsResult.expirations);

      // Auto-select first expiration within filter range
      const validExps = expirationsResult.expirations.filter((exp) => {
        const dte = calculateDte(exp);
        return dte >= filters.minDte && dte <= filters.maxDte;
      });

      if (validExps.length > 0) {
        setSelectedExpiration(validExps[0]);
        // Load chain data will be triggered by useEffect
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load options data'
      );
    } finally {
      setIsLoadingExpirations(false);
    }
  };

  // Load chain when expiration changes
  useEffect(() => {
    if (selectedExpiration && stockPrice) {
      loadOptionsChain(selectedExpiration);
    }
  }, [selectedExpiration, stockPrice, loadOptionsChain]);

  const handleExpirationChange = (expiry: string) => {
    setSelectedExpiration(expiry);
  };

  const handlePresetSave = (name: string) => {
    const newPreset: FilterPreset = {
      id: `preset-${Date.now()}`,
      name,
      config: { ...filters },
      createdAt: new Date().toISOString(),
    };
    setPresets([...presets, newPreset]);
    setSelectedPresetId(newPreset.id);
  };

  const handlePresetDelete = (id: string) => {
    setPresets(presets.filter((p) => p.id !== id));
    if (selectedPresetId === id) {
      setSelectedPresetId(null);
    }
  };

  const handlePresetSelect = (id: string | null) => {
    setSelectedPresetId(id);
    if (id) {
      const preset = presets.find((p) => p.id === id);
      if (preset) {
        setFilters(preset.config);
      }
    }
  };

  const handleFiltersChange = (newFilters: FilterConfig) => {
    setFilters(newFilters);
    // Clear preset selection when filters are manually changed
    setSelectedPresetId(null);
  };

  // ===== RENDER =====
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Options Scanner</h1>
          <p className="text-muted-foreground">
            Search for a symbol to view its options chain
          </p>
        </div>
        <Badge
          variant={ibkrStatus.connected ? 'default' : 'destructive'}
          className={cn(ibkrStatus.connected && 'bg-green-500')}
        >
          {ibkrStatus.connected ? 'IBKR Connected' : 'IBKR Disconnected'}
        </Badge>
      </div>

      {/* Market Status Banner */}
      <MarketStatusBanner />

      {/* Search & Filters Card */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Symbol Search */}
          <SymbolSearch
            value={symbol}
            onChange={setSymbol}
            onSearch={handleSearch}
            isLoading={isLoadingExpirations}
            disabled={!ibkrStatus.connected}
          />

          {/* Filter Bar */}
          <FilterBar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            presets={presets}
            selectedPresetId={selectedPresetId}
            onPresetSelect={handlePresetSelect}
            onPresetSave={handlePresetSave}
            onPresetDelete={handlePresetDelete}
          />
        </CardContent>
      </Card>

      {/* IBKR Connection Warning */}
      {!ibkrStatus.connected && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>IBKR Not Connected</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Connect to IBKR to search for options data.</span>
            <Link href="/settings">
              <Button variant="outline" size="sm">
                Go to Settings
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={handleSearch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Highlight Legend */}
      {(expirations.length > 0 || chainData) && <HighlightLegend />}

      {/* Results Section */}
      {stockPrice !== null && expirations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {symbol} Options Chain
                </CardTitle>
                <CardDescription>
                  Current Price: ${stockPrice.toFixed(2)} | {filteredExpirations.length} expirations available
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedExpiration && loadOptionsChain(selectedExpiration)}
                disabled={isLoadingChain || !selectedExpiration}
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', isLoadingChain && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredExpirations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No expirations match the current DTE filter ({filters.minDte}-{filters.maxDte} days)
              </div>
            ) : (
              <Tabs
                value={selectedExpiration || undefined}
                onValueChange={handleExpirationChange}
              >
                <TabsList className="flex-wrap h-auto gap-1 mb-4">
                  {filteredExpirations.slice(0, 8).map((exp) => (
                    <TabsTrigger key={exp} value={exp} className="text-xs">
                      {formatExpiration(exp)} ({calculateDte(exp)}d)
                    </TabsTrigger>
                  ))}
                  {filteredExpirations.length > 8 && (
                    <span className="text-xs text-muted-foreground px-2">
                      +{filteredExpirations.length - 8} more
                    </span>
                  )}
                </TabsList>

                {filteredExpirations.map((exp) => (
                  <TabsContent key={exp} value={exp}>
                    {isLoadingChain ? (
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : chainData && chainData.expiration === exp ? (
                      <OptionsChain
                        symbol={symbol}
                        stockPrice={stockPrice}
                        chainData={chainData}
                        filters={filters}
                      />
                    ) : null}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {ibkrStatus.connected && expirations.length === 0 && !isLoadingExpirations && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Enter a symbol to get started</p>
            <p className="text-sm text-muted-foreground">
              Type a stock symbol above and click Search to view its options chain
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
