'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StockHolding } from '@/types';

interface HoldingsCardProps {
  holdings: StockHolding[];
  totalValue: number;
  ccLotsAvailable: number;
}

export function HoldingsCard({ holdings, totalValue, ccLotsAvailable }: HoldingsCardProps) {
  if (holdings.length === 0) {
    return null;
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Stock Holdings</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-lg bg-accent p-3 text-center">
            <p className="text-xl font-bold">{formatCurrency(totalValue)}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Market Value
            </p>
          </div>
          <div className="rounded-lg bg-accent p-3 text-center">
            <p className="text-xl font-bold">{ccLotsAvailable}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              CC Lots Ready
            </p>
          </div>
        </div>

        {/* Holdings list */}
        <div className="space-y-2">
          {holdings.slice(0, 4).map((holding) => {
            const lots = Math.floor(holding.quantity / 100);
            return (
              <div
                key={holding.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <span className="font-semibold">{holding.symbol}</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    {holding.quantity} shares
                  </span>
                </div>
                {lots > 0 && (
                  <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                    {lots} {lots === 1 ? 'lot' : 'lots'}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
