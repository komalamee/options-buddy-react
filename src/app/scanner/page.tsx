'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Search,
  Play,
  RefreshCw,
  Filter,
  TrendingUp,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Demo scan results
const scanResults = [
  {
    symbol: 'TSLA',
    optionType: 'PUT',
    strike: 380,
    expiration: '2025-01-17',
    bid: 4.20,
    ask: 4.45,
    iv: 0.52,
    delta: -0.25,
    theta: -0.12,
    dte: 19,
    score: 85,
  },
  {
    symbol: 'NVDA',
    optionType: 'PUT',
    strike: 125,
    expiration: '2025-01-17',
    bid: 2.80,
    ask: 3.05,
    iv: 0.48,
    delta: -0.22,
    theta: -0.08,
    dte: 19,
    score: 78,
  },
  {
    symbol: 'AAPL',
    optionType: 'CALL',
    strike: 200,
    expiration: '2025-01-17',
    bid: 1.95,
    ask: 2.15,
    iv: 0.28,
    delta: 0.30,
    theta: -0.05,
    dte: 19,
    score: 72,
  },
  {
    symbol: 'AMD',
    optionType: 'PUT',
    strike: 130,
    expiration: '2025-01-17',
    bid: 3.10,
    ask: 3.35,
    iv: 0.45,
    delta: -0.28,
    theta: -0.10,
    dte: 19,
    score: 68,
  },
];

const watchlists = [
  { id: 'tech', name: 'Tech Giants', symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA'] },
  { id: 'ev', name: 'EV & Clean Energy', symbols: ['TSLA', 'RIVN', 'LCID', 'NIO'] },
  { id: 'semis', name: 'Semiconductors', symbols: ['NVDA', 'AMD', 'INTC', 'TSM', 'AVGO'] },
  { id: 'custom', name: 'My Watchlist', symbols: ['TSLA', 'NVDA', 'AMD', 'COIN', 'MSTR'] },
];

function getScoreBadge(score: number) {
  if (score >= 80) {
    return <Badge className="bg-green-500 hover:bg-green-600">{score}</Badge>;
  }
  if (score >= 60) {
    return <Badge className="bg-yellow-500 hover:bg-yellow-600">{score}</Badge>;
  }
  return <Badge variant="destructive">{score}</Badge>;
}

export default function ScannerPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [selectedWatchlist, setSelectedWatchlist] = useState('custom');
  const [strategyType, setStrategyType] = useState('csp');
  const [minDte, setMinDte] = useState([14]);
  const [maxDte, setMaxDte] = useState([45]);
  const [minDelta, setMinDelta] = useState([0.15]);
  const [maxDelta, setMaxDelta] = useState([0.35]);
  const [connected, setConnected] = useState(false);

  const handleScan = async () => {
    setIsScanning(true);
    // Simulate scan
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsScanning(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scanner</h1>
          <p className="text-muted-foreground">
            Find options opportunities matching your criteria
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={connected ? 'default' : 'destructive'} className={cn(connected && 'bg-green-500')}>
            {connected ? 'IBKR Connected' : 'IBKR Disconnected'}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Filters Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Scan Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Watchlist */}
            <div className="space-y-2">
              <Label>Watchlist</Label>
              <Select value={selectedWatchlist} onValueChange={setSelectedWatchlist}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {watchlists.map((wl) => (
                    <SelectItem key={wl.id} value={wl.id}>
                      {wl.name} ({wl.symbols.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Strategy */}
            <div className="space-y-2">
              <Label>Strategy</Label>
              <Select value={strategyType} onValueChange={setStrategyType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csp">Cash Secured Puts</SelectItem>
                  <SelectItem value="cc">Covered Calls</SelectItem>
                  <SelectItem value="ic">Iron Condors</SelectItem>
                  <SelectItem value="ps">Put Spreads</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* DTE Range */}
            <div className="space-y-4">
              <Label>Days to Expiration</Label>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Min: {minDte[0]}d</span>
                  <span>Max: {maxDte[0]}d</span>
                </div>
                <Slider
                  value={minDte}
                  onValueChange={setMinDte}
                  min={1}
                  max={90}
                  step={1}
                />
                <Slider
                  value={maxDte}
                  onValueChange={setMaxDte}
                  min={1}
                  max={90}
                  step={1}
                />
              </div>
            </div>

            {/* Delta Range */}
            <div className="space-y-4">
              <Label>Delta Range</Label>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Min: {minDelta[0].toFixed(2)}</span>
                  <span>Max: {maxDelta[0].toFixed(2)}</span>
                </div>
                <Slider
                  value={minDelta}
                  onValueChange={setMinDelta}
                  min={0.05}
                  max={0.50}
                  step={0.01}
                />
                <Slider
                  value={maxDelta}
                  onValueChange={setMaxDelta}
                  min={0.05}
                  max={0.50}
                  step={0.01}
                />
              </div>
            </div>

            {/* Quick Filters */}
            <div className="space-y-3">
              <Label>Quick Filters</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm">High IV Only</span>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Weekly Options</span>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">High Volume</span>
                <Switch />
              </div>
            </div>

            {/* Scan Button */}
            <Button
              onClick={handleScan}
              disabled={isScanning || !connected}
              className="w-full"
              size="lg"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Scan {watchlists.find((w) => w.id === selectedWatchlist)?.symbols.length || 0} Symbols
                </>
              )}
            </Button>

            {!connected && (
              <p className="text-sm text-muted-foreground text-center">
                Connect to IBKR in Settings to scan live data
              </p>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Scan Results</CardTitle>
                  <CardDescription>
                    {scanResults.length} opportunities found
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {scanResults.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Strike</TableHead>
                      <TableHead>Exp</TableHead>
                      <TableHead>DTE</TableHead>
                      <TableHead>Bid/Ask</TableHead>
                      <TableHead>IV</TableHead>
                      <TableHead>Delta</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanResults.map((result, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-semibold">{result.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={result.optionType === 'CALL' ? 'default' : 'secondary'}>
                            {result.optionType}
                          </Badge>
                        </TableCell>
                        <TableCell>${result.strike}</TableCell>
                        <TableCell>{result.expiration}</TableCell>
                        <TableCell>{result.dte}d</TableCell>
                        <TableCell>
                          ${result.bid.toFixed(2)} / ${result.ask.toFixed(2)}
                        </TableCell>
                        <TableCell>{(result.iv * 100).toFixed(0)}%</TableCell>
                        <TableCell>{result.delta.toFixed(2)}</TableCell>
                        <TableCell>{getScoreBadge(result.score)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Zap className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No results yet</p>
                  <p className="text-sm text-muted-foreground">
                    Configure your filters and click Scan to find opportunities
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
