'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CreateChainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (underlying: string) => void;
}

export function CreateChainDialog({ open, onOpenChange, onConfirm }: CreateChainDialogProps) {
  const [symbol, setSymbol] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;

    setIsSubmitting(true);
    try {
      await onConfirm(symbol.toUpperCase().trim());
      setSymbol('');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Start New Wheel Chain</DialogTitle>
            <DialogDescription>
              Create a new wheel chain to track premium accumulation and cost basis for a stock.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="symbol">Stock Symbol</Label>
              <Input
                id="symbol"
                placeholder="e.g., TSLA"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="uppercase"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Enter the ticker symbol for the stock you want to track.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!symbol.trim() || isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Chain'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
