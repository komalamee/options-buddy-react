'use client';

import { useState } from 'react';
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
import { Search, Plus, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Position types
interface Position {
  id: number;
  underlying: string;
  optionType: 'CALL' | 'PUT';
  strike: number;
  expiration: string;
  quantity: number;
  premiumCollected: number;
  currentValue?: number;
  pnl: number;
  pnlPercent: number;
  openDate: string;
  closeDate?: string;
  closePremium?: number;
  status: string;
  daysToExpiry?: number;
}

interface StockHolding {
  id: number;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
}

// Empty arrays - data will come from API/backend
const positions: Position[] = [];
const closedPositions: Position[] = [];
const stockHoldings: StockHolding[] = [];

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

function getDteBadge(dte: number) {
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
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync IBKR
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Position
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="options" className="space-y-4">
        <TabsList>
          <TabsTrigger value="options">Options ({positions.length})</TabsTrigger>
          <TabsTrigger value="stocks">Stocks ({stockHoldings.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({closedPositions.length})</TabsTrigger>
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
                    <TableHead>P&L</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position) => (
                    <TableRow key={position.id}>
                      <TableCell className="font-semibold">{position.underlying}</TableCell>
                      <TableCell>
                        <Badge variant={position.optionType === 'CALL' ? 'default' : 'secondary'}>
                          {position.optionType}
                        </Badge>
                      </TableCell>
                      <TableCell>${position.strike}</TableCell>
                      <TableCell>{position.expiration}</TableCell>
                      <TableCell>{position.daysToExpiry !== undefined && getDteBadge(position.daysToExpiry)}</TableCell>
                      <TableCell>{position.quantity}</TableCell>
                      <TableCell>{formatCurrency(position.premiumCollected)}</TableCell>
                      <TableCell>
                        <PnlCell value={position.pnl} percent={position.pnlPercent} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Manage</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stocks Tab */}
        <TabsContent value="stocks" className="space-y-4">
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
                  {stockHoldings.map((holding) => (
                    <TableRow key={holding.id}>
                      <TableCell className="font-semibold">{holding.symbol}</TableCell>
                      <TableCell>{holding.quantity}</TableCell>
                      <TableCell>{formatCurrency(holding.avgCost)}</TableCell>
                      <TableCell>{formatCurrency(holding.currentPrice)}</TableCell>
                      <TableCell>{formatCurrency(holding.marketValue)}</TableCell>
                      <TableCell>
                        <PnlCell value={holding.pnl} percent={holding.pnlPercent} />
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
                  ))}
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
                    <TableHead>Close</TableHead>
                    <TableHead>P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closedPositions.map((position) => (
                    <TableRow key={position.id}>
                      <TableCell className="font-semibold">{position.underlying}</TableCell>
                      <TableCell>
                        <Badge variant={position.optionType === 'CALL' ? 'default' : 'secondary'}>
                          {position.optionType}
                        </Badge>
                      </TableCell>
                      <TableCell>${position.strike}</TableCell>
                      <TableCell>{position.openDate}</TableCell>
                      <TableCell>{position.closeDate}</TableCell>
                      <TableCell>{formatCurrency(position.premiumCollected)}</TableCell>
                      <TableCell>{position.closePremium !== undefined && formatCurrency(position.closePremium)}</TableCell>
                      <TableCell>
                        <PnlCell value={position.pnl} percent={position.pnlPercent} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
