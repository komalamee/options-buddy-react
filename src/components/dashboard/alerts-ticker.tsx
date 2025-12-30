'use client';

import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert as AlertType } from '@/types';

interface AlertsTickerProps {
  alerts: AlertType[];
}

function getAlertIcon(type: AlertType['type']) {
  switch (type) {
    case 'critical':
      return <AlertTriangle className="h-3.5 w-3.5" />;
    case 'warning':
      return <AlertCircle className="h-3.5 w-3.5" />;
    case 'info':
    default:
      return <Info className="h-3.5 w-3.5" />;
  }
}

function getAlertColor(type: AlertType['type']) {
  switch (type) {
    case 'critical':
      return 'text-red-500';
    case 'warning':
      return 'text-orange-500';
    case 'info':
    default:
      return 'text-blue-500';
  }
}

export function AlertsTicker({ alerts }: AlertsTickerProps) {
  if (alerts.length === 0) {
    return (
      <div className="w-full bg-green-500/10 border-b border-green-500/20 py-2 px-4">
        <div className="flex items-center justify-center gap-2 text-green-500 text-sm">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="font-medium">All clear - No urgent alerts</span>
        </div>
      </div>
    );
  }

  // Create a ticker content by repeating alerts for continuous scroll effect
  const tickerItems = [...alerts, ...alerts, ...alerts];

  return (
    <div className="w-full bg-muted/50 border-b overflow-hidden py-2">
      <div className="relative">
        <div className="animate-ticker flex items-center gap-8 whitespace-nowrap">
          {tickerItems.map((alert, idx) => (
            <div
              key={`${alert.id}-${idx}`}
              className={cn(
                'inline-flex items-center gap-2 text-sm',
                getAlertColor(alert.type)
              )}
            >
              {getAlertIcon(alert.type)}
              <span className="font-medium">{alert.title}:</span>
              <span className="opacity-80">{alert.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
