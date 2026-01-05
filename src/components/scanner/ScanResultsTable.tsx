'use client';

import { useState, useMemo } from 'react';
import type { ParityScanResponse, MispricedOption } from '@/types/scanner';
import { ArrowUpDown, AlertTriangle, TrendingUp, Activity } from 'lucide-react';

interface ScanResultsTableProps {
  data: ParityScanResponse;
}

type SortField = 'strike' | 'dte' | 'violation_pct' | 'iv_z_score' | 'opportunity_score';

// SortButton component defined outside of render
const SortButton = ({ field, label, onClick }: { field: SortField; label: string; onClick: (field: SortField) => void }) => (
  <button
    onClick={() => onClick(field)}
    className="flex items-center gap-1 hover:text-blue-600 font-semibold"
  >
    {label}
    <ArrowUpDown className="w-4 h-4" />
  </button>
);

export default function ScanResultsTable({ data }: ScanResultsTableProps) {
  const [sortBy, setSortBy] = useState<SortField>('opportunity_score');
  const [sortDesc, setSortDesc] = useState(true);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(field);
      setSortDesc(true);
    }
  };

  const sortedOpportunities = useMemo(() => {
    const sorted = [...data.opportunities].sort((a, b) => {
      let aVal: number, bVal: number;

      switch (sortBy) {
        case 'strike':
          aVal = a.strike;
          bVal = b.strike;
          break;
        case 'dte':
          aVal = a.dte;
          bVal = b.dte;
          break;
        case 'violation_pct':
          aVal = Math.abs(a.violation_pct);
          bVal = Math.abs(b.violation_pct);
          break;
        case 'iv_z_score':
          aVal = Math.abs(a.iv_z_score);
          bVal = Math.abs(b.iv_z_score);
          break;
        case 'opportunity_score':
        default:
          aVal = a.opportunity_score;
          bVal = b.opportunity_score;
      }

      return sortDesc ? bVal - aVal : aVal - bVal;
    });

    return sorted;
  }, [data.opportunities, sortBy, sortDesc]);

  const formatExpiry = (expiry: string) => {
    // Format YYYYMMDD to MM/DD/YY
    const year = expiry.substring(2, 4);
    const month = expiry.substring(4, 6);
    const day = expiry.substring(6, 8);
    return `${month}/${day}/${year}`;
  };

  const getRowClassName = (opp: MispricedOption) => {
    if (opp.is_violation) {
      if (opp.arbitrage_type === 'call_overpriced') {
        return 'bg-red-50 border-l-4 border-red-500';
      } else if (opp.arbitrage_type === 'put_overpriced') {
        return 'bg-orange-50 border-l-4 border-orange-500';
      }
    }

    if (opp.is_iv_outlier) {
      return 'bg-purple-50 border-l-4 border-purple-500';
    }

    return '';
  };

  return (
    <div className="space-y-4">
      {/* Summary Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {data.symbol} @ ${data.stock_price.toFixed(2)}
            </h2>
            <p className="text-gray-600 mt-1">
              Average IV: {(data.avg_iv * 100).toFixed(1)}% ± {(data.iv_std_dev * 100).toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">
              {data.opportunities.length}
            </div>
            <div className="text-sm text-gray-600">
              {data.opportunities.length === 1 ? 'Opportunity' : 'Opportunities'} Found
            </div>
          </div>
        </div>

        {data.opportunities.length === 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No arbitrage opportunities or outliers detected</p>
            <p className="text-sm text-gray-500 mt-2">
              Options appear to be fairly priced according to put-call parity and IV distribution.
            </p>
          </div>
        )}
      </div>

      {/* Results Table */}
      {data.opportunities.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <SortButton field="strike" label="Strike" onClick={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left">Expiry</th>
                  <th className="px-4 py-3 text-left">
                    <SortButton field="dte" label="DTE" onClick={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-right">Call Mid</th>
                  <th className="px-4 py-3 text-right">Put Mid</th>
                  <th className="px-4 py-3 text-right">
                    <SortButton field="violation_pct" label="Parity Violation" onClick={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">
                    <SortButton field="iv_z_score" label="IV Z-Score" onClick={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortButton field="opportunity_score" label="Score" onClick={handleSort} />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedOpportunities.map((opp, idx) => (
                  <tr key={idx} className={`hover:bg-gray-50 ${getRowClassName(opp)}`}>
                    <td className="px-4 py-3 font-mono font-semibold">${opp.strike.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatExpiry(opp.expiry)}</td>
                    <td className="px-4 py-3 text-gray-600">{opp.dte}d</td>
                    <td className="px-4 py-3 text-right font-mono">${opp.call_mid.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono">${opp.put_mid.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${opp.violation_pct > 0 ? 'text-red-600' : 'text-orange-600'}`}>
                      {opp.violation_pct > 0 ? '+' : ''}{opp.violation_pct.toFixed(2)}%
                      {opp.is_violation && (
                        <AlertTriangle className="w-4 h-4 inline ml-1 align-text-bottom" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {opp.arbitrage_type === 'call_overpriced' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Call High
                        </span>
                      )}
                      {opp.arbitrage_type === 'put_overpriced' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Put High
                        </span>
                      )}
                      {opp.arbitrage_type === 'no_violation' && (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${Math.abs(opp.iv_z_score) > 2 ? 'font-bold text-purple-600' : 'text-gray-600'}`}>
                      {opp.iv_z_score.toFixed(2)}
                      {opp.is_iv_outlier && (
                        <TrendingUp className="w-4 h-4 inline ml-1 align-text-bottom" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center justify-center w-12 h-8 rounded-lg bg-blue-100 text-blue-800 font-bold">
                        {opp.opportunity_score}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      {data.opportunities.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 bg-red-500 rounded mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-red-900">Call Overpriced</strong>
                <p className="text-gray-600">Calls trading above put-call parity (sell opportunity)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-orange-900">Put Overpriced</strong>
                <p className="text-gray-600">Puts trading above put-call parity (sell opportunity)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 bg-purple-500 rounded mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-purple-900">IV Outlier</strong>
                <p className="text-gray-600">Implied volatility 2+ std devs from mean</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Educational Note */}
      {data.opportunities.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Understanding Put-Call Parity
          </h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              <strong>Formula:</strong> C - P = S - K×e<sup>-rT</sup>
            </p>
            <p>
              Violations indicate arbitrage opportunities where one side of the equation is mispriced relative to the other.
              Statistical IV outliers suggest unusual market expectations for that specific strike/expiry combination.
            </p>
            <p className="text-xs text-blue-600 mt-2">
              <strong>Note:</strong> Put-call parity is exact for European options, approximate for American options due to early exercise premium.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
