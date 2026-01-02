'use client';

import { AutoWheelAnalysis, Position } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Calendar, Package } from 'lucide-react';

interface AutoWheelDetailProps {
  analysis: AutoWheelAnalysis;
  onBack: () => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPrice(value: number | null) {
  if (value === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function AutoWheelDetail({ analysis, onBack }: AutoWheelDetailProps) {
  const getStatusBadge = () => {
    switch (analysis.status) {
      case 'COLLECTING_PREMIUM':
        return <Badge variant="default" className="bg-blue-500">Collecting Premium</Badge>;
      case 'HOLDING_SHARES':
        return <Badge variant="default" className="bg-green-500">Holding {analysis.shares_held} Shares</Badge>;
      case 'CLOSED':
        return <Badge variant="secondary">Closed</Badge>;
      default:
        return null;
    }
  };

  const totalPremiumEarned = analysis.total_premium;
  const costReduction = analysis.assignment_cost && analysis.effective_cost_basis
    ? analysis.assignment_cost - analysis.effective_cost_basis
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{analysis.underlying} Premium Tracker</h2>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge()}
              <span className="text-muted-foreground text-sm">
                {analysis.days_active} days active
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Cost Basis Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Premium & Cost Basis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* If holding shares, show full cost basis breakdown */}
            {analysis.status === 'HOLDING_SHARES' && analysis.assignment_cost ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original Cost</span>
                    <span className="font-mono">{formatCurrency(analysis.assignment_cost)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    ({analysis.shares_held} shares @ {formatPrice(analysis.avg_cost)})
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-green-500">
                    <span>Put Premium Collected</span>
                    <span className="font-mono">-{formatCurrency(analysis.total_put_premium)}</span>
                  </div>
                  <div className="flex justify-between text-green-500">
                    <span>Call Premium Collected</span>
                    <span className="font-mono">-{formatCurrency(analysis.total_call_premium)}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Effective Cost Basis</span>
                    <span className="font-mono">{formatCurrency(analysis.effective_cost_basis || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Per Share</span>
                    <span className="font-semibold">{formatPrice(analysis.break_even_price)}</span>
                  </div>
                </div>

                <Separator />

                <div className="bg-green-500/10 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Premium Savings</span>
                    <span className="text-xl font-bold text-green-500">
                      {formatCurrency(costReduction)}
                    </span>
                  </div>
                  {analysis.avg_cost && analysis.break_even_price && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Cost reduced from {formatPrice(analysis.avg_cost)} to {formatPrice(analysis.break_even_price)} per share
                    </div>
                  )}
                </div>

                {/* Unrealized P&L */}
                {analysis.unrealized_pnl !== null && analysis.current_price && (
                  <div className={`rounded-lg p-3 ${analysis.unrealized_pnl >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Unrealized P&L</span>
                      <span className={`text-xl font-bold ${analysis.unrealized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {analysis.unrealized_pnl >= 0 ? '+' : ''}{formatCurrency(analysis.unrealized_pnl)}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Current price: {formatPrice(analysis.current_price)}
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Not holding shares - just show premium summary
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-green-500">
                    <span>Put Premium Collected</span>
                    <span className="font-mono">{formatCurrency(analysis.total_put_premium)}</span>
                  </div>
                  <div className="flex justify-between text-green-500">
                    <span>Call Premium Collected</span>
                    <span className="font-mono">{formatCurrency(analysis.total_call_premium)}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between font-semibold text-lg">
                  <span>Total Premium Earned</span>
                  <span className="text-green-500 font-mono">{formatCurrency(totalPremiumEarned)}</span>
                </div>

                {analysis.pending_premium > 0 && (
                  <div className="bg-blue-500/10 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Pending Premium</span>
                      <span className="text-lg font-bold text-blue-500">
                        +{formatCurrency(analysis.pending_premium)}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      From {analysis.open_put_count + analysis.open_call_count} open position{analysis.open_put_count + analysis.open_call_count > 1 ? 's' : ''}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Activity Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Activity Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Puts</p>
                <p className="text-2xl font-bold">{analysis.put_count}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold">{analysis.call_count}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open Positions</p>
                <p className="text-2xl font-bold">{analysis.open_put_count + analysis.open_call_count}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Closed Positions</p>
                <p className="text-2xl font-bold">{analysis.closed_positions.length}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">First Position</span>
                <span>{formatDate(analysis.first_position_date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Activity</span>
                <span>{formatDate(analysis.last_activity_date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Days Active</span>
                <span>{analysis.days_active} days</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Position History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Position History ({analysis.positions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analysis.positions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No positions found for this underlying.
            </p>
          ) : (
            <div className="space-y-2">
              {/* Open Positions First */}
              {analysis.open_positions.length > 0 && (
                <>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Open Positions</h4>
                  {analysis.open_positions.map((pos) => (
                    <PositionRow key={pos.id} position={pos} />
                  ))}
                  <Separator className="my-4" />
                </>
              )}

              {/* Closed Positions */}
              {analysis.closed_positions.length > 0 && (
                <>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Closed Positions</h4>
                  {analysis.closed_positions.map((pos) => (
                    <PositionRow key={pos.id} position={pos} />
                  ))}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PositionRow({ position }: { position: Position }) {
  const premium = position.premium_collected * Math.abs(position.quantity) * 100;
  const isOpen = position.status === 'OPEN';

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <Badge variant={position.option_type === 'PUT' ? 'default' : 'secondary'}>
          {position.option_type}
        </Badge>
        <span className="font-medium">${position.strike}</span>
        <span className="text-muted-foreground">{position.expiry}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-green-500 font-medium">
          +{formatCurrency(premium)}
        </span>
        <Badge variant={isOpen ? 'outline' : 'secondary'} className={isOpen ? 'border-blue-500 text-blue-500' : ''}>
          {position.status}
        </Badge>
      </div>
    </div>
  );
}
