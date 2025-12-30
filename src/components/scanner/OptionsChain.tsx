'use client';

import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  FilterConfig,
  OptionLeg,
  OptionsChainData,
  OptionsChainRow,
  HighlightResult,
} from '@/types/scanner';

interface OptionsChainProps {
  symbol: string;
  stockPrice: number;
  chainData: OptionsChainData;
  filters: FilterConfig;
}

// Calculate highlight indicators for an option leg
function calculateHighlights(
  leg: OptionLeg | null,
  filters: FilterConfig
): HighlightResult {
  if (!leg) {
    return {
      isHighIv: false,
      isGoodDelta: false,
      isHighVolume: false,
      isArbitrage: false,
      isPerfectMatch: false,
      matchCount: 0,
    };
  }

  const isHighIv = leg.iv >= 0.3; // 30%+ IV
  const isGoodDelta =
    Math.abs(leg.delta) >= filters.minDelta &&
    Math.abs(leg.delta) <= filters.maxDelta;
  const isHighVolume = leg.volume >= 1000; // High volume threshold

  // Arbitrage: tight bid-ask spread (< 5% of mid price)
  const midPrice = (leg.bid + leg.ask) / 2;
  const spreadPercent = midPrice > 0 ? (leg.ask - leg.bid) / midPrice : 1;
  const isArbitrage = spreadPercent < 0.05 && leg.volume > 100;

  const matchCount = [isHighIv, isGoodDelta, isHighVolume, isArbitrage].filter(
    Boolean
  ).length;
  const isPerfectMatch = matchCount >= 3;

  return {
    isHighIv,
    isGoodDelta,
    isHighVolume,
    isArbitrage,
    isPerfectMatch,
    matchCount,
  };
}

// Get CSS classes for highlights
function getHighlightClasses(highlights: HighlightResult): string {
  const classes: string[] = [];

  if (highlights.isPerfectMatch) {
    classes.push('ring-2 ring-yellow-400/50 shadow-lg shadow-yellow-400/20');
  }
  if (highlights.isHighIv) {
    classes.push('bg-green-500/10');
  }
  if (highlights.isGoodDelta) {
    classes.push('border-l-4 border-blue-500');
  } else if (highlights.isArbitrage) {
    classes.push('border-l-4 border-purple-500');
  }

  return cn(...classes);
}

// Format number with appropriate decimal places
function formatNumber(value: number | undefined, decimals: number = 2): string {
  if (value === undefined || value === null) return '-';
  return value.toFixed(decimals);
}

// Format large numbers with commas
function formatVolume(value: number | undefined): string {
  if (value === undefined || value === null) return '-';
  return value.toLocaleString();
}

// Option leg cell component
function OptionLegCells({
  leg,
  highlights,
  isCall,
}: {
  leg: OptionLeg | null;
  highlights: HighlightResult;
  isCall: boolean;
}) {
  if (!leg) {
    return (
      <>
        <TableCell className="text-center text-muted-foreground">-</TableCell>
        <TableCell className="text-center text-muted-foreground">-</TableCell>
        <TableCell className="text-center text-muted-foreground">-</TableCell>
        <TableCell className="text-center text-muted-foreground">-</TableCell>
        <TableCell className="text-center text-muted-foreground">-</TableCell>
        <TableCell className="text-center text-muted-foreground">-</TableCell>
      </>
    );
  }

  const highlightClass = getHighlightClasses(highlights);

  return (
    <>
      <TableCell className={cn('text-right relative', highlightClass)}>
        {formatNumber(leg.bid)}
        {highlights.isHighVolume && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-orange-500" />
        )}
      </TableCell>
      <TableCell className={cn('text-right', highlightClass)}>
        {formatNumber(leg.ask)}
      </TableCell>
      <TableCell className={cn('text-right', highlightClass)}>
        {formatNumber(leg.iv * 100, 0)}%
      </TableCell>
      <TableCell className={cn('text-right', highlightClass)}>
        {formatNumber(leg.delta)}
      </TableCell>
      <TableCell className={cn('text-right', highlightClass)}>
        {formatVolume(leg.volume)}
      </TableCell>
      <TableCell className={cn('text-right', highlightClass)}>
        {formatVolume(leg.openInterest)}
      </TableCell>
    </>
  );
}

