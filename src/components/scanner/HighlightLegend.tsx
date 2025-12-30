'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Info } from 'lucide-react';

export function HighlightLegend() {
  return (
    <Card className="bg-muted/30">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-6 flex-wrap text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Info className="h-4 w-4" />
            <span className="font-medium">Legend:</span>
          </div>

          {/* High IV */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/30" />
            <span>High IV (&gt;30%)</span>
          </div>

          {/* Good Delta */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4 border-blue-500 bg-muted" />
            <span>Good Delta</span>
          </div>

          {/* High Volume */}
          <div className="flex items-center gap-2">
            <div className="relative w-4 h-4 rounded bg-muted">
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-orange-500" />
            </div>
            <span>High Volume</span>
          </div>

          {/* Arbitrage */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4 border-purple-500 bg-muted" />
            <span>Tight Spread</span>
          </div>

          {/* Perfect Match */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded ring-2 ring-yellow-400/50 shadow-lg shadow-yellow-400/30 bg-muted" />
            <span>Perfect Match (3+)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
