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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TrendingUp, TrendingDown, Trophy, Target, BarChart3, Calendar, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
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

function formatCurrencyPlain(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
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
  const { performance, openPositionsWithPnl, totalUnrealizedPnl, fetchPerformance, fetchOpenPositionsWithPnl, isLoading } = usePortfolioStore();

  useEffect(() => {
    fetchPerformance();
    fetchOpenPositionsWithPnl();
  }, [fetchPerformance, fetchOpenPositionsWithPnl]);

  // Use performance data from store, with fallbacks
  const stats = {
    totalPnl: (performance?.total_realized_pnl || 0) + (totalUnrealizedPnl || 0),
    realizedPnl: performance?.total_realized_pnl || 0,
    unrealizedPnl: totalUnrealizedPnl || 0,
    winRate: performance?.win_rate || 0,
    totalTrades: performance?.total_trades || 0,
    avgWin: performance?.avg_win || 0,
    avgLoss: performance?.avg_loss || 0,
    bestTrade: performance?.best_trade || null,
    worstTrade: performance?.worst_trade || null,
    profitFactor: performance?.profit_factor || 0,
    winningTrades: performance?.winning_trades || 0,
    losingTrades: performance?.losing_trades || 0,
    trades: performance?.trades || [],
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

      {/* Stats Overview - 4 cards */}
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
          title="Unrealized P&L"
          value={formatCurrency(stats.unrealizedPnl)}
          subtitle={`${openPositionsWithPnl.length} open positions`}
          icon={Clock}
          valueColor={stats.unrealizedPnl >= 0 ? 'green' : 'red'}
        />
        <StatCard
          title="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          subtitle={`${stats.winningTrades}W / ${stats.losingTrades}L`}
          icon={Trophy}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="closed">Closed Trades</TabsTrigger>
          <TabsTrigger value="open">Open Positions</TabsTrigger>
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
                  <span className="text-muted-foreground">Total Trades</span>
                  <span className="font-medium">{stats.totalTrades}</span>
                </div>
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

            {/* P&L Summary */}
            <Card>
              <CardHeader>
                <CardTitle>P&L Summary</CardTitle>
                <CardDescription>Realized vs Unrealized breakdown</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Realized P&L</span>
                    <span className={cn(
                      "text-xl font-bold",
                      stats.realizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
                    )}>
                      {formatCurrency(stats.realizedPnl)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    From {stats.totalTrades} closed trades ({stats.winningTrades} wins, {stats.losingTrades} losses)
                  </p>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Unrealized P&L</span>
                    <span className={cn(
                      "text-xl font-bold",
                      stats.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
                    )}>
                      {formatCurrency(stats.unrealizedPnl)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    From {openPositionsWithPnl.length} open positions
                  </p>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total P&L</span>
                    <span className={cn(
                      "text-2xl font-bold",
                      stats.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'
                    )}>
                      {formatCurrency(stats.totalPnl)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Closed Trades Tab */}
        <TabsContent value="closed">
          <Card>
            <CardHeader>
              <CardTitle>Closed Trades</CardTitle>
              <CardDescription>
                Detailed breakdown of all realized trades
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.trades.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No closed trades yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Import your trades from IBKR or close some positions
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Result</TableHead>
                        <TableHead>Option</TableHead>
                        <TableHead>Strategy</TableHead>
                        <TableHead className="text-right">Premium</TableHead>
                        <TableHead className="text-right">Close Price</TableHead>
                        <TableHead className="text-right">P&L</TableHead>
                        <TableHead>Open Date</TableHead>
                        <TableHead>Close Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.trades.map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell>
                            {trade.is_winner ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {trade.symbol}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{trade.strategy}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrencyPlain(trade.premium_collected)}
                          </TableCell>
                          <TableCell className="text-right">
                            {trade.status === 'EXPIRED' ? (
                              <span className="text-muted-foreground">Expired</span>
                            ) : (
                              formatCurrencyPlain(trade.close_price)
                            )}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-semibold",
                            trade.is_winner ? 'text-green-500' : 'text-red-500'
                          )}>
                            {formatCurrency(trade.pnl)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {trade.open_date}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {trade.close_date}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Summary row */}
              {stats.trades.length > 0 && (
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <div className="space-x-4">
                    <span className="text-sm text-muted-foreground">
                      {stats.trades.length} trades total
                    </span>
                    <Badge variant="outline" className="text-green-600">
                      {stats.winningTrades} Wins
                    </Badge>
                    <Badge variant="outline" className="text-red-600">
                      {stats.losingTrades} Losses
                    </Badge>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground mr-2">Total Realized:</span>
                    <span className={cn(
                      "text-lg font-bold",
                      stats.realizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
                    )}>
                      {formatCurrency(stats.realizedPnl)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Open Positions Tab */}
        <TabsContent value="open">
          <Card>
            <CardHeader>
              <CardTitle>Open Positions</CardTitle>
              <CardDescription>
                Current positions with unrealized P&L (premium collected as max potential profit)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {openPositionsWithPnl.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No open positions</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    All positions have been closed
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Option</TableHead>
                        <TableHead>Strategy</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead className="text-right">Premium Collected</TableHead>
                        <TableHead className="text-right">Unrealized P&L</TableHead>
                        <TableHead>Open Date</TableHead>
                        <TableHead>Expiry</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openPositionsWithPnl.map((position) => (
                        <TableRow key={position.id}>
                          <TableCell className="font-medium">
                            {position.symbol}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{position.strategy}</Badge>
                          </TableCell>
                          <TableCell>{position.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrencyPlain(position.premium_collected)}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-semibold",
                            position.unrealized_pnl >= 0 ? 'text-green-500' : 'text-red-500'
                          )}>
                            {formatCurrency(position.unrealized_pnl)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {position.open_date}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {position.expiry}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Summary row */}
              {openPositionsWithPnl.length > 0 && (
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {openPositionsWithPnl.length} open positions
                  </span>
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground mr-2">Total Unrealized:</span>
                    <span className={cn(
                      "text-lg font-bold",
                      stats.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
                    )}>
                      {formatCurrency(stats.unrealizedPnl)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
