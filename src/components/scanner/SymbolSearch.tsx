'use client';

import { useState, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';

interface SymbolSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function SymbolSearch({
  value,
  onChange,
  onSearch,
  isLoading,
  disabled = false,
}: SymbolSearchProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !disabled && !isLoading && value.trim()) {
      onSearch();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto-uppercase the symbol
    onChange(e.target.value.toUpperCase());
  };

  return (
    <div className="flex gap-2">
      <div className="relative flex-1 max-w-xs">
        <Input
          type="text"
          placeholder="Enter symbol (e.g., AAPL)"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          className="pr-10 uppercase"
        />
      </div>
      <Button
        onClick={onSearch}
        disabled={disabled || isLoading || !value.trim()}
        className="min-w-[100px]"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading
          </>
        ) : (
          <>
            <Search className="h-4 w-4 mr-2" />
            Search
          </>
        )}
      </Button>
    </div>
  );
}
