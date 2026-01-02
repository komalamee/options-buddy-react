'use client';

import { WheelChain } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, Minus, Equal } from 'lucide-react';

interface CostBasisBreakdownProps {
  chain: WheelChain;
  currentPrice?: number;
}

export function CostBasisBreakdown({ chain, currentPrice }: CostBasisBreakdownProps) {
  const formatCurrency = (val: number | null, showSign = false) => {
    if (val === null) return '-';
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(val));
    if (showSign && val !== 0) {
      return val > 0 ? `+${formatted}` : `-${formatted}`;
    }
    return formatted;
  };

  // Group positions by type
  const putPositions = chain.positions.filter(p => p.option_type === 'PUT');
  const callPositions = chain.positions.filter(p => p.option_type === 'CALL');

  // Calculate unrealized P&L if we have current price and are holding shares
  const unrealizedPnl = chain.status === 'HOLDING_SHARES' &&
    currentPrice &&
    chain.effective_cost_basis &&
    chain.shares_acquired
      ? (currentPrice * chain.shares_acquired) - chain.effective_cost_basis
      : null;

  const unrealizedPnlPercent = unrealizedPnl && chain.effective_cost_basis
    ? (unrealizedPnl / chain.effective_cost_basis) * 100
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Cost Basis Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assignment Cost */}
        {chain.status !== 'COLLECTING_PREMIUM' && chain.assignment_cost && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Assignment Cost</span>
              <span className="font-semibold">{formatCurrency(chain.assignment_cost)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {chain.shares_acquired} shares @ ${chain.assignment_strike}
            </p>
          </div>
        )}

        {/* Put Premiums */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Minus className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">Put Premiums Collected</span>
            </div>
            <span className="font-semibold text-green-500">
              {formatCurrency(chain.total_put_premium)}
            </span>
          </div>
          {putPositions.length > 0 && (
            <div className="ml-6 space-y-1">
              {putPositions.map((pos) => (
                <div key={pos.id} className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    ${pos.strike} PUT {pos.expiry}
                    {pos.status === 'ASSIGNED' && (
                      <Badge variant="outline" className="ml-2 text-xs">ASSIGNED</Badge>
                    )}
                  </span>
                  <span>${(pos.premium_collected * pos.quantity * 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Net Cost Basis (after puts) */}
        {chain.net_cost_basis && (
          <>
            <Separator />
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Equal className="h-4 w-4" />
                <span className="font-medium">Net Cost Basis</span>
              </div>
              <span className="font-bold">{formatCurrency(chain.net_cost_basis)}</span>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              (${(chain.net_cost_basis / (chain.shares_acquired || 100)).toFixed(2)} per share)
            </p>
          </>
        )}

        {/* Call Premiums */}
        {chain.total_call_premium > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Minus className="h-4 w-4 text-green-500" />
                <span className="text-muted-foreground">Call Premiums Collected</span>
              </div>
              <span className="font-semibold text-green-500">
                {formatCurrency(chain.total_call_premium)}
              </span>
            </div>
            {callPositions.length > 0 && (
              <div className="ml-6 space-y-1">
                {callPositions.map((pos) => (
                  <div key={pos.id} className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      ${pos.strike} CALL {pos.expiry}
                      {pos.status === 'ASSIGNED' && (
                        <Badge variant="outline" className="ml-2 text-xs">CALLED AWAY</Badge>
                      )}
                    </span>
                    <span>${(pos.premium_collected * pos.quantity * 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Effective Cost Basis */}
        {chain.effective_cost_basis && (
          <>
            <Separator className="border-2" />
            <div className="rounded-lg bg-accent p-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">Effective Cost Basis</span>
                <span className="font-bold text-lg">{formatCurrency(chain.effective_cost_basis)}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-muted-foreground">Per Share Cost</span>
                <span className="font-semibold text-xl">
                  ${chain.break_even_price?.toFixed(2)}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Unrealized P&L */}
        {unrealizedPnl !== null && currentPrice && (
          <div className="rounded-lg border-2 border-dashed p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Current Price</span>
              <span className="font-semibold">${currentPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Unrealized P&L</span>
              <span className={`font-bold ${unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(unrealizedPnl, true)}
                {unrealizedPnlPercent !== null && (
                  <span className="text-sm ml-1">
                    ({unrealizedPnlPercent >= 0 ? '+' : ''}{unrealizedPnlPercent.toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Realized P&L for closed chains */}
        {chain.status === 'CLOSED' && chain.realized_pnl !== null && (
          <div className="rounded-lg bg-accent p-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Exit Price</span>
              <span>${chain.exit_price?.toFixed(2)} ({chain.exit_type})</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="font-bold">Realized P&L</span>
              <span className={`font-bold text-lg ${chain.realized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(chain.realized_pnl, true)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
