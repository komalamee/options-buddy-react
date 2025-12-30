'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MetricsRow } from '@/components/dashboard/metrics-row';
import { AlertsTicker } from '@/components/dashboard/alerts-ticker';
import { AISuggestionsPanel, TradeSuggestion } from '@/components/dashboard/ai-suggestions-panel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send,
  Sparkles,
  User,
  Bot,
  RefreshCw,
  Settings,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { usePortfolioStore } from '@/stores/portfolio-store';
import Link from 'next/link';

// ==================== Types ====================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ==================== Quick Prompts ====================

const quickPrompts = [
  'What positions need attention?',
  'Find covered call opportunities',
  'Analyze my portfolio risk',
  'What should I trade this week?',
];

// ==================== Helper: Extract suggestions from AI response ====================

function extractSuggestionsFromResponse(content: string, existingSuggestions: TradeSuggestion[]): TradeSuggestion[] {
  const suggestions: TradeSuggestion[] = [];

  // Look for stock symbols mentioned with trade suggestions
  const stockMatches = content.match(/\b(TSLA|AAPL|MSFT|NVDA|AMD|GOOGL|AMZN|META|SPY|QQQ|[A-Z]{2,5})\b/g);

  // If we find a covered call suggestion pattern
  if (content.toLowerCase().includes('covered call') || content.toLowerCase().includes(' cc ')) {
    const uniqueSymbols = [...new Set(stockMatches || [])].slice(0, 3);

    uniqueSymbols.forEach((symbol) => {
      const strikeMatch = content.match(new RegExp(`${symbol}[^.]*?\\$(\\d+(?:\\.\\d+)?)`));
      const strike = strikeMatch ? parseFloat(strikeMatch[1]) : undefined;
      const premiumMatch = content.match(/\$([\d.]+)\s*(?:premium|per share|credit)/i);
      const premium = premiumMatch ? parseFloat(premiumMatch[1]) : undefined;

      if (!existingSuggestions.some(s => s.symbol === symbol && s.type === 'covered_call')) {
        suggestions.push({
          id: `cc-${symbol}-${Date.now()}`,
          type: 'covered_call',
          symbol,
          title: `Sell ${symbol} Covered Call`,
          description: strike ? `Consider selling a $${strike} strike covered call` : `Covered call opportunity identified`,
          details: { strike, premium },
          timestamp: new Date(),
        });
      }
    });
  }

  // Look for CSP suggestions
  if (content.toLowerCase().includes('cash-secured put') || content.toLowerCase().includes('csp') || content.toLowerCase().includes('sell put')) {
    const uniqueSymbols = [...new Set(stockMatches || [])].slice(0, 2);

    uniqueSymbols.forEach((symbol) => {
      const strikeMatch = content.match(new RegExp(`${symbol}[^.]*?\\$(\\d+(?:\\.\\d+)?)`));
      const strike = strikeMatch ? parseFloat(strikeMatch[1]) : undefined;

      if (!existingSuggestions.some(s => s.symbol === symbol && s.type === 'csp')) {
        suggestions.push({
          id: `csp-${symbol}-${Date.now()}`,
          type: 'csp',
          symbol,
          title: `Sell ${symbol} Put`,
          description: strike ? `Consider selling a $${strike} strike cash-secured put` : `CSP opportunity identified`,
          details: { strike },
          timestamp: new Date(),
        });
      }
    });
  }

  // Look for roll suggestions
  if (content.toLowerCase().includes('roll') && (content.toLowerCase().includes('position') || content.toLowerCase().includes('option'))) {
    const uniqueSymbols = [...new Set(stockMatches || [])].slice(0, 2);

    uniqueSymbols.forEach((symbol) => {
      if (!existingSuggestions.some(s => s.symbol === symbol && s.type === 'roll')) {
        suggestions.push({
          id: `roll-${symbol}-${Date.now()}`,
          type: 'roll',
          symbol,
          title: `Roll ${symbol} Position`,
          description: `Consider rolling your ${symbol} position`,
          timestamp: new Date(),
        });
      }
    });
  }

  return suggestions;
}

// ==================== Main Component ====================

