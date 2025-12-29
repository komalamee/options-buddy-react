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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Send,
  Sparkles,
  User,
  Bot,
  RefreshCw,
  Wallet,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const initialMessages: Message[] = [
  {
    role: 'assistant',
    content: `Welcome! I'm your AI options advisor. I can see you have:

• **1 open position** (TSLA $500 CALL)
• **4 stock holdings** (TSLA, NVDA, COIN, MSTR)
• **1 covered call lot** available

How can I help you today? You can ask me about:
- Position management and roll strategies
- Finding new trade opportunities
- Portfolio risk analysis
- Market conditions and outlook`,
    timestamp: new Date(),
  },
];

// Portfolio context for the sidebar
const portfolioContext = {
  positions: [
    { symbol: 'TSLA', type: 'CALL', strike: 500, dte: 81, premium: 4638 },
  ],
  holdings: [
    { symbol: 'TSLA', shares: 158, lots: 1 },
    { symbol: 'NVDA', shares: 44, lots: 0 },
    { symbol: 'COIN', shares: 30, lots: 0 },
    { symbol: 'MSTR', shares: 21, lots: 0 },
  ],
  alerts: [] as any[],
};

const quickPrompts = [
  'What positions need attention?',
  'Find covered call opportunities',
  'Analyze my portfolio risk',
  'What should I trade this week?',
  'Roll strategy for TSLA position',
  'Best CSP opportunities right now',
];

export default function AdvisorPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

    // Simulate AI response
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const aiResponse: Message = {
      role: 'assistant',
      content: generateResponse(input),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, aiResponse]);
    setIsLoading(false);
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

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
                  <CardDescription>Powered by Claude</CardDescription>
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
                          __html: message.content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
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
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Portfolio Context Sidebar */}
        <div className="space-y-6">
          {/* Current Position */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Open Positions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {portfolioContext.positions.map((pos, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-muted">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{pos.symbol}</span>
                    <Badge variant="outline">{pos.dte}d</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ${pos.strike} {pos.type} • ${pos.premium.toLocaleString()} premium
                  </p>
                </div>
              ))}
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
              {portfolioContext.holdings.map((holding, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <span className="font-medium">{holding.symbol}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {holding.shares} shares
                    </span>
                  </div>
                  {holding.lots > 0 && (
                    <Badge className="bg-green-500 hover:bg-green-600">
                      {holding.lots} lot
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {portfolioContext.alerts.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-green-500 font-medium">All clear!</p>
                  <p className="text-xs text-muted-foreground">No urgent alerts</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {portfolioContext.alerts.map((alert, idx) => (
                    <div key={idx} className="p-2 rounded bg-red-500/10 text-red-500 text-sm">
                      {alert.message}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Simple response generator - will be replaced with real AI
function generateResponse(input: string): string {
  const lowerInput = input.toLowerCase();

  if (lowerInput.includes('attention') || lowerInput.includes('expiring')) {
    return `Based on your current positions:

**Your TSLA $500 CALL has 81 days to expiration** - no immediate action needed.

With over 2 months until expiry, you have flexibility. Consider:
- **If bullish**: Hold and let theta work
- **If neutral**: Roll to a lower strike
- **If bearish**: Close for the current premium

Would you like me to analyze roll opportunities?`;
  }

  if (lowerInput.includes('covered call') || lowerInput.includes('cc')) {
    return `**Covered Call Opportunities:**

You have **158 TSLA shares (1 lot available)**.

With TSLA at ~$421, consider these strikes for Jan 17 expiry:
- **$450 strike**: ~$5.20 premium (7% OTM, 85% keep probability)
- **$430 strike**: ~$8.50 premium (2% OTM, 72% keep probability)

Higher strike = keep more upside but less premium.
Lower strike = more premium but may get called away.

Which risk/reward profile interests you?`;
  }

  if (lowerInput.includes('risk') || lowerInput.includes('portfolio')) {
    return `**Portfolio Risk Analysis:**

Your current exposure:
- **TSLA**: Heavy concentration ($66,820 stock + $4,638 options)
- **Tech sector**: 100% allocation
- **Diversification**: Limited (4 holdings)

**Risk factors:**
⚠️ High correlation between positions (all tech/growth)
⚠️ Single sector exposure
✓ Long DTE on option position (81 days)

**Suggestions:**
1. Consider sector diversification (add SPY or non-tech)
2. Use covered calls on TSLA to reduce delta exposure
3. Keep cash reserve for CSP opportunities

Want me to detail specific hedge strategies?`;
  }

  if (lowerInput.includes('trade') || lowerInput.includes('week')) {
    return `**This Week's Top Opportunities:**

Based on elevated IV and your holdings:

1. **TSLA Covered Call** (You own 158 shares)
   - Jan $450 Call @ $5.20 premium
   - Score: 85/100

2. **NVDA Cash Secured Put**
   - Jan $125 Put @ $2.80 premium
   - Score: 78/100 (requires $12,500 collateral)

3. **AMD Bull Put Spread**
   - Sell $130 / Buy $125 @ $1.80 credit
   - Score: 72/100 (max risk $320)

The market is showing moderate IV (VIX ~14), favoring premium selling strategies.

Want details on any of these?`;
  }

  return `I can help you with:

• **Position Management**: Ask about your current positions, roll strategies, or exit timing
• **Trade Ideas**: Finding CSPs, covered calls, or spread opportunities
• **Risk Analysis**: Portfolio exposure, Greeks, correlation analysis
• **Market Context**: IV environment, sector trends, earnings calendar

What would you like to explore?`;
}
