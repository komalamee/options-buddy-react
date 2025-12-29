'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, Target, Trophy, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
}

function MetricCard({ title, value, change, changeType = 'neutral', icon }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {change && (
              <div className="flex items-center gap-1 mt-1">
                {changeType === 'positive' ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : changeType === 'negative' ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : null}
                <span
                  className={cn(
                    'text-sm font-medium',
                    changeType === 'positive' && 'text-green-500',
                    changeType === 'negative' && 'text-red-500',
                    changeType === 'neutral' && 'text-muted-foreground'
                  )}
                >
                  {change}
                </span>
              </div>
            )}
          </div>
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricsRowProps {
  totalValue: number;
  realizedPnl: number;
  openPositions: number;
  openPremium: number;
  winRate: number;
  totalTrades: number;
}

export function MetricsRow({
  totalValue,
  realizedPnl,
  openPositions,
  openPremium,
  winRate,
  totalTrades,
}: MetricsRowProps) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);

  const formatPnl = (val: number) => {
    const formatted = formatCurrency(Math.abs(val));
    return val >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <MetricCard
        title="Portfolio Value"
        value={formatCurrency(totalValue)}
        change={formatPnl(realizedPnl) + ' realized'}
        changeType={realizedPnl >= 0 ? 'positive' : 'negative'}
        icon={<Wallet className="h-5 w-5" />}
      />
      <MetricCard
        title="Open Positions"
        value={openPositions.toString()}
        icon={<BarChart3 className="h-5 w-5" />}
      />
      <MetricCard
        title="Open Premium"
        value={formatCurrency(openPremium)}
        icon={<Target className="h-5 w-5" />}
      />
      <MetricCard
        title="Realized P&L"
        value={formatPnl(realizedPnl)}
        changeType={realizedPnl >= 0 ? 'positive' : 'negative'}
        icon={realizedPnl >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
      />
      <MetricCard
        title="Win Rate"
        value={`${winRate.toFixed(0)}%`}
        icon={<Trophy className="h-5 w-5" />}
      />
      <MetricCard
        title="Total Trades"
        value={totalTrades.toString()}
        icon={<BarChart3 className="h-5 w-5" />}
      />
    </div>
  );
}
