'use client';

import { AutoWheelAnalysis } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface AutoWheelCardProps {
  analysis: AutoWheelAnalysis;
  onSelect: (analysis: AutoWheelAnalysis) => void;
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

export function AutoWheelCard({ analysis, onSelect }: AutoWheelCardProps) {
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

  const totalPremium = analysis.total_premium;
  const hasPendingPremium = analysis.pending_premium > 0;
  const costReduction = analysis.assignment_cost && analysis.effective_cost_basis
    ? analysis.assignment_cost - analysis.effective_cost_basis
    : null;

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => onSelect(analysis)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">{analysis.underlying}</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Premium Summary */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Premium Earned</span>
          <span className="font-semibold text-green-500">
            {formatCurrency(totalPremium)}
          </span>
        </div>

        {hasPendingPremium && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Pending Premium</span>
            <span className="font-medium text-blue-500">
              +{formatCurrency(analysis.pending_premium)}
            </span>
          </div>
        )}

        {/* Position Counts */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Positions</span>
          <div className="flex gap-2">
            <span className="text-red-400">{analysis.put_count} puts</span>
            <span className="text-green-400">{analysis.call_count} calls</span>
          </div>
        </div>

        {/* Open Position Count */}
        {(analysis.open_put_count > 0 || analysis.open_call_count > 0) && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Open</span>
            <div className="flex gap-2">
              {analysis.open_put_count > 0 && (
                <Badge variant="outline" className="text-xs">{analysis.open_put_count} put{analysis.open_put_count > 1 ? 's' : ''}</Badge>
              )}
              {analysis.open_call_count > 0 && (
                <Badge variant="outline" className="text-xs">{analysis.open_call_count} call{analysis.open_call_count > 1 ? 's' : ''}</Badge>
              )}
            </div>
          </div>
        )}

        {/* Cost Basis Info for Holdings */}
        {analysis.status === 'HOLDING_SHARES' && analysis.effective_cost_basis && (
          <>
            <div className="border-t pt-3 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Effective Cost</span>
                <span className="font-semibold">{formatPrice(analysis.break_even_price)}/share</span>
              </div>
              {analysis.avg_cost && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Original Cost</span>
                  <span className="line-through text-muted-foreground">{formatPrice(analysis.avg_cost)}/share</span>
                </div>
              )}
              {costReduction && costReduction > 0 && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Premium Savings</span>
                  <span className="text-green-500">{formatCurrency(costReduction)}</span>
                </div>
              )}
            </div>

            {/* Unrealized P&L */}
            {analysis.unrealized_pnl !== null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Unrealized P&L</span>
                <span className={`font-semibold ${analysis.unrealized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {analysis.unrealized_pnl >= 0 ? '+' : ''}{formatCurrency(analysis.unrealized_pnl)}
                </span>
              </div>
            )}
          </>
        )}

        {/* Days Active */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>{analysis.days_active} days active</span>
          {analysis.first_position_date && (
            <span>Since {new Date(analysis.first_position_date).toLocaleDateString()}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
