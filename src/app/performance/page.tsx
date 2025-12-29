'use client';

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
import { TrendingUp, TrendingDown, Trophy, Target, BarChart3, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

// Demo performance data
const performanceStats = {
  totalPnl: 2730.27,
  realizedPnl: 270,
  unrealizedPnl: 2460.27,
  winRate: 100,
  totalTrades: 1,
  avgWin: 270,
  avgLoss: 0,
  bestTrade: { symbol: 'AAPL', pnl: 270 },
  worstTrade: null,
  profitFactor: Infinity,
};

const monthlyData = [
  { month: 'Jul 2024', trades: 0, pnl: 0, winRate: 0 },
  { month: 'Aug 2024', trades: 0, pnl: 0, winRate: 0 },
  { month: 'Sep 2024', trades: 0, pnl: 0, winRate: 0 },
  { month: 'Oct 2024', trades: 0, pnl: 0, winRate: 0 },
  { month: 'Nov 2024', trades: 1, pnl: 270, winRate: 100 },
  { month: 'Dec 2024', trades: 0, pnl: 0, winRate: 0 },
];

const strategyBreakdown = [
  { strategy: 'Cash Secured Puts', trades: 1, pnl: 270, winRate: 100 },
  { strategy: 'Covered Calls', trades: 0, pnl: 0, winRate: 0 },
  { strategy: 'Iron Condors', trades: 0, pnl: 0, winRate: 0 },
  { strategy: 'Put Spreads', trades: 0, pnl: 0, winRate: 0 },
];

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
  icon: any;
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
          value={formatCurrency(performanceStats.totalPnl)}
          subtitle="Realized + Unrealized"
          icon={TrendingUp}
          valueColor={performanceStats.totalPnl >= 0 ? 'green' : 'red'}
        />
        <StatCard
          title="Realized P&L"
          value={formatCurrency(performanceStats.realizedPnl)}
          subtitle="From closed trades"
          icon={Target}
          valueColor={performanceStats.realizedPnl >= 0 ? 'green' : 'red'}
        />
        <StatCard
          title="Win Rate"
          value={`${performanceStats.winRate}%`}
          subtitle={`${performanceStats.totalTrades} total trades`}
          icon={Trophy}
        />
        <StatCard
          title="Total Trades"
          value={performanceStats.totalTrades.toString()}
          subtitle="All time"
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
                    {formatCurrency(performanceStats.avgWin)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Average Loss</span>
                  <span className="font-medium text-red-500">
                    {performanceStats.avgLoss === 0 ? '$0.00' : formatCurrency(-performanceStats.avgLoss)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Best Trade</span>
                  <span className="font-medium">
                    {performanceStats.bestTrade
                      ? `${performanceStats.bestTrade.symbol} (${formatCurrency(performanceStats.bestTrade.pnl)})`
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Worst Trade</span>
                  <span className="font-medium">
                    {performanceStats.worstTrade ? '-' : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Profit Factor</span>
                  <span className="font-medium">
                    {performanceStats.profitFactor === Infinity ? '∞' : performanceStats.profitFactor.toFixed(2)}
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
                      Requires more trade history
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
              <div className="space-y-4">
                {monthlyData.map((month) => (
                  <div
                    key={month.month}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{month.month}</p>
                        <p className="text-sm text-muted-foreground">
                          {month.trades} trades
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          'font-medium',
                          month.pnl > 0 && 'text-green-500',
                          month.pnl < 0 && 'text-red-500'
                        )}
                      >
                        {month.pnl === 0 ? '-' : formatCurrency(month.pnl)}
                      </p>
                      {month.trades > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {month.winRate}% win rate
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
              <div className="space-y-4">
                {strategyBreakdown.map((strategy) => (
                  <div
                    key={strategy.strategy}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium">{strategy.strategy}</p>
                      <p className="text-sm text-muted-foreground">
                        {strategy.trades} trades
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          'font-medium',
                          strategy.pnl > 0 && 'text-green-500',
                          strategy.pnl < 0 && 'text-red-500'
                        )}
                      >
                        {strategy.pnl === 0 ? '-' : formatCurrency(strategy.pnl)}
                      </p>
                      {strategy.trades > 0 && (
                        <Badge variant="outline">{strategy.winRate}% win</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
