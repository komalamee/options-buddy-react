'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send,
  Sparkles,
  User,
  Bot,
  RefreshCw,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { usePortfolioStore } from '@/stores/portfolio-store';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const quickPrompts = [
  'What positions need attention?',
  'Find covered call opportunities',
  'Analyze my portfolio risk',
  'What should I trade this week?',
  'Roll strategy for my positions',
  'Best CSP opportunities right now',
];

export default function AdvisorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { positions, stockHoldings, summary } = usePortfolioStore();

  // Check if AI is configured on mount
  useEffect(() => {
    const checkAISettings = async () => {
      try {
        const settings = await api.getAISettings();
        setAiConfigured(settings.api_key_set);

        // Add welcome message if configured
        if (settings.api_key_set) {
          const welcomeMsg: Message = {
            role: 'assistant',
            content: `Welcome! I'm your AI options advisor powered by ${settings.provider === 'google' ? 'Gemini' : settings.provider === 'anthropic' ? 'Claude' : 'GPT-4'}.

I can see your portfolio and help with:
- **Position management** and roll strategies
- **Trade ideas** based on your holdings
- **Risk analysis** and portfolio review
- **Market context** and IV environment

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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      // Build messages array for API (excluding timestamps)
      const apiMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await api.sendChatMessage(apiMessages);

      const aiResponse: Message = {
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiResponse]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get response';
      setError(errorMessage);

      // Add error as a system message
      const errorResponse: Message = {
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

  // Show setup prompt if AI not configured
  if (aiConfigured === false) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Advisor</h1>
          <p className="text-muted-foreground">
            Your intelligent options trading assistant
          </p>
        </div>

        <Card className="max-w-xl mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Set Up AI Advisor</CardTitle>
            <CardDescription>
              Configure your AI provider to get personalized options trading advice
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              The AI Advisor uses your portfolio data to provide contextual recommendations
              for position management, trade ideas, and risk analysis.
            </p>
            <Link href="/settings">
              <Button className="w-full" size="lg">
                <Settings className="h-4 w-4 mr-2" />
                Configure AI Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state while checking
  if (aiConfigured === null) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Advisor</h1>
        <p className="text-muted-foreground">
          Your intelligent options trading assistant
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chat Area */}
        <div className="lg:col-span-2">
          <Card className="h-[calc(100vh-220px)] flex flex-col">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Market Advisor</CardTitle>
                  <CardDescription>AI-powered trading assistant</CardDescription>
                </div>
              </div>
            </CardHeader>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((message, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex gap-3',
                      message.role === 'user' && 'flex-row-reverse'
                    )}
                  >
                    <div
                      className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      {message.role === 'user' ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      className={cn(
                        'rounded-lg px-4 py-3 max-w-[80%]',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: message.content
                            .replace(/\n/g, '<br>')
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>'),
                        }}
                      />
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-lg px-4 py-3 bg-muted">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t">
              {/* Quick prompts */}
              <div className="flex flex-wrap gap-2 mb-3">
                {quickPrompts.slice(0, 4).map((prompt, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickPrompt(prompt)}
                    className="text-xs"
                    disabled={isLoading}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about trades, positions, or market analysis..."
                  disabled={isLoading}
                />
                <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
                  {isLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Portfolio Context Sidebar */}
        <div className="space-y-6">
          {/* Current Positions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Open Positions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {positions.length > 0 ? (
                positions.slice(0, 3).map((pos) => (
                  <div key={pos.id} className="p-3 rounded-lg bg-muted">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{pos.underlying}</span>
                      <Badge variant="outline">{pos.days_to_expiry || 0}d</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      ${pos.strike} {pos.option_type} • ${pos.premium_collected.toLocaleString()} premium
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No open positions
                </p>
              )}
            </CardContent>
          </Card>

          {/* Holdings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Stock Holdings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stockHoldings.length > 0 ? (
                stockHoldings.slice(0, 4).map((holding) => (
                  <div
                    key={holding.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <span className="font-medium">{holding.symbol}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        {holding.quantity} shares
                      </span>
                    </div>
                    {holding.quantity >= 100 && (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        {Math.floor(holding.quantity / 100)} lot{Math.floor(holding.quantity / 100) > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No stock holdings
                </p>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Portfolio Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Open Positions</span>
                <span className="font-medium">{summary.openPositions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Win Rate</span>
                <span className="font-medium text-green-500">{summary.winRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CC Lots Available</span>
                <span className="font-medium">{summary.ccLotsAvailable}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
