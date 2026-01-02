'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, DollarSign, RotateCcw, Clock, Package } from 'lucide-react';
import { usePortfolioStore, AutoWheelAnalysis } from '@/stores/portfolio-store';
import { AutoWheelCard, AutoWheelDetail } from '@/components/wheel';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function WheelPage() {
  const [selectedAnalysis, setSelectedAnalysis] = useState<AutoWheelAnalysis | null>(null);

  const {
    autoWheelAnalysis,
    autoWheelSummary,
    fetchAutoWheelAnalysis,
  } = usePortfolioStore();

  useEffect(() => {
    fetchAutoWheelAnalysis();
  }, [fetchAutoWheelAnalysis]);

  // Filter by status
  const collectingPremium = autoWheelAnalysis.filter(a => a.status === 'COLLECTING_PREMIUM');
  const holdingShares = autoWheelAnalysis.filter(a => a.status === 'HOLDING_SHARES');
  const closedChains = autoWheelAnalysis.filter(a => a.status === 'CLOSED');

  // If an analysis is selected, show the detail view
  if (selectedAnalysis) {
    // Get the latest version from the store
    const latest = autoWheelAnalysis.find(a => a.id === selectedAnalysis.id) || selectedAnalysis;
    return (
      <div className="p-6">
        <AutoWheelDetail
          analysis={latest}
          onBack={() => setSelectedAnalysis(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Premium Tracker</h1>
        <p className="text-muted-foreground">
          Automatically tracks premium accumulation and cost basis adjustments from your IBKR positions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Underlyings Tracked
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
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

      {/* Analysis List */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All ({autoWheelAnalysis.length})</TabsTrigger>
          <TabsTrigger value="holding">Holding Shares ({holdingShares.length})</TabsTrigger>
          <TabsTrigger value="collecting">Collecting ({collectingPremium.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({closedChains.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {autoWheelAnalysis.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {autoWheelAnalysis.map((analysis) => (
                <AutoWheelCard
                  key={analysis.id}
                  analysis={analysis}
                  onSelect={setSelectedAnalysis}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="holding" className="space-y-4">
          {holdingShares.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No underlyings currently holding shares
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {holdingShares.map((analysis) => (
                <AutoWheelCard
                  key={analysis.id}
                  analysis={analysis}
                  onSelect={setSelectedAnalysis}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="collecting" className="space-y-4">
          {collectingPremium.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No underlyings currently collecting premium
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {collectingPremium.map((analysis) => (
                <AutoWheelCard
                  key={analysis.id}
                  analysis={analysis}
                  onSelect={setSelectedAnalysis}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="closed" className="space-y-4">
          {closedChains.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No closed wheel activity yet
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {closedChains.map((analysis) => (
                <AutoWheelCard
                  key={analysis.id}
                  analysis={analysis}
                  onSelect={setSelectedAnalysis}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <RotateCcw className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Wheel Activity Yet</h3>
        <p className="text-muted-foreground text-center max-w-md mb-4">
          Once you have CSP or Covered Call positions synced from IBKR, they will automatically
          appear here with premium tracking and cost basis calculations.
        </p>
        <p className="text-sm text-muted-foreground">
          Sync your IBKR account to get started.
        </p>
      </CardContent>
    </Card>
  );
}
