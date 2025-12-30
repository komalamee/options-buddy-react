'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { FilterPresets } from './FilterPresets';
import { FilterConfig, FilterPreset } from '@/types/scanner';

interface FilterBarProps {
  filters: FilterConfig;
  onFiltersChange: (filters: FilterConfig) => void;
  presets: FilterPreset[];
  selectedPresetId: string | null;
  onPresetSelect: (id: string | null) => void;
  onPresetSave: (name: string) => void;
  onPresetDelete: (id: string) => void;
}

export function FilterBar({
  filters,
  onFiltersChange,
  presets,
  selectedPresetId,
  onPresetSelect,
  onPresetSave,
  onPresetDelete,
}: FilterBarProps) {
  const updateFilter = <K extends keyof FilterConfig>(
    key: K,
    value: FilterConfig[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* DTE Range */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">DTE Range</Label>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={filters.minDte}
            onChange={(e) => updateFilter('minDte', parseInt(e.target.value) || 0)}
            className="w-16 h-8 text-sm"
            min={0}
            max={365}
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            value={filters.maxDte}
            onChange={(e) => updateFilter('maxDte', parseInt(e.target.value) || 0)}
            className="w-16 h-8 text-sm"
            min={0}
            max={365}
          />
        </div>
      </div>

      {/* Delta Range */}
      <div className="space-y-1 min-w-[180px]">
        <Label className="text-xs text-muted-foreground">
          Delta: {filters.minDelta.toFixed(2)} - {filters.maxDelta.toFixed(2)}
        </Label>
        <div className="flex gap-2 items-center">
          <Slider
            value={[filters.minDelta]}
            onValueChange={([v]) => updateFilter('minDelta', v)}
            min={0.01}
            max={1}
            step={0.01}
            className="w-20"
          />
          <Slider
            value={[filters.maxDelta]}
            onValueChange={([v]) => updateFilter('maxDelta', v)}
            min={0.01}
            max={1}
            step={0.01}
            className="w-20"
          />
        </div>
      </div>

      {/* Min IV */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Min IV %</Label>
        <Input
          type="number"
          value={filters.minIv}
          onChange={(e) => updateFilter('minIv', parseInt(e.target.value) || 0)}
          className="w-20 h-8 text-sm"
          min={0}
          max={200}
        />
      </div>

      {/* Min Volume */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Min Volume</Label>
        <Input
          type="number"
          value={filters.minVolume}
          onChange={(e) => updateFilter('minVolume', parseInt(e.target.value) || 0)}
          className="w-24 h-8 text-sm"
          min={0}
        />
      </div>

      {/* Weekly Options Toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="weekly"
          checked={filters.weeklyOnly}
          onCheckedChange={(checked) => updateFilter('weeklyOnly', checked)}
        />
        <Label htmlFor="weekly" className="text-sm cursor-pointer">
          Weekly
        </Label>
      </div>

      {/* High IV Toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="highIv"
          checked={filters.highIvOnly}
          onCheckedChange={(checked) => updateFilter('highIvOnly', checked)}
        />
        <Label htmlFor="highIv" className="text-sm cursor-pointer">
          High IV
        </Label>
      </div>

      {/* Presets Dropdown */}
      <div className="ml-auto">
        <FilterPresets
          presets={presets}
          selectedPresetId={selectedPresetId}
          onSelect={onPresetSelect}
          onSave={onPresetSave}
          onDelete={onPresetDelete}
        />
      </div>
    </div>
  );
}
