'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { usePortfolioStore } from '@/stores/portfolio-store';
import {
  LayoutDashboard,
  LineChart,
  Wallet,
  TrendingUp,
  Settings,
  RefreshCw,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Positions', href: '/positions', icon: Wallet },
  { name: 'Scanner', href: '/scanner', icon: TrendingUp },
  { name: 'Performance', href: '/performance', icon: LineChart },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { fetchAll, isLoading } = usePortfolioStore();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-border px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              OB
            </div>
            <span className="text-lg font-semibold">Options Buddy</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Connection Status */}
        <div className="border-t border-border p-4">
          <IBKRStatus />
          {isLoading && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Loading data...
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function IBKRStatus() {
  const { ibkrStatus } = usePortfolioStore();
  const connected = ibkrStatus.connected;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'h-2 w-2 rounded-full',
          connected ? 'bg-green-500' : 'bg-red-500'
        )}
      />
      <span className="text-sm text-muted-foreground">
        IBKR {connected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );
}
