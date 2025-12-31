'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface MarketStatus {
  is_open: boolean;
  status: 'open' | 'closed' | 'pre_market' | 'after_hours';
  reason: string;
  message: string;
  current_time_et: string;
  next_open?: string;
  closes_at?: string;
}

export function MarketStatusBanner() {
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarketStatus = async () => {
      try {
        const status = await api.getMarketStatus();
        setMarketStatus(status);
        setError(null);
      } catch (err) {
        setError('Unable to check market status');
      }
    };

    fetchMarketStatus();

    // Refresh every minute
    const interval = setInterval(fetchMarketStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Don't show anything if market is open or status unknown
  if (!marketStatus || marketStatus.is_open) {
    return null;
  }

  return (
    <Alert
      className={cn(
        'border-amber-500/50 bg-amber-500/10',
        '[&>svg]:text-amber-500'
      )}
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {marketStatus.message}
          </span>
          <span className="text-muted-foreground">
            — Prices shown are last known values
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Opens {marketStatus.next_open}</span>
        </div>
      </AlertDescription>
    </Alert>
  );
}
