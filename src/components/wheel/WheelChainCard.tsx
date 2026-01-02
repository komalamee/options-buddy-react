'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WheelChain } from '@/lib/api';
import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';

interface WheelChainCardProps {
  chain: WheelChain;
  onSelect: (chain: WheelChain) => void;
}

export function WheelChainCard({ chain, onSelect }: WheelChainCardProps) {
  const formatCurrency = (val: number | null) => {
    if (val === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const totalPremium = chain.total_put_premium + chain.total_call_premium;

  const getStatusBadge = () => {
    switch (chain.status) {
      case 'COLLECTING_PREMIUM':
        return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Collecting</Badge>;
      case 'HOLDING_SHARES':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Holding Shares</Badge>;
      case 'CLOSED':
        return <Badge variant="secondary">Closed</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => onSelect(chain)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">{chain.underlying}</span>
            {getStatusBadge()}
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Total Premium */}
          <div className="rounded-lg bg-accent p-3">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <p className="text-lg font-bold text-green-500">{formatCurrency(totalPremium)}</p>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Premium Earned
            </p>
          </div>

          {/* Cost Basis or Days */}
          {chain.status === 'HOLDING_SHARES' && chain.effective_cost_basis ? (
            <div className="rounded-lg bg-accent p-3">
              <div className="flex items-center gap-1">
                <TrendingDown className="h-4 w-4 text-blue-500" />
                <p className="text-lg font-bold">{formatCurrency(chain.break_even_price)}</p>
              </div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Break-even
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-accent p-3">
              <p className="text-lg font-bold">{chain.days_in_chain}d</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                In Chain
              </p>
            </div>
          )}
        </div>

        {/* Position count */}
        <div className="mt-3 text-sm text-muted-foreground">
          {chain.positions.length} position{chain.positions.length !== 1 ? 's' : ''} linked
          {chain.status === 'HOLDING_SHARES' && chain.shares_acquired && (
            <span className="ml-2">
              | {chain.shares_acquired} shares @ ${chain.assignment_strike}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
