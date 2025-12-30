'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  TrendingUp,
  Wallet,
  Target,
  AlertTriangle,
  Lightbulb,
  X,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types for suggestions that can be extracted from AI responses
export interface TradeSuggestion {
  id: string;
  type: 'covered_call' | 'csp' | 'roll' | 'close' | 'alert' | 'insight';
  symbol: string;
  title: string;
  description: string;
  details?: {
    strike?: number;
    expiry?: string;
    premium?: number;
    delta?: number;
    action?: string;
  };
  timestamp: Date;
}

interface AISuggestionsPanelProps {
  suggestions: TradeSuggestion[];
  positions: Array<{
    id: number;
    underlying: string;
    option_type: string;
    strike: number;
    days_to_expiry?: number;
    premium_collected: number;
    quantity: number;
  }>;
  ccCandidates: Array<{
    symbol: string;
    shares: number;
    lots: number;
  }>;
  portfolioStats: {
    openPositions: number;
    winRate: number;
    realizedPnl: number;
    ccLotsAvailable: number;
  };
  onSuggestionClick?: (suggestion: TradeSuggestion) => void;
  onRemoveSuggestion?: (id: string) => void;
}

function getSuggestionIcon(type: TradeSuggestion['type']) {
  switch (type) {
    case 'covered_call':
      return <TrendingUp className="h-4 w-4" />;
    case 'csp':
      return <Target className="h-4 w-4" />;
    case 'roll':
      return <Wallet className="h-4 w-4" />;
    case 'close':
      return <AlertTriangle className="h-4 w-4" />;
    case 'alert':
      return <AlertTriangle className="h-4 w-4" />;
    case 'insight':
    default:
      return <Lightbulb className="h-4 w-4" />;
  }
}

function getSuggestionColor(type: TradeSuggestion['type']) {
  switch (type) {
    case 'covered_call':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'csp':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'roll':
      return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'close':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'alert':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    case 'insight':
    default:
      return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
  }
}

export function AISuggestionsPanel({
  suggestions,
  positions,
  ccCandidates,
  portfolioStats,
  onSuggestionClick,
  onRemoveSuggestion,
}: AISuggestionsPanelProps) {
  return (
    <div className="h-full flex flex-col bg-card border rounded-lg overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Portfolio Context */}
          <Card className="border-dashed">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Portfolio Context
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Open Positions</span>
                <span className="font-medium">{portfolioStats.openPositions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Win Rate</span>
                <span className="font-medium text-green-500">{portfolioStats.winRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Realized P&L</span>
                <span className={cn('font-medium', portfolioStats.realizedPnl >= 0 ? 'text-green-500' : 'text-red-500')}>
                  ${portfolioStats.realizedPnl.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CC Lots Available</span>
                <span className="font-medium">{portfolioStats.ccLotsAvailable}</span>
              </div>
            </CardContent>
          </Card>

          {/* AI Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                AI Suggestions
              </h3>
              {suggestions.map((suggestion) => (
                <Card
                  key={suggestion.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md border',
                    getSuggestionColor(suggestion.type)
                  )}
                  onClick={() => onSuggestionClick?.(suggestion)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div className="mt-0.5">
                          {getSuggestionIcon(suggestion.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{suggestion.symbol}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {suggestion.type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium mt-0.5">{suggestion.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {suggestion.description}
                          </p>
                          {suggestion.details && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {suggestion.details.strike && (
                                <span className="text-xs bg-background/50 px-1.5 py-0.5 rounded">
                                  ${suggestion.details.strike} strike
                                </span>
                              )}
                              {suggestion.details.expiry && (
                                <span className="text-xs bg-background/50 px-1.5 py-0.5 rounded">
                                  {suggestion.details.expiry}
                                </span>
                              )}
                              {suggestion.details.premium && (
                                <span className="text-xs bg-background/50 px-1.5 py-0.5 rounded">
                                  ${suggestion.details.premium} premium
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0 opacity-50 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveSuggestion?.(suggestion.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Open Positions */}
          {positions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                Open Positions
              </h3>
              {positions.slice(0, 5).map((pos) => (
                <div
                  key={pos.id}
                  className="p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{pos.underlying}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {pos.days_to_expiry || 0}d
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ${pos.strike} {pos.option_type} • ${(pos.premium_collected * pos.quantity * 100).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* CC Candidates */}
          {ccCandidates.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                CC Candidates
              </h3>
              {ccCandidates.slice(0, 5).map((stock) => (
                <div
                  key={stock.symbol}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <div>
                    <p className="font-semibold text-sm">{stock.symbol}</p>
                    <p className="text-xs text-muted-foreground">{stock.shares} shares</p>
                  </div>
                  <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30 text-xs">
                    {stock.lots} lot{stock.lots > 1 ? 's' : ''}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
