'use client';

import { MetricsRow } from '@/components/dashboard/metrics-row';
import { PositionsCard } from '@/components/dashboard/positions-card';
import { AlertsCard } from '@/components/dashboard/alerts-card';
import { HoldingsCard } from '@/components/dashboard/holdings-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { usePortfolioStore } from '@/stores/portfolio-store';

export default function DashboardPage() {
  const {
    positions,
    stockHoldings,
    summary,
    alerts,
  } = usePortfolioStore();

  // Transform positions to the format expected by PositionsCard
  const formattedPositions = positions.map((p) => ({
    id: p.id,
    underlying: p.underlying,
    optionType: p.option_type,
    strike: p.strike,
    expiration: p.expiry,
    quantity: p.quantity,
    premiumCollected: p.premium_collected,
    openDate: p.open_date,
    status: p.status === 'OPEN' ? 'open' as const : 'closed' as const,
    daysToExpiry: p.days_to_expiry || 0,
  }));

  // Transform holdings to the format expected by HoldingsCard
  const formattedHoldings = stockHoldings.map((h) => ({
    id: h.id,
    symbol: h.symbol,
    quantity: h.quantity,
    avgCost: h.avg_cost || 0,
  }));

  // Transform alerts to the format expected by AlertsCard
  const formattedAlerts = alerts.map((a) => ({
    id: a.id,
    type: a.type,
    title: a.title,
    message: a.message,
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Portfolio overview and quick insights
        </p>
      </div>

      {/* Metrics Row */}
      <MetricsRow
        totalValue={summary.totalValue}
        realizedPnl={summary.realizedPnl}
        openPositions={summary.openPositions}
        openPremium={summary.openPremium}
        winRate={summary.winRate}
        totalTrades={summary.totalTrades}
      />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* AI Advisor CTA - Takes 2 columns */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Market Advisor
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Your intelligent options trading assistant
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="rounded-lg bg-primary/10 p-4">
                <p className="font-medium">Portfolio Summary</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You have {summary.openPositions} open position{summary.openPositions !== 1 ? 's' : ''} and {stockHoldings.length} stock holding{stockHoldings.length !== 1 ? 's' : ''}.
                  {summary.ccLotsAvailable > 0 && ` ${summary.ccLotsAvailable} covered call lot${summary.ccLotsAvailable !== 1 ? 's' : ''} available.`}
                </p>
              </div>

              {/* Quick insights */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-3 rounded-lg border">
                  <p className="text-sm font-medium">Win Rate</p>
                  <p className="text-2xl font-bold text-green-500">{summary.winRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">{summary.totalTrades} total trades</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="text-sm font-medium">Realized P&L</p>
                  <p className={`text-2xl font-bold ${summary.realizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ${summary.realizedPnl.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Lifetime earnings</p>
                </div>
              </div>

              {/* CTA to AI Advisor */}
              <Link href="/advisor">
                <Button className="w-full" size="lg">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Open AI Advisor
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <AlertsCard alerts={formattedAlerts} />
          <PositionsCard positions={formattedPositions} />
          <HoldingsCard
            holdings={formattedHoldings}
            totalValue={summary.totalStockValue}
            ccLotsAvailable={summary.ccLotsAvailable}
          />
        </div>
      </div>
    </div>
  );
}
