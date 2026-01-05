'use client';

import { useState } from 'react';
import { AlertCircle, Search } from 'lucide-react';
import { api } from '@/lib/api';
import MarketStatusBanner from '@/components/scanner/MarketStatusBanner';
import ScanResultsTable from '@/components/scanner/ScanResultsTable';
import type { ParityScanResponse } from '@/types/scanner';

export default function ScannerPage() {
  const [symbol, setSymbol] = useState('');
  const [scanResult, setScanResult] = useState<ParityScanResponse | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!symbol.trim()) return;

    setIsScanning(true);
    setError(null);
    setScanResult(null);

    try {
      const result = await api.runParityScan({
        symbol: symbol.toUpperCase(),
        min_dte: 7,
        max_dte: 45,
        risk_free_rate: 0.045,
        parity_threshold: 0.02,
        max_results: 10
      });
      setScanResult(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to scan. Check IBKR connection.';
      setError(errorMessage);
    } finally {
      setIsScanning(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && symbol.trim() && !isScanning) {
      handleScan();
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Put-Call Parity Scanner</h1>
        <p className="text-gray-600">
          Detects arbitrage opportunities and statistical outliers in options pricing using Black-Scholes analysis
        </p>
      </div>

      <MarketStatusBanner />

      {/* Scanner Input */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              placeholder="Enter symbol (e.g., AAPL, SPY, TSLA)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              disabled={isScanning}
            />
          </div>
          <button
            onClick={handleScan}
            disabled={isScanning || !symbol.trim()}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
          >
            {isScanning ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Scan for Arbitrage
              </>
            )}
          </button>
        </div>

        {/* Info Text */}
        <div className="mt-3 text-sm text-gray-500">
          <strong>How it works:</strong> Analyzes put-call parity (C - P = S - K×e<sup>-rT</sup>) to identify
          mispriced options and detects statistical outliers with unusual implied volatility.
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-900">Scan Failed</h3>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {scanResult && <ScanResultsTable data={scanResult} />}

      {/* Empty State */}
      {!scanResult && !error && !isScanning && (
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Enter a symbol to scan for mispricing
          </h3>
          <p className="text-gray-600 max-w-md mx-auto">
            The scanner will analyze the options chain and identify arbitrage opportunities based on put-call parity violations
            and statistical outliers in implied volatility.
          </p>
        </div>
      )}
    </div>
  );
}
