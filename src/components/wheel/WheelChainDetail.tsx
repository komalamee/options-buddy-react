'use client';

import { useState } from 'react';
import { WheelChain } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CostBasisBreakdown } from './CostBasisBreakdown';
import { ArrowLeft, DollarSign, LogOut, Trash2 } from 'lucide-react';

interface WheelChainDetailProps {
  chain: WheelChain;
  onBack: () => void;
  onRecordAssignment: (chainId: string, strike: number, shares: number) => Promise<void>;
  onRecordExit: (chainId: string, exitPrice: number, exitType: 'CALLED_AWAY' | 'SOLD') => Promise<void>;
  onDelete: (chainId: string) => Promise<void>;
}

export function WheelChainDetail({
  chain,
  onBack,
  onRecordAssignment,
  onRecordExit,
  onDelete,
}: WheelChainDetailProps) {
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [assignmentStrike, setAssignmentStrike] = useState('');
  const [assignmentShares, setAssignmentShares] = useState('100');
  const [exitPrice, setExitPrice] = useState('');
  const [exitType, setExitType] = useState<'CALLED_AWAY' | 'SOLD'>('CALLED_AWAY');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleRecordAssignment = async () => {
    const strike = parseFloat(assignmentStrike);
    const shares = parseInt(assignmentShares) || 100;
    if (isNaN(strike) || strike <= 0) return;

    setIsSubmitting(true);
    try {
      await onRecordAssignment(chain.id, strike, shares);
      setShowAssignmentDialog(false);
      setAssignmentStrike('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordExit = async () => {
    const price = parseFloat(exitPrice);
    if (isNaN(price) || price <= 0) return;

    setIsSubmitting(true);
    try {
      await onRecordExit(chain.id, price, exitType);
      setShowExitDialog(false);
      setExitPrice('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await onDelete(chain.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    switch (chain.status) {
      case 'COLLECTING_PREMIUM':
        return <Badge variant="default" className="bg-blue-500">Collecting Premium</Badge>;
      case 'HOLDING_SHARES':
        return <Badge variant="default" className="bg-green-500">Holding Shares</Badge>;
      case 'CLOSED':
        return <Badge variant="secondary">Closed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{chain.underlying} Wheel Chain</h2>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge()}
              <span className="text-muted-foreground text-sm">
                Started {formatDate(chain.created_at)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {chain.status === 'COLLECTING_PREMIUM' && (
            <Button onClick={() => setShowAssignmentDialog(true)}>
              <DollarSign className="h-4 w-4 mr-2" />
              Record Assignment
            </Button>
          )}
          {chain.status === 'HOLDING_SHARES' && (
            <Button onClick={() => setShowExitDialog(true)}>
              <LogOut className="h-4 w-4 mr-2" />
              Record Exit
            </Button>
          )}
          <Button variant="destructive" size="icon" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Cost Basis Breakdown */}
        <CostBasisBreakdown chain={chain} />

        {/* Chain Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chain Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium">{chain.status.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Days Active</p>
                <p className="font-medium">{chain.days_in_chain} days</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Put Premium</p>
                <p className="font-medium text-green-500">${chain.total_put_premium.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Call Premium</p>
                <p className="font-medium text-green-500">${chain.total_call_premium.toFixed(2)}</p>
              </div>
            </div>

            {chain.status === 'HOLDING_SHARES' && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Assignment Date</p>
                    <p className="font-medium">{formatDate(chain.assignment_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Shares</p>
                    <p className="font-medium">{chain.shares_acquired}</p>
                  </div>
                </div>
              </>
            )}

            {chain.status === 'CLOSED' && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Exit Date</p>
                    <p className="font-medium">{formatDate(chain.exit_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Exit Type</p>
                    <p className="font-medium">{chain.exit_type}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Linked Positions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Linked Positions ({chain.positions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {chain.positions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No positions linked to this chain yet.
            </p>
          ) : (
            <div className="space-y-2">
              {chain.positions.map((pos) => (
                <div
                  key={pos.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={pos.option_type === 'PUT' ? 'default' : 'secondary'}>
                      {pos.option_type}
                    </Badge>
                    <span className="font-medium">${pos.strike}</span>
                    <span className="text-muted-foreground">{pos.expiry}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-green-500 font-medium">
                      +${(pos.premium_collected * pos.quantity * 100).toFixed(2)}
                    </span>
                    <Badge variant="outline">{pos.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment Dialog */}
      <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Assignment</DialogTitle>
            <DialogDescription>
              Record when you were assigned shares on a put option.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Strike Price</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g., 440.00"
                value={assignmentStrike}
                onChange={(e) => setAssignmentStrike(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Number of Shares</Label>
              <Input
                type="number"
                placeholder="100"
                value={assignmentShares}
                onChange={(e) => setAssignmentShares(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignmentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordAssignment} disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exit Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Exit</DialogTitle>
            <DialogDescription>
              Record when shares were called away or sold.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Exit Price (per share)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g., 450.00"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Exit Type</Label>
              <Select value={exitType} onValueChange={(v) => setExitType(v as 'CALLED_AWAY' | 'SOLD')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CALLED_AWAY">Called Away (CC Assigned)</SelectItem>
                  <SelectItem value="SOLD">Sold Manually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordExit} disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Exit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Wheel Chain</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this wheel chain? This will unlink all positions
              but won&apos;t delete them. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? 'Deleting...' : 'Delete Chain'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
