'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert as AlertType } from '@/types';

interface AlertsCardProps {
  alerts: AlertType[];
}

function getAlertIcon(type: AlertType['type']) {
  switch (type) {
    case 'critical':
      return <AlertTriangle className="h-4 w-4" />;
    case 'warning':
      return <AlertCircle className="h-4 w-4" />;
    case 'info':
    default:
      return <Info className="h-4 w-4" />;
  }
}

function getAlertStyles(type: AlertType['type']) {
  switch (type) {
    case 'critical':
      return 'border-red-500/50 bg-red-500/10 text-red-500 [&>svg]:text-red-500';
    case 'warning':
      return 'border-orange-500/50 bg-orange-500/10 text-orange-500 [&>svg]:text-orange-500';
    case 'info':
    default:
      return 'border-blue-500/50 bg-blue-500/10 text-blue-500 [&>svg]:text-blue-500';
  }
}

export function AlertsCard({ alerts }: AlertsCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-green-500/10 p-3 mb-3">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-green-500 font-medium">All clear!</p>
            <p className="text-sm text-muted-foreground mt-1">
              No urgent alerts
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <Alert key={alert.id} className={cn(getAlertStyles(alert.type))}>
                {getAlertIcon(alert.type)}
                <AlertTitle className="font-semibold">{alert.title}</AlertTitle>
                <AlertDescription className="text-sm opacity-90">
                  {alert.message}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
