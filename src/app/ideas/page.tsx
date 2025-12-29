'use client';

import { useState } from 'react';
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
import { Search, TrendingUp, TrendingDown, Minus, RefreshCw, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Demo trade ideas
const tradeIdeas = [
  {
    symbol: 'TSLA',
    name: 'Tesla Inc',
    sentiment: 'Bullish',
    price: 421.06,
    change: 2.4,
    ivRank: 72,
    score: 85,
    strategy: 'Iron Condor',
    rationale: 'High IV rank makes premium selling attractive. Range-bound technicals suggest iron condor strategy.',
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corp',
    sentiment: 'Bullish',
    price: 134.22,
    change: 1.8,
    ivRank: 65,
    score: 82,
    strategy: 'Cash Secured Put',
    rationale: 'Strong momentum with elevated IV. CSP at support level offers good risk/reward.',
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc',
    sentiment: 'Neutral',
    price: 189.75,
    change: -0.3,
    ivRank: 45,
    score: 68,
    strategy: 'Covered Call',
    rationale: 'Consolidating near highs. If you own shares, covered calls can generate income.',
  },
  {
    symbol: 'AMD',
    name: 'AMD Inc',
    sentiment: 'Bullish',
    price: 142.30,
    change: 3.1,
    ivRank: 58,
    score: 75,
    strategy: 'Bull Put Spread',
    rationale: 'Technical breakout with rising momentum. Bull put spread limits risk while capturing upside.',
  },
  {
    symbol: 'SPY',
    name: 'S&P 500 ETF',
    sentiment: 'Neutral',
    price: 478.50,
    change: 0.2,
    ivRank: 32,
    score: 55,
    strategy: 'Iron Condor',
    rationale: 'Low volatility environment. Wide iron condor for steady income in range-bound market.',
  },
  {
    symbol: 'META',
    name: 'Meta Platforms',
    sentiment: 'Bullish',
    price: 358.90,
    change: 1.5,
    ivRank: 48,
    score: 70,
    strategy: 'Cash Secured Put',
    rationale: 'Strong fundamentals with recent pullback. CSP at support could yield quality entry.',
  },
];

// Mock covered call candidates from portfolio
const ccCandidates = [
  { symbol: 'TSLA', shares: 158, lots: 1 },
];

function getSentimentIcon(sentiment: string) {
  switch (sentiment) {
    case 'Bullish':
      return <TrendingUp className="h-4 w-4" />;
    case 'Bearish':
      return <TrendingDown className="h-4 w-4" />;
    default:
      return <Minus className="h-4 w-4" />;
  }
}

function getSentimentColor(sentiment: string) {
  switch (sentiment) {
    case 'Bullish':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'Bearish':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  }
}

function getScoreColor(score: number) {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  return 'text-red-500';
}

interface TradeIdeaCardProps {
  idea: typeof tradeIdeas[0];
}

function TradeIdeaCard({ idea }: TradeIdeaCardProps) {
  const isPositive = idea.change >= 0;

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg">{idea.symbol}</h3>
            <p className="text-sm text-muted-foreground">{idea.name}</p>
          </div>
          <Badge variant="outline" className={cn('gap-1', getSentimentColor(idea.sentiment))}>
            {getSentimentIcon(idea.sentiment)}
            {idea.sentiment}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">Price</p>
            <p className="font-medium">${idea.price.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Change</p>
            <p className={cn('font-medium', isPositive ? 'text-green-500' : 'text-red-500')}>
              {isPositive ? '+' : ''}{idea.change}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">IV Rank</p>
            <p className="font-medium">{idea.ivRank}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Score</p>
            <p className={cn('font-bold', getScoreColor(idea.score))}>{idea.score}</p>
          </div>
        </div>

        {/* Strategy */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <Badge>{idea.strategy}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{idea.rationale}</p>
        </div>

        {/* Action */}
        <Button className="w-full" variant="outline">
          Analyze {idea.symbol}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function IdeasPage() {
  const [search, setSearch] = useState('');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [sentimentFilter, setSentimentFilter] = useState('all');

  const filteredIdeas = tradeIdeas.filter((idea) => {
    if (search && !idea.symbol.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (strategyFilter !== 'all' && idea.strategy !== strategyFilter) {
      return false;
    }
    if (sentimentFilter !== 'all' && idea.sentiment !== sentimentFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trade Ideas</h1>
          <p className="text-muted-foreground">
            AI-powered trade suggestions based on market conditions
          </p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Ideas
        </Button>
      </div>

      {/* Market Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground uppercase tracking-wider">VIX</p>
              <p className="text-3xl font-bold mt-1">14.2</p>
              <p className="text-sm text-green-500">Low Volatility</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground uppercase tracking-wider">Market Trend</p>
              <p className="text-3xl font-bold mt-1">↗</p>
              <p className="text-sm text-green-500">Bullish</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground uppercase tracking-wider">Premium Env.</p>
              <p className="text-3xl font-bold mt-1">Med</p>
              <p className="text-sm text-yellow-500">Moderate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ideas Grid */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>AI Trade Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search symbols..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={strategyFilter} onValueChange={setStrategyFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Strategies</SelectItem>
                    <SelectItem value="Cash Secured Put">Cash Secured Put</SelectItem>
                    <SelectItem value="Covered Call">Covered Call</SelectItem>
                    <SelectItem value="Iron Condor">Iron Condor</SelectItem>
                    <SelectItem value="Bull Put Spread">Bull Put Spread</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Sentiment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Bullish">Bullish</SelectItem>
                    <SelectItem value="Bearish">Bearish</SelectItem>
                    <SelectItem value="Neutral">Neutral</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Ideas Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                {filteredIdeas.map((idea) => (
                  <TradeIdeaCard key={idea.symbol} idea={idea} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* CC Candidates */}
          <Card>
            <CardHeader>
              <CardTitle>Covered Call Candidates</CardTitle>
              <CardDescription>Based on your holdings</CardDescription>
            </CardHeader>
            <CardContent>
              {ccCandidates.length > 0 ? (
                <div className="space-y-3">
                  {ccCandidates.map((stock) => (
                    <div
                      key={stock.symbol}
                      className="flex items-center justify-between p-3 rounded-lg border border-border"
                    >
                      <div>
                        <p className="font-semibold">{stock.symbol}</p>
                        <p className="text-sm text-muted-foreground">
                          {stock.shares} shares ({stock.lots} lots)
                        </p>
                      </div>
                      <Badge className="bg-green-500 hover:bg-green-600">CC Ready</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No stocks with 100+ shares for covered calls
                </p>
              )}
            </CardContent>
          </Card>

          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle>About Trade Ideas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                These suggestions are generated based on technical analysis, IV rank,
                and market conditions. Always do your own research before trading.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
