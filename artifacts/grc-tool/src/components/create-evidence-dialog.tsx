import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateEvidence, getListEvidenceQueryKey } from '@workspace/api-client-react';
import { useEntity } from '@/context/EntityContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface CreateEvidenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_FORM = {
  title: '',
  controlRef: '',
  frameworkCode: '',
  description: '',
  assignee: '',
  requestedBy: '',
  dueDate: '',
  priority: 'medium' as 'critical' | 'high' | 'medium' | 'low',
};

export function CreateEvidenceDialog({ open, onOpenChange }: CreateEvidenceDialogProps) {
  const { activeEntity } = useEntity();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);

  const { mutate: createEvidence, isPending } = useCreateEvidence({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEvidenceQueryKey({ entityCode: activeEntity }) });
        toast({ title: 'Evidence request created' });
        setForm(EMPTY_FORM);
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: 'Failed to create', description: 'Please check the form and try again.', variant: 'destructive' });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.controlRef || !form.frameworkCode) {
      toast({ title: 'Missing required fields', description: 'Title, Control Ref, and Framework are required.', variant: 'destructive' });
      return;
    }
    createEvidence({
      data: {
        entityCode: activeEntity,
        title: form.title,
        controlRef: form.controlRef,
        frameworkCode: form.frameworkCode,
        description: form.description || undefined,
        assignee: form.assignee || undefined,
        requestedBy: form.requestedBy || undefined,
        dueDate: form.dueDate || undefined,
        priority: form.priority,
      },
    });
  };

  const set = (key: keyof typeof EMPTY_FORM) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Request Evidence</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="ev-title"
              placeholder="e.g. Firewall configuration logs for Q2"
              value={form.title}
              onChange={set('title')}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ev-control-ref">Control Ref <span className="text-destructive">*</span></Label>
              <Input
                id="ev-control-ref"
                placeholder="e.g. 1.2.1"
                value={form.controlRef}
                onChange={set('controlRef')}
                required
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-framework">Framework <span className="text-destructive">*</span></Label>
              <Input
                id="ev-framework"
                placeholder="e.g. PCI-DSS"
                value={form.frameworkCode}
                onChange={set('frameworkCode')}
                required
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">Description</Label>
            <Textarea
              id="ev-desc"
              placeholder="Describe what evidence is needed and why…"
              value={form.description}
              onChange={set('description')}
              className="min-h-[80px] resize-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ev-assignee">Assignee</Label>
              <Input
                id="ev-assignee"
                placeholder="e.g. jane@example.com"
                value={form.assignee}
                onChange={set('assignee')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-requested-by">Requested By</Label>
              <Input
                id="ev-requested-by"
                placeholder="e.g. auditor@firm.com"
                value={form.requestedBy}
                onChange={set('requestedBy')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ev-due">Due Date</Label>
              <Input
                id="ev-due"
                type="date"
                value={form.dueDate}
                onChange={set('dueDate')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm(f => ({ ...f, priority: v as typeof f.priority }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
