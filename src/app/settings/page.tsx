'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  XCircle,
  RefreshCw,
  Save,
  TestTube,
  Wifi,
  WifiOff,
  Key,
  Database,
  Bell,
  Palette,
  CheckCircle2,
  Upload,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortfolioStore } from '@/stores/portfolio-store';
import { api } from '@/lib/api';
import { useTheme } from 'next-themes';

// AI Provider and Model Configuration
const AI_PROVIDERS = {
  anthropic: {
    name: 'Anthropic',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', tag: 'Recommended', description: 'Best balance of speed and intelligence' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', tag: 'Best for Deep Analysis', description: 'Most capable for complex reasoning' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', tag: 'Fastest', description: 'Quick responses, lower cost' },
    ],
  },
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', tag: 'Recommended', description: 'Latest multimodal model' },
      { id: 'o1-preview', name: 'o1-preview', tag: 'Best for Deep Analysis', description: 'Advanced reasoning for complex math' },
      { id: 'o1-mini', name: 'o1-mini', tag: 'Best Value', description: 'Fast reasoning at lower cost' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', tag: '', description: '128K context window' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', tag: 'Cheapest', description: 'Budget-friendly option' },
    ],
  },
  google: {
    name: 'Google',
    models: [
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', tag: 'Recommended', description: 'Latest and fastest Gemini' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', tag: 'Best for Deep Analysis', description: '1M token context, complex reasoning' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', tag: 'Best Value', description: 'Fast and cost-effective' },
      { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B', tag: 'Cheapest', description: 'Most affordable option' },
    ],
  },
  xai: {
    name: 'xAI',
    models: [
      { id: 'grok-2', name: 'Grok-2', tag: 'Recommended', description: 'Latest Grok model with real-time data' },
      { id: 'grok-2-mini', name: 'Grok-2 Mini', tag: 'Cheapest', description: 'Faster, lighter version' },
    ],
  },
  perplexity: {
    name: 'Perplexity',
    models: [
      { id: 'llama-3.1-sonar-large-128k-online', name: 'Sonar Large Online', tag: 'Recommended', description: 'Best for research with live web search' },
      { id: 'llama-3.1-sonar-small-128k-online', name: 'Sonar Small Online', tag: 'Cheapest', description: 'Faster searches at lower cost' },
      { id: 'llama-3.1-sonar-huge-128k-online', name: 'Sonar Huge Online', tag: 'Best for Deep Analysis', description: 'Most capable with web search' },
    ],
  },
} as const;

type AIProviderKey = keyof typeof AI_PROVIDERS;