export default function DashboardPage() {
  // AI Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [aiProvider, setAiProvider] = useState<string>('');
  const [suggestions, setSuggestions] = useState<TradeSuggestion[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Portfolio Store
  const {
    positions,
    stockHoldings,
    summary,
    alerts,
    fetchPositions,
    fetchHoldings,
    fetchSummary,
  } = usePortfolioStore();

  // CC Candidates - stocks with 100+ shares
  const ccCandidates = stockHoldings
    .filter((h) => h.quantity >= 100)
    .map((h) => ({
      symbol: h.symbol,
      shares: h.quantity,
      lots: Math.floor(h.quantity / 100),
    }));

  // Transform alerts
  const formattedAlerts = alerts.map((a) => ({
    id: a.id,
    type: a.type,
    title: a.title,
    message: a.message,
  }));

  // Load data on mount
  useEffect(() => {
    fetchPositions();
    fetchHoldings();
    fetchSummary();
  }, [fetchPositions, fetchHoldings, fetchSummary]);

  // Check AI settings on mount
  useEffect(() => {
    const checkAISettings = async () => {
      try {
        const settings = await api.getAISettings();
        setAiConfigured(settings.api_key_set);
        setAiProvider(settings.provider);

        if (settings.api_key_set) {
          const providerName = settings.provider === 'google' ? 'Gemini' : settings.provider === 'anthropic' ? 'Claude' : 'GPT-4';
          const welcomeMsg: Message = {
            id: 'welcome',
            role: 'assistant',
            content: `Welcome! I'm your AI options advisor powered by ${providerName}.

I can help with:
- **Position management** and roll strategies
- **Trade ideas** based on your holdings
- **Risk analysis** and portfolio review

What would you like to explore?`,
            timestamp: new Date(),
          };
          setMessages([welcomeMsg]);
        }
      } catch (err) {
        console.error('Failed to check AI settings:', err);
        setAiConfigured(false);
      }
    };
    checkAISettings();
  }, []);

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Send message to AI
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await api.sendChatMessage(apiMessages);

      const aiResponse: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiResponse]);

      // Extract suggestions from AI response
      const newSuggestions = extractSuggestionsFromResponse(result.response, suggestions);
      if (newSuggestions.length > 0) {
        setSuggestions((prev) => [...newSuggestions, ...prev].slice(0, 10));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get response';
      const errorResponse: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  const handleCopyMessage = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSuggestionClick = (suggestion: TradeSuggestion) => {
    const prompt = `Tell me more about the ${suggestion.type.replace('_', ' ')} opportunity for ${suggestion.symbol}${suggestion.details?.strike ? ` at the $${suggestion.details.strike} strike` : ''}.`;
    setInput(prompt);
  };

  const handleRemoveSuggestion = (id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Alerts Ticker Banner */}
      <div className="-mx-6 -mt-6 mb-6">
        <AlertsTicker alerts={formattedAlerts} />
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Portfolio overview and AI-powered insights
        </p>
      </div>

      {/* Metrics Row - Keep at top */}
      <MetricsRow
        totalValue={summary.totalValue}
        realizedPnl={summary.realizedPnl}
        openPositions={summary.openPositions}
        openPremium={summary.openPremium}
        winRate={summary.winRate}
        totalTrades={summary.totalTrades}
      />

      {/* AI Setup Prompt */}
      {aiConfigured === false && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="font-medium">AI Advisor Not Configured</p>
                  <p className="text-sm text-muted-foreground">
                    Set up your AI provider to get personalized trade ideas
                  </p>
                </div>
              </div>
              <Link href="/settings">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content - 50/50 Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - AI Chat (50% width) */}
        <Card className="flex flex-col h-[500px]">
          <CardHeader className="pb-3 border-b shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">AI Advisor</CardTitle>
                  <CardDescription className="text-xs">
                    {aiConfigured ? `Powered by ${aiProvider === 'google' ? 'Gemini' : aiProvider === 'anthropic' ? 'Claude' : 'GPT-4'}` : 'Not configured'}
                  </CardDescription>
                </div>
              </div>
              {aiConfigured && (
                <Badge variant="outline" className="bg-green-500/10 text-green-500 text-xs">
                  Active
                </Badge>
              )}
            </div>
          </CardHeader>

          {/* Messages Area - Scrollable */}
          <ScrollArea className="flex-1 overflow-hidden">
            <div className="p-4 space-y-3">
              {aiConfigured === null ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-2 group',
                      message.role === 'user' && 'flex-row-reverse'
                    )}
                  >
                    <div
                      className={cn(
                        'h-6 w-6 rounded-full flex items-center justify-center shrink-0',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      {message.role === 'user' ? (
                        <User className="h-3 w-3" />
                      ) : (
                        <Bot className="h-3 w-3" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div
                        className={cn(
                          'rounded-lg px-3 py-2 text-sm overflow-hidden',
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}
                      >
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none break-words overflow-wrap-anywhere [&>*]:my-1 [&_*]:break-words [&_*]:overflow-wrap-anywhere"
                          style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                          dangerouslySetInnerHTML={{
                            __html: message.content
                              .replace(/\n/g, '<br>')
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/\*(.*?)\*/g, '<em>$1</em>')
                              .replace(/###\s*(.*?)(?:<br>|$)/g, '<h4 class="font-semibold mt-2 mb-1 text-sm">$1</h4>')
                              .replace(/-\s*(.*?)(?:<br>|$)/g, '<li class="ml-3 text-sm">$1</li>'),
                          }}
                        />
                      </div>
                      {message.role === 'assistant' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleCopyMessage(message.content, message.id)}
                        >
                          {copiedId === message.id ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex gap-2">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                    <Bot className="h-3 w-3" />
                  </div>
                  <div className="rounded-lg px-3 py-2 bg-muted">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area - Fixed at Bottom */}
          <div className="border-t p-3 shrink-0">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {quickPrompts.slice(0, 2).map((prompt, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickPrompt(prompt)}
                  className="text-xs h-7"
                  disabled={isLoading || !aiConfigured}
                >
                  {prompt}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={aiConfigured ? "Ask about trades..." : "Configure AI first"}
                disabled={isLoading || !aiConfigured}
                className="text-sm h-9"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim() || !aiConfigured}
                size="icon"
                className="h-9 w-9"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Right Column - Suggestions & Context (50% width) */}
        <div className="h-[500px]">
          <AISuggestionsPanel
            suggestions={suggestions}
            positions={positions}
            ccCandidates={ccCandidates}
            portfolioStats={{
              openPositions: summary.openPositions,
              winRate: summary.winRate,
              realizedPnl: summary.realizedPnl,
              ccLotsAvailable: summary.ccLotsAvailable,
            }}
            onSuggestionClick={handleSuggestionClick}
            onRemoveSuggestion={handleRemoveSuggestion}
          />
        </div>
      </div>
    </div>
  );
}
