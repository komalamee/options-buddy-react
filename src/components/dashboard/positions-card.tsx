'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, AlertTriangle, Clock } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Position } from '@/types';

interface PositionsCardProps {
  positions: Position[];
}

function getDteBadge(dte: number) {
  if (dte <= 3) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        {dte}d CRITICAL
      </Badge>
    );
  }
  if (dte <= 7) {
    return (
      <Badge variant="outline" className="border-orange-500 text-orange-500 gap-1">
        <Clock className="h-3 w-3" />
        {dte}d EXPIRING
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      {dte}d
    </Badge>
  );
}

export function PositionsCard({ positions }: PositionsCardProps) {
  const displayPositions = positions.slice(0, 5);
  const hasMore = positions.length > 5;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Open Positions</CardTitle>
        <Link href="/positions">
          <Button variant="ghost" size="sm" className="gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-muted-foreground">No open positions</p>
            <Link href="/scanner">
              <Button className="mt-4" size="sm">
                Find Opportunities
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {displayPositions.map((position) => (
              <div
                key={position.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:bg-accent/50 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{position.underlying}</span>
                    <span className="text-muted-foreground">
                      ${position.strike} {position.optionType}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getDteBadge(position.daysToExpiry)}
                  <span className="text-sm font-medium">
                    ${position.premiumCollected.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
            {hasMore && (
              <p className="text-sm text-muted-foreground text-center pt-2">
                + {positions.length - 5} more positions
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