export default function SettingsPage() {
  const {
    ibkrStatus,
    connectIBKR,
    disconnectIBKR,
    syncWithIBKR,
    isLoading,
    isSyncing,
    error,
  } = usePortfolioStore();

  const { theme, setTheme } = useTheme();

  const [ibkrHost, setIbkrHost] = useState(ibkrStatus.host || '127.0.0.1');
  const [ibkrPort, setIbkrPort] = useState(String(ibkrStatus.port || 4001));
  const [selectedAccount, setSelectedAccount] = useState('');
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [aiProvider, setAiProvider] = useState<AIProviderKey>('google');
  const [aiModel, setAiModel] = useState('gemini-2.0-flash-exp');
  const [apiKey, setApiKey] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiKeySet, setAiKeySet] = useState(false);

  // Notification settings
  const [expiringAlerts, setExpiringAlerts] = useState(true);
  const [pnlAlerts, setPnlAlerts] = useState(true);
  const [marketReminder, setMarketReminder] = useState(false);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);

  // CSV Import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
    message: string;
  } | null>(null);

  // Load AI settings on mount
  useEffect(() => {
    const loadAISettings = async () => {
      try {
        const settings = await api.getAISettings();
        const provider = settings.provider as AIProviderKey;
        setAiProvider(provider);
        setAiKeySet(settings.api_key_set);
        // Set model from settings or default to first model of provider
        if (settings.model) {
          setAiModel(settings.model);
        } else {
          const defaultModel = AI_PROVIDERS[provider]?.models[0]?.id || 'gemini-2.0-flash-exp';
          setAiModel(defaultModel);
        }
      } catch (err) {
        console.error('Failed to load AI settings:', err);
      }
    };
    loadAISettings();
  }, []);

  // Load notification settings on mount
  useEffect(() => {
    const loadNotificationSettings = async () => {
      try {
        const [expiring, pnl, market] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/settings/alert_expiring`).then(r => r.json()),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/settings/alert_pnl`).then(r => r.json()),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/settings/alert_market_reminder`).then(r => r.json()),
        ]);
        setExpiringAlerts(expiring.value !== 'false');
        setPnlAlerts(pnl.value !== 'false');
        setMarketReminder(market.value === 'true');
        setNotificationsLoaded(true);
      } catch (err) {
        console.error('Failed to load notification settings:', err);
        setNotificationsLoaded(true);
      }
    };
    loadNotificationSettings();
  }, []);

  // Load selected account on mount
  useEffect(() => {
    const loadSelectedAccount = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/settings/selected_ibkr_account`);
        const data = await response.json();
        if (data.value) {
          setSelectedAccount(data.value);
        }
        setAccountLoaded(true);
      } catch (err) {
        console.error('Failed to load selected account:', err);
        setAccountLoaded(true);
      }
    };
    loadSelectedAccount();
  }, []);

  // Save notification setting
  const saveNotificationSetting = async (key: string, value: boolean) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: String(value) }),
      });
    } catch (err) {
      console.error(`Failed to save ${key}:`, err);
    }
  };

  // Save selected IBKR account
  const handleAccountChange = async (account: string) => {
    setSelectedAccount(account);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'selected_ibkr_account', value: account }),
      });
    } catch (err) {
      console.error('Failed to save selected account:', err);
    }
  };

  // Handle provider change - update model to default for new provider
  const handleProviderChange = (newProvider: AIProviderKey) => {
    setAiProvider(newProvider);
    // Set to first (recommended) model for the new provider
    const defaultModel = AI_PROVIDERS[newProvider].models[0].id;
    setAiModel(defaultModel);
  };

  const handleSaveAISettings = async () => {
    if (!apiKey.trim()) {
      setSyncMessage('Please enter an API key');
      setTimeout(() => setSyncMessage(''), 3000);
      return;
    }

    setAiSaving(true);
    try {
      await api.saveAISettings(aiProvider, apiKey, aiModel);
      setAiKeySet(true);
      setApiKey(''); // Clear the input after saving
      setSyncMessage('AI settings saved successfully!');
      setTimeout(() => setSyncMessage(''), 3000);
    } catch (err) {
      setSyncMessage(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setSyncMessage(''), 5000);
    } finally {
      setAiSaving(false);
    }
  };

  const handleTestAIConnection = async () => {
    setAiTesting(true);
    try {
      const result = await api.testAIConnection();
      setSyncMessage(result.message);
      setTimeout(() => setSyncMessage(''), 3000);
    } catch (err) {
      setSyncMessage(`Test failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setSyncMessage(''), 5000);
    } finally {
      setAiTesting(false);
    }
  };

  const handleConnect = async () => {
    const success = await connectIBKR(ibkrHost, parseInt(ibkrPort, 10));
    if (success) {
      setSyncMessage('Connected successfully!');
      setTimeout(() => setSyncMessage(''), 3000);
    }
  };

  const handleDisconnect = async () => {
    await disconnectIBKR();
    setSyncMessage('Disconnected');
    setTimeout(() => setSyncMessage(''), 3000);
  };

  const handleSync = async () => {
    const success = await syncWithIBKR(selectedAccount || undefined);
    if (success) {
      setSyncMessage('Positions synced successfully!');
      setTimeout(() => setSyncMessage(''), 3000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      setImportResult(null);
    }
  };

  const handleImportCSV = async () => {
    if (!csvFile) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await api.importIBKRTrades(csvFile);
      setImportResult(result);
      if (result.success && result.imported > 0) {
        setSyncMessage(`Successfully imported ${result.imported} historical trades!`);
        setTimeout(() => setSyncMessage(''), 5000);
      }
    } catch (err) {
      setImportResult({
        success: false,
        imported: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
        message: 'Import failed',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your trading connections and preferences
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {syncMessage && (
        <div className="bg-green-500/10 border border-green-500/50 text-green-500 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {syncMessage}
        </div>
      )}

      <Tabs defaultValue="ibkr" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ibkr" className="gap-2">
            <Database className="h-4 w-4" />
            IBKR Connection
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Key className="h-4 w-4" />
            AI Settings
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Data Import
          </TabsTrigger>
        </TabsList>

        {/* IBKR Tab */}
        <TabsContent value="ibkr" className="space-y-6">
          {/* Connection Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Connection Status</CardTitle>
                  <CardDescription>Interactive Brokers TWS/Gateway connection</CardDescription>
                </div>
                <Badge
                  variant={ibkrStatus.connected ? 'default' : 'destructive'}
                  className={cn(
                    'gap-1',
                    ibkrStatus.connected && 'bg-green-500 hover:bg-green-600'
                  )}
                >
                  {ibkrStatus.connected ? (
                    <>
                      <Wifi className="h-3 w-3" />
                      Connected
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3" />
                      Disconnected
                    </>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    value={ibkrHost}
                    onChange={(e) => setIbkrHost(e.target.value)}
                    placeholder="127.0.0.1"
                    disabled={ibkrStatus.connected}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    value={ibkrPort}
                    onChange={(e) => setIbkrPort(e.target.value)}
                    placeholder="4001 (Gateway) or 7497 (TWS)"
                    disabled={ibkrStatus.connected}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                {ibkrStatus.connected ? (
                  <>
                    <Button variant="outline" onClick={handleDisconnect}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                    <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
                      {isSyncing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sync Positions
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleConnect} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Wifi className="h-4 w-4 mr-2" />
                        Connect to IBKR
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Account Selection */}
          {ibkrStatus.connected && ibkrStatus.accounts && ibkrStatus.accounts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Account Selection</CardTitle>
                <CardDescription>Select which account to use for syncing positions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select value={selectedAccount} onValueChange={handleAccountChange} disabled={!accountLoaded}>
                    <SelectTrigger>
                      <SelectValue placeholder={`Default: ${ibkrStatus.accounts[0]}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {ibkrStatus.accounts.map((account, idx) => (
                        <SelectItem key={account} value={account}>
                          {account}{idx === 0 ? ' (default)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {selectedAccount
                      ? `Using: ${selectedAccount}`
                      : `No account selected - will use default: ${ibkrStatus.accounts[0]}`
                    }
                  </p>
                </div>
                {ibkrStatus.lastSync && (
                  <p className="text-sm text-muted-foreground">
                    Last synced: {new Date(ibkrStatus.lastSync).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Connection Tips */}
          <Card>
            <CardHeader>
              <CardTitle>Connection Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>1. Make sure TWS or IB Gateway is running</p>
              <p>2. Enable API connections in TWS: File - Global Configuration - API - Settings</p>
              <p>3. Check "Enable ActiveX and Socket Clients"</p>
              <p>4. Use port 4001 for Gateway or 7497 for TWS (paper: 4002/7496)</p>
              <p>5. Add 127.0.0.1 to trusted IP addresses if needed</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Tab */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Provider & Model</CardTitle>
              <CardDescription>
                Configure your AI assistant for options analysis. Deep thinking models are recommended for complex mathematical calculations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={aiProvider} onValueChange={(v) => handleProviderChange(v as AIProviderKey)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AI_PROVIDERS).map(([key, provider]) => (
                      <SelectItem key={key} value={key}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={aiModel} onValueChange={setAiModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_PROVIDERS[aiProvider].models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center gap-2">
                          <span>{model.name}</span>
                          {model.tag && (
                            <Badge
                              variant={model.tag === 'Recommended' ? 'default' : model.tag === 'Best for Deep Analysis' ? 'secondary' : 'outline'}
                              className={cn(
                                'text-xs',
                                model.tag === 'Recommended' && 'bg-green-500 hover:bg-green-600',
                                model.tag === 'Best for Deep Analysis' && 'bg-blue-500 hover:bg-blue-600 text-white',
                                model.tag === 'Cheapest' && 'bg-orange-500/20 text-orange-600 border-orange-500/50'
                              )}
                            >
                              {model.tag}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Model description */}
                <p className="text-xs text-muted-foreground">
                  {AI_PROVIDERS[aiProvider].models.find(m => m.id === aiModel)?.description || ''}
                </p>
              </div>

              <Separator />

              {/* API Key */}
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key for {AI_PROVIDERS[aiProvider].name}</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={aiKeySet ? "API key is saved (enter new key to update)" : "Enter your API key..."}
                />
                {aiKeySet && (
                  <p className="text-sm text-green-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    API key configured for {AI_PROVIDERS[aiProvider].name}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleTestAIConnection}
                  disabled={aiTesting || !aiKeySet}
                >
                  {aiTesting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>
                <Button onClick={handleSaveAISettings} disabled={aiSaving}>
                  {aiSaving ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Model Recommendations Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Model Recommendations for Options Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Badge className="bg-blue-500 hover:bg-blue-600 text-white shrink-0">Best for Deep Analysis</Badge>
                <p className="text-muted-foreground">
                  Use Claude 3 Opus, o1-preview, or Gemini 1.5 Pro for complex options strategies, Greeks calculations, and multi-leg analysis.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="bg-green-500 hover:bg-green-600 shrink-0">Recommended</Badge>
                <p className="text-muted-foreground">
                  Claude 3.5 Sonnet, GPT-4o, or Gemini 2.0 Flash offer the best balance of speed and accuracy for most tasks.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="bg-orange-500/20 text-orange-600 border-orange-500/50 shrink-0">Cheapest</Badge>
                <p className="text-muted-foreground">
                  GPT-3.5 Turbo, Claude Haiku, or Gemini Flash-8B for quick lookups and simple queries where cost matters.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Alert Preferences</CardTitle>
              <CardDescription>Configure when you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Expiring Positions</p>
                  <p className="text-sm text-muted-foreground">
                    Alert when positions are expiring within 7 days
                  </p>
                </div>
                <Switch
                  checked={expiringAlerts}
                  onCheckedChange={(checked) => {
                    setExpiringAlerts(checked);
                    saveNotificationSetting('alert_expiring', checked);
                  }}
                  disabled={!notificationsLoaded}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">P&L Milestones</p>
                  <p className="text-sm text-muted-foreground">
                    Alert when positions hit profit/loss targets
                  </p>
                </div>
                <Switch
                  checked={pnlAlerts}
                  onCheckedChange={(checked) => {
                    setPnlAlerts(checked);
                    saveNotificationSetting('alert_pnl', checked);
                  }}
                  disabled={!notificationsLoaded}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Market Hours Reminder</p>
                  <p className="text-sm text-muted-foreground">
                    Daily reminder at market open
                  </p>
                </div>
                <Switch
                  checked={marketReminder}
                  onCheckedChange={(checked) => {
                    setMarketReminder(checked);
                    saveNotificationSetting('alert_market_reminder', checked);
                  }}
                  disabled={!notificationsLoaded}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Customize the look of your dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Color Theme</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Import Tab */}
        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import IBKR Activity Statement</CardTitle>
              <CardDescription>
                Import historical options trades from an IBKR Activity Statement CSV file to track your performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Instructions */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <p className="font-medium">How to export from IBKR:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Log in to Client Portal or Account Management</li>
                  <li>Go to Reports → Statements → Activity</li>
                  <li>Select date range covering your trades</li>
                  <li>Choose CSV format and download</li>
                </ol>
              </div>

              {/* File Upload */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="cursor-pointer"
                    />
                  </div>
                  <Button
                    onClick={handleImportCSV}
                    disabled={!csvFile || isImporting}
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Import Trades
                      </>
                    )}
                  </Button>
                </div>
                {csvFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {/* Import Results */}
              {importResult && (
                <div className={cn(
                  "rounded-lg p-4 space-y-2",
                  importResult.success
                    ? "bg-green-500/10 border border-green-500/50"
                    : "bg-red-500/10 border border-red-500/50"
                )}>
                  <div className="flex items-center gap-2">
                    {importResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className={cn(
                      "font-medium",
                      importResult.success ? "text-green-500" : "text-red-500"
                    )}>
                      {importResult.message}
                    </span>
                  </div>

                  {importResult.success && (
                    <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Trades Imported:</span>
                        <span className="ml-2 font-medium text-green-500">{importResult.imported}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Skipped (still open):</span>
                        <span className="ml-2 font-medium">{importResult.skipped}</span>
                      </div>
                    </div>
                  )}

                  {importResult.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-red-500 mb-1">Errors:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {importResult.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                        {importResult.errors.length > 5 && (
                          <li>...and {importResult.errors.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Supported Formats Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Supported Import Formats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <p><span className="font-medium text-foreground">IBKR Activity Statement (CSV)</span> — Contains trade details including opens, closes, and expirations</p>
              </div>
              <p className="pl-6">
                The importer automatically matches opening trades with their closing trades or expirations to create complete position records.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
