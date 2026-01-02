'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, RefreshCw, TrendingUp, TrendingDown, DollarSign, Clock, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortfolioStore, AutoWheelAnalysis } from '@/stores/portfolio-store';
import { AutoWheelCard, AutoWheelDetail } from '@/components/wheel';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function PnlCell({ value, percent }: { value: number; percent?: number }) {
  const isPositive = value >= 0;
  return (
    <div className={cn('font-medium', isPositive ? 'text-green-500' : 'text-red-500')}>
      <div className="flex items-center gap-1">
        {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        {formatCurrency(Math.abs(value))}
      </div>
      {percent !== undefined && (
        <div className="text-xs opacity-80">
          {isPositive ? '+' : ''}{percent.toFixed(2)}%
        </div>
      )}
    </div>
  );
}

function getDteBadge(dte: number | undefined) {
  if (dte === undefined) return null;
  if (dte <= 3) {
    return <Badge variant="destructive">{dte}d CRITICAL</Badge>;
  }
  if (dte <= 7) {
    return <Badge className="bg-orange-500 hover:bg-orange-600">{dte}d EXPIRING</Badge>;
  }
  if (dte <= 14) {
    return <Badge variant="secondary">{dte}d WATCH</Badge>;
  }
  return <Badge variant="outline">{dte}d</Badge>;
}

export default function PositionsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedWheelAnalysis, setSelectedWheelAnalysis] = useState<AutoWheelAnalysis | null>(null);
  const premiumTrackerRef = useRef<HTMLDivElement>(null);

  const {
    positions,
    closedPositions,
    stockHoldings,
    ibkrStatus,
    isSyncing,
    error,
    fetchPositions,
    fetchClosedPositions,
    fetchHoldings,
    fetchIBKRStatus,
    syncWithIBKR,
    autoWheelAnalysis,
    autoWheelSummary,
    fetchAutoWheelAnalysis,
  } = usePortfolioStore();

  // Load data on mount
  useEffect(() => {
    fetchIBKRStatus();
    fetchPositions();
    fetchClosedPositions();
    fetchHoldings();
    fetchAutoWheelAnalysis();
  }, [fetchIBKRStatus, fetchPositions, fetchClosedPositions, fetchHoldings, fetchAutoWheelAnalysis]);

  // Scroll to premium tracker section
  const scrollToPremiumTracker = () => {
    premiumTrackerRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSync = async () => {
    const success = await syncWithIBKR();
    if (success) {
      // Data is automatically refreshed in the store
    }
  };

  // Filter positions based on search and filter
  const filteredPositions = positions.filter((pos) => {
    const matchesSearch = pos.underlying.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    switch (filter) {
      case 'expiring':
        return pos.days_to_expiry !== undefined && pos.days_to_expiry <= 14;
      case 'profitable':
        return true; // Would need current value to determine
      case 'losing':
        return false; // Would need current value to determine
      default:
        return true;
    }
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Positions</h1>
          <p className="text-muted-foreground">
            Manage your options positions and stock holdings
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing || !ibkrStatus.connected}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync IBKR
              </>
            )}
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Position
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      {!ibkrStatus.connected && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-600 px-4 py-3 rounded-lg">
          IBKR not connected. Go to Settings to connect for live sync.
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="options" className="space-y-4">
        <TabsList>
          <TabsTrigger value="options">Options ({positions.length})</TabsTrigger>
          <TabsTrigger value="stocks">Stocks ({stockHoldings.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({closedPositions.length})</TabsTrigger>
          <TabsTrigger value="premium" onClick={scrollToPremiumTracker}>
            <DollarSign className="h-4 w-4 mr-1" />
            Premium Tracker ({autoWheelAnalysis.length})
          </TabsTrigger>
        </TabsList>

        {/* Options Tab */}
        <TabsContent value="options" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search positions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positions</SelectItem>
                <SelectItem value="expiring">Expiring Soon</SelectItem>
                <SelectItem value="profitable">Profitable</SelectItem>
                <SelectItem value="losing">Losing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Options Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Strike</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>DTE</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Premium</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPositions.length > 0 ? (
                    filteredPositions.map((position) => (
                      <TableRow key={position.id}>
                        <TableCell className="font-semibold">{position.underlying}</TableCell>
                        <TableCell>
                          <Badge variant={position.option_type === 'CALL' ? 'default' : 'secondary'}>
                            {position.option_type}
                          </Badge>
                        </TableCell>
                        <TableCell>${position.strike}</TableCell>
                        <TableCell>{position.expiry}</TableCell>
                        <TableCell>{getDteBadge(position.days_to_expiry)}</TableCell>
                        <TableCell>{position.quantity}</TableCell>
                        <TableCell>{formatCurrency(position.premium_collected * position.quantity * 100)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{position.strategy_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">Manage</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No open positions. Add a position or sync from IBKR.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stocks Tab */}
        <TabsContent value="stocks" className="space-y-4">
          {/* Portfolio Summary */}
          {stockHoldings.length > 0 && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Market Value</CardDescription>
                  <CardTitle className="text-2xl">
                    {stockHoldings.some(h => h.market_value)
                      ? formatCurrency(stockHoldings.reduce((sum, h) => sum + (h.market_value || 0), 0))
                      : <span className="text-muted-foreground text-base">Sync for live data</span>
                    }
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Cost Basis</CardDescription>
                  <CardTitle className="text-2xl">
                    {stockHoldings.some(h => h.avg_cost)
                      ? formatCurrency(stockHoldings.reduce((sum, h) => sum + (h.avg_cost || 0) * h.quantity, 0))
                      : <span className="text-muted-foreground text-base">-</span>
                    }
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Unrealized P&L</CardDescription>
                  <CardTitle className={cn(
                    "text-2xl",
                    stockHoldings.reduce((sum, h) => sum + (h.unrealized_pnl || 0), 0) >= 0
                      ? "text-green-500"
                      : "text-red-500"
                  )}>
                    {stockHoldings.some(h => h.unrealized_pnl !== null && h.unrealized_pnl !== undefined)
                      ? formatCurrency(stockHoldings.reduce((sum, h) => sum + (h.unrealized_pnl || 0), 0))
                      : <span className="text-muted-foreground text-base">Sync for live data</span>
                    }
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Available CC Lots</CardDescription>
                  <CardTitle className="text-2xl text-green-500">
                    {stockHoldings.reduce((sum, h) => sum + Math.floor(h.quantity / 100), 0)} lots
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Stock Holdings</CardTitle>
              <CardDescription>Your current stock positions for covered calls</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>Avg Cost</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>Market Value</TableHead>
                    <TableHead>P&L</TableHead>
                    <TableHead>CC Lots</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockHoldings.length > 0 ? (
                    stockHoldings.map((holding) => (
                      <TableRow key={holding.id}>
                        <TableCell className="font-semibold">{holding.symbol}</TableCell>
                        <TableCell>{holding.quantity}</TableCell>
                        <TableCell>{holding.avg_cost ? formatCurrency(holding.avg_cost) : '-'}</TableCell>
                        <TableCell>{holding.current_price ? formatCurrency(holding.current_price) : '-'}</TableCell>
                        <TableCell>{holding.market_value ? formatCurrency(holding.market_value) : '-'}</TableCell>
                        <TableCell>
                          {holding.unrealized_pnl !== undefined ? (
                            <PnlCell value={holding.unrealized_pnl} />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {Math.floor(holding.quantity / 100) > 0 ? (
                            <Badge className="bg-green-500 hover:bg-green-600">
                              {Math.floor(holding.quantity / 100)} lots
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No stock holdings. Sync from IBKR to import your positions.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Closed Tab */}
        <TabsContent value="closed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Closed Positions</CardTitle>
              <CardDescription>Historical trades and realized P&L</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Strike</TableHead>
                    <TableHead>Open Date</TableHead>
                    <TableHead>Close Date</TableHead>
                    <TableHead>Premium</TableHead>
                    <TableHead>Close Price</TableHead>
                    <TableHead>P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closedPositions.length > 0 ? (
                    closedPositions.map((position) => {
                      const pnl = (position.premium_collected - (position.close_price || 0)) * position.quantity * 100;
                      return (
                        <TableRow key={position.id}>
                          <TableCell className="font-semibold">{position.underlying}</TableCell>
                          <TableCell>
                            <Badge variant={position.option_type === 'CALL' ? 'default' : 'secondary'}>
                              {position.option_type}
                            </Badge>
                          </TableCell>
                          <TableCell>${position.strike}</TableCell>
                          <TableCell>{position.open_date}</TableCell>
                          <TableCell>{position.close_date}</TableCell>
                          <TableCell>{formatCurrency(position.premium_collected * position.quantity * 100)}</TableCell>
                          <TableCell>{position.close_price !== undefined ? formatCurrency(position.close_price * position.quantity * 100) : '-'}</TableCell>
                          <TableCell>
                            <PnlCell value={pnl} />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No closed positions yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Premium Tracker Tab */}
        <TabsContent value="premium" className="space-y-4" ref={premiumTrackerRef}>
          {selectedWheelAnalysis ? (
            <AutoWheelDetail
              analysis={autoWheelAnalysis.find(a => a.id === selectedWheelAnalysis.id) || selectedWheelAnalysis}
              onBack={() => setSelectedWheelAnalysis(null)}
            />
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Underlyings Tracked
                    </CardTitle>
                    <RotateCcw className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{autoWheelSummary.total_underlyings}</div>
                    <p className="text-xs text-muted-foreground">
                      {autoWheelSummary.collecting_premium_count} collecting, {autoWheelSummary.holding_shares_count} holding
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Premium Earned
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-500">
                      {formatCurrency(autoWheelSummary.total_premium_collected)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      From closed positions
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Pending Premium
                    </CardTitle>
                    <Clock className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-500">
                      {formatCurrency(autoWheelSummary.total_pending_premium)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      From open positions
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Avg Cost Reduction
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(autoWheelSummary.average_cost_reduction)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Per holding with shares
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Premium Tracker Cards */}
              {autoWheelAnalysis.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <RotateCcw className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Wheel Activity Yet</h3>
                    <p className="text-muted-foreground text-center max-w-md">
                      Once you have CSP or Covered Call positions synced from IBKR, they will automatically
                      appear here with premium tracking and cost basis calculations.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {autoWheelAnalysis.map((analysis) => (
                    <AutoWheelCard
                      key={analysis.id}
                      analysis={analysis}
                      onSelect={setSelectedWheelAnalysis}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