export function OptionsChain({
  symbol,
  stockPrice,
  chainData,
  filters,
}: OptionsChainProps) {
  // Filter rows based on filter config
  const filteredRows = useMemo(() => {
    return chainData.rows.filter((row) => {
      // Apply volume filter
      if (filters.minVolume > 0) {
        const callVol = row.call?.volume || 0;
        const putVol = row.put?.volume || 0;
        if (callVol < filters.minVolume && putVol < filters.minVolume) {
          return false;
        }
      }

      // Apply IV filter
      if (filters.minIv > 0) {
        const callIv = row.call?.iv ? row.call.iv * 100 : 0;
        const putIv = row.put?.iv ? row.put.iv * 100 : 0;
        if (callIv < filters.minIv && putIv < filters.minIv) {
          return false;
        }
      }

      // Apply high IV only filter
      if (filters.highIvOnly) {
        const callIv = row.call?.iv ? row.call.iv * 100 : 0;
        const putIv = row.put?.iv ? row.put.iv * 100 : 0;
        if (callIv < 30 && putIv < 30) {
          return false;
        }
      }

      return true;
    });
  }, [chainData.rows, filters]);

  // Find ATM strike (closest to stock price)
  const atmStrike = useMemo(() => {
    if (filteredRows.length === 0) return null;
    return filteredRows.reduce((closest, row) =>
      Math.abs(row.strike - stockPrice) < Math.abs(closest.strike - stockPrice)
        ? row
        : closest
    ).strike;
  }, [filteredRows, stockPrice]);

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {/* Calls header */}
            <TableHead
              colSpan={6}
              className="text-center border-r font-semibold text-green-600"
            >
              CALLS
            </TableHead>
            {/* Strike header */}
            <TableHead className="text-center font-semibold bg-muted border-x">
              STRIKE
            </TableHead>
            {/* Puts header */}
            <TableHead
              colSpan={6}
              className="text-center border-l font-semibold text-red-600"
            >
              PUTS
            </TableHead>
          </TableRow>
          <TableRow>
            {/* Calls sub-headers */}
            <TableHead className="text-right text-xs">Bid</TableHead>
            <TableHead className="text-right text-xs">Ask</TableHead>
            <TableHead className="text-right text-xs">IV</TableHead>
            <TableHead className="text-right text-xs">Delta</TableHead>
            <TableHead className="text-right text-xs">Vol</TableHead>
            <TableHead className="text-right text-xs border-r">OI</TableHead>
            {/* Strike sub-header */}
            <TableHead className="text-center text-xs bg-muted border-x">
              ${symbol}
            </TableHead>
            {/* Puts sub-headers */}
            <TableHead className="text-right text-xs border-l">Bid</TableHead>
            <TableHead className="text-right text-xs">Ask</TableHead>
            <TableHead className="text-right text-xs">IV</TableHead>
            <TableHead className="text-right text-xs">Delta</TableHead>
            <TableHead className="text-right text-xs">Vol</TableHead>
            <TableHead className="text-right text-xs">OI</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                No options match the current filters
              </TableCell>
            </TableRow>
          ) : (
            filteredRows.map((row) => {
              const isAtm = row.strike === atmStrike;
              const callHighlights = calculateHighlights(row.call, filters);
              const putHighlights = calculateHighlights(row.put, filters);

              return (
                <TableRow
                  key={row.strike}
                  className={cn(
                    'hover:bg-muted/30',
                    // ITM/OTM backgrounds
                    row.isItm.call && 'bg-muted/40',
                    // ATM highlight
                    isAtm && 'bg-primary/5 border-y-2 border-primary/30'
                  )}
                >
                  {/* Call option cells */}
                  <OptionLegCells
                    leg={row.call}
                    highlights={callHighlights}
                    isCall={true}
                  />

                  {/* Strike price - center column */}
                  <TableCell
                    className={cn(
                      'text-center font-bold bg-muted/30 border-x',
                      isAtm && 'text-primary'
                    )}
                  >
                    ${row.strike.toFixed(2)}
                  </TableCell>

                  {/* Put option cells */}
                  <OptionLegCells
                    leg={row.put}
                    highlights={putHighlights}
                    isCall={false}
                  />
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
