'use client';

import { useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrendingUp, TrendingDown, Trophy, Target, BarChart3, Calendar, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortfolioStore } from '@/stores/portfolio-store';

function formatCurrency(value: number) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Math.abs(value));
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  valueColor,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  valueColor?: 'green' | 'red' | 'default';
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p
              className={cn(
                'text-2xl font-bold mt-1',
                valueColor === 'green' && 'text-green-500',
                valueColor === 'red' && 'text-red-500'
              )}
            >
              {value}
            </p>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PerformancePage() {
  const { performance, summary, fetchPerformance, isLoading } = usePortfolioStore();

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  // Use performance data from store, with fallbacks
  const stats = {
    totalPnl: (performance?.total_realized_pnl || 0) + (summary.unrealizedPnl || 0),
    realizedPnl: performance?.total_realized_pnl || summary.realizedPnl || 0,
    unrealizedPnl: summary.unrealizedPnl || 0,
    winRate: performance?.win_rate || summary.winRate || 0,
    totalTrades: performance?.total_trades || summary.totalTrades || 0,
    avgWin: performance?.avg_win || 0,
    avgLoss: performance?.avg_loss || 0,
    bestTrade: performance?.best_trade || null,
    worstTrade: performance?.worst_trade || null,
    profitFactor: performance?.profit_factor || 0,
    winningTrades: performance?.winning_trades || 0,
    losingTrades: performance?.losing_trades || 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance</h1>
          <p className="text-muted-foreground">
            Track your trading results and analytics
          </p>
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Time period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="ytd">Year to Date</SelectItem>
            <SelectItem value="6m">Last 6 Months</SelectItem>
            <SelectItem value="3m">Last 3 Months</SelectItem>
            <SelectItem value="1m">Last Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total P&L"
          value={formatCurrency(stats.totalPnl)}
          subtitle="Realized + Unrealized"
          icon={TrendingUp}
          valueColor={stats.totalPnl >= 0 ? 'green' : 'red'}
        />
        <StatCard
          title="Realized P&L"
          value={formatCurrency(stats.realizedPnl)}
          subtitle="From closed trades"
          icon={Target}
          valueColor={stats.realizedPnl >= 0 ? 'green' : 'red'}
        />
        <StatCard
          title="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          subtitle={`${stats.totalTrades} total trades`}
          icon={Trophy}
        />
        <StatCard
          title="Total Trades"
          value={stats.totalTrades.toString()}
          subtitle={`${stats.winningTrades}W / ${stats.losingTrades}L`}
          icon={BarChart3}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="strategies">By Strategy</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Trade Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Trade Statistics</CardTitle>
                <CardDescription>Key performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Average Win</span>
                  <span className="font-medium text-green-500">
                    {stats.avgWin > 0 ? formatCurrency(stats.avgWin) : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Average Loss</span>
                  <span className="font-medium text-red-500">
                    {stats.avgLoss > 0 ? formatCurrency(-stats.avgLoss) : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Best Trade</span>
                  <span className="font-medium text-green-500">
                    {stats.bestTrade
                      ? `${stats.bestTrade.symbol} (${formatCurrency(stats.bestTrade.pnl)})`
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Worst Trade</span>
                  <span className="font-medium text-red-500">
                    {stats.worstTrade
                      ? `${stats.worstTrade.symbol} (${formatCurrency(stats.worstTrade.pnl)})`
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Profit Factor</span>
                  <span className="font-medium">
                    {stats.profitFactor === Infinity || stats.profitFactor === 0
                      ? '-'
                      : stats.profitFactor.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* P&L Chart Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle>P&L Over Time</CardTitle>
                <CardDescription>Cumulative profit/loss</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] flex items-center justify-center border-2 border-dashed border-border rounded-lg">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Chart visualization coming soon
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.totalTrades === 0 ? 'No trade history yet' : 'Requires more trade history'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Monthly Tab */}
        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Breakdown</CardTitle>
              <CardDescription>Performance by month</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.totalTrades === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No trade history yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete some trades to see monthly breakdown
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Monthly breakdown coming soon</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This feature is being developed
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Strategies Tab */}
        <TabsContent value="strategies">
          <Card>
            <CardHeader>
              <CardTitle>Strategy Performance</CardTitle>
              <CardDescription>Results by strategy type</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.totalTrades === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No trade history yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete some trades to see strategy breakdown
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Strategy breakdown coming soon</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This feature is being developed
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
