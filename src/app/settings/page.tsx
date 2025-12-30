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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortfolioStore } from '@/stores/portfolio-store';
import { api } from '@/lib/api';

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

  const [ibkrHost, setIbkrHost] = useState(ibkrStatus.host || '127.0.0.1');
  const [ibkrPort, setIbkrPort] = useState(String(ibkrStatus.port || 4001));
  const [selectedAccount, setSelectedAccount] = useState('');
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [aiProvider, setAiProvider] = useState('google');
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

  // Load AI settings on mount
  useEffect(() => {
    const loadAISettings = async () => {
      try {
        const settings = await api.getAISettings();
        setAiProvider(settings.provider);
        setAiKeySet(settings.api_key_set);
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

  const handleSaveAISettings = async () => {
    if (!apiKey.trim()) {
      setSyncMessage('Please enter an API key');
      setTimeout(() => setSyncMessage(''), 3000);
      return;
    }

    setAiSaving(true);
    try {
      await api.saveAISettings(aiProvider, apiKey);
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
              <CardTitle>AI Provider</CardTitle>
              <CardDescription>Configure your AI assistant for market analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={aiProvider} onValueChange={setAiProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                    <SelectItem value="google">Google (Gemini)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
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
                    API key configured for {aiProvider}
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
                <Select defaultValue="dark">
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
      </Tabs>
    </div>
  );
}
