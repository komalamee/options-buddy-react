'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Save, Trash2, ChevronDown } from 'lucide-react';
import { FilterPreset } from '@/types/scanner';

interface FilterPresetsProps {
  presets: FilterPreset[];
  selectedPresetId: string | null;
  onSelect: (id: string | null) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}

export function FilterPresets({
  presets,
  selectedPresetId,
  onSelect,
  onSave,
  onDelete,
}: FilterPresetsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const handleSave = () => {
    if (newPresetName.trim()) {
      onSave(newPresetName.trim());
      setNewPresetName('');
      setShowSaveInput(false);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDelete(id);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-w-[140px] justify-between">
          {selectedPresetId
            ? presets.find((p) => p.id === selectedPresetId)?.name || 'Preset'
            : 'Presets'}
          <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <div className="space-y-1">
          {/* Clear selection option */}
          <button
            className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted"
            onClick={() => {
              onSelect(null);
              setIsOpen(false);
            }}
          >
            No preset (custom)
          </button>

          {/* Divider */}
          {presets.length > 0 && <div className="border-t my-1" />}

          {/* Preset list */}
          {presets.map((preset) => (
            <div
              key={preset.id}
              className={`flex items-center justify-between px-2 py-1.5 text-sm rounded cursor-pointer hover:bg-muted ${
                selectedPresetId === preset.id ? 'bg-muted' : ''
              }`}
              onClick={() => {
                onSelect(preset.id);
                setIsOpen(false);
              }}
            >
              <span className="truncate">{preset.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => handleDelete(e, preset.id)}
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}

          {/* Divider */}
          <div className="border-t my-1" />

          {/* Save new preset */}
          {showSaveInput ? (
            <div className="flex gap-1 p-1">
              <Input
                type="text"
                placeholder="Preset name"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') setShowSaveInput(false);
                }}
                className="h-7 text-sm"
                autoFocus
              />
              <Button size="sm" className="h-7 px-2" onClick={handleSave}>
                <Save className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <button
              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted text-primary"
              onClick={() => setShowSaveInput(true)}
            >
              + Save current filters
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
