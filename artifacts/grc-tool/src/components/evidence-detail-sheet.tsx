import React, { useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  useGetEvidence,
  getGetEvidenceQueryKey,
  useUpdateEvidence,
  useUploadEvidenceFile,
  useListActivity,
  getListActivityQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getListEvidenceQueryKey } from '@workspace/api-client-react';
import { useEntity } from '@/context/EntityContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileUp,
  Paperclip,
  Tag,
  User,
  X,
  XCircle,
  Activity as ActivityIcon,
  ChevronRight,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EvidenceDetailSheetProps {
  evidenceId: string | null;
  onClose: () => void;
}

// ─── Status helpers ──────────────────────────────────────────────────────────

type EvidenceStatus = 'requested' | 'in-progress' | 'submitted' | 'approved' | 'rejected';

const STATUS_ORDER: EvidenceStatus[] = ['requested', 'in-progress', 'submitted', 'approved', 'rejected'];

const STATUS_CONFIG: Record<EvidenceStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  'requested':  { label: 'Requested',  color: 'bg-slate-500',   icon: Clock },
  'in-progress':{ label: 'In Progress',color: 'bg-blue-500',    icon: ChevronRight },
  'submitted':  { label: 'Submitted',  color: 'bg-violet-500',  icon: Check },
  'approved':   { label: 'Approved',   color: 'bg-emerald-500', icon: CheckCircle2 },
  'rejected':   { label: 'Rejected',   color: 'bg-red-500',     icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: 'text-red-500 bg-red-500/10 border-red-200' },
  high:     { label: 'High',     color: 'text-orange-500 bg-orange-500/10 border-orange-200' },
  medium:   { label: 'Medium',   color: 'text-amber-500 bg-amber-500/10 border-amber-200' },
  low:      { label: 'Low',      color: 'text-slate-500 bg-slate-500/10 border-slate-200' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function EvidenceDetailSheet({ evidenceId, onClose }: EvidenceDetailSheetProps) {
  const { activeEntity } = useEntity();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const { data: evidence, isLoading } = useGetEvidence(evidenceId ?? '', {
    query: {
      queryKey: getGetEvidenceQueryKey(evidenceId ?? ''),
      enabled: !!evidenceId,
    },
  });

  // Sync notes when evidence loads (if not edited by user yet)
  React.useEffect(() => {
    if (evidence && !notesDirty) {
      setNotes(evidence.notes ?? '');
    }
  }, [evidence, notesDirty]);

  // Activity log filtered to this evidence code
  const { data: activities } = useListActivity(
    { entityCode: activeEntity, limit: 50 },
    { query: { queryKey: getListActivityQueryKey({ entityCode: activeEntity, limit: 50 }), enabled: !!evidenceId } }
  );

  const evidenceActivities = React.useMemo(() => {
    if (!activities || !evidence) return [];
    return activities.filter(a => a.target.startsWith(evidence.code));
  }, [activities, evidence]);

  const { mutate: updateEvidence, isPending: isUpdating } = useUpdateEvidence({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEvidenceQueryKey(evidenceId ?? '') });
        queryClient.invalidateQueries({ queryKey: getListEvidenceQueryKey({ entityCode: activeEntity }) });
        queryClient.invalidateQueries({ queryKey: getListActivityQueryKey({ entityCode: activeEntity, limit: 50 }) });
      },
      onError: () => {
        toast({ title: 'Update failed', description: 'Could not save changes.', variant: 'destructive' });
      },
    },
  });

  const { mutate: uploadFile } = useUploadEvidenceFile({
    mutation: {
      onSuccess: () => {
        setUploadingFile(false);
        queryClient.invalidateQueries({ queryKey: getGetEvidenceQueryKey(evidenceId ?? '') });
        queryClient.invalidateQueries({ queryKey: getListActivityQueryKey({ entityCode: activeEntity, limit: 50 }) });
        toast({ title: 'File uploaded', description: 'Evidence file has been attached.' });
      },
      onError: () => {
        setUploadingFile(false);
        toast({ title: 'Upload failed', description: 'Could not upload file.', variant: 'destructive' });
      },
    },
  });

  const handleStatusChange = (newStatus: EvidenceStatus) => {
    if (!evidenceId || !evidence || newStatus === evidence.status) return;
    updateEvidence({ id: evidenceId, data: { status: newStatus } });
    toast({ title: 'Status updated', description: `Changed to "${STATUS_CONFIG[newStatus].label}".` });
  };

  const handleSaveNotes = () => {
    if (!evidenceId) return;
    updateEvidence({ id: evidenceId, data: { notes } });
    setNotesDirty(false);
    toast({ title: 'Notes saved' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !evidenceId) return;
    setUploadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      const fileData = reader.result as string;
      uploadFile({ id: evidenceId, data: { fileName: file.name, fileData } });
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const isApproved = evidence?.status === 'approved';
  const isRejected = evidence?.status === 'rejected';
  const canApproveReject = evidence?.status === 'submitted' || evidence?.status === 'in-progress';

  return (
    <Sheet open={!!evidenceId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:w-[640px] sm:max-w-none overflow-y-auto p-0 flex flex-col gap-0">
        {isLoading || !evidence ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <>
            {/* ── Header ── */}
            <SheetHeader className="p-6 pb-4 border-b border-border shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-xs text-muted-foreground">{evidence.code}</span>
                    <Badge variant="outline" className="font-mono text-[10px] bg-background">{evidence.frameworkCode}</Badge>
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", PRIORITY_CONFIG[evidence.priority]?.color)}>
                      {evidence.priority}
                    </span>
                  </div>
                  <SheetTitle className="text-lg font-semibold leading-snug">{evidence.title}</SheetTitle>
                </div>
              </div>
            </SheetHeader>

            {/* ── Status bar ── */}
            <div className="px-6 py-3 border-b border-border bg-muted/30 shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {STATUS_ORDER.filter(s => s !== 'rejected').map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const isCurrent = evidence.status === s;
                  const isReachable = s !== evidence.status;
                  return (
                    <button
                      key={s}
                      onClick={() => isReachable && handleStatusChange(s)}
                      disabled={isCurrent || isUpdating}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                        isCurrent
                          ? cn(cfg.color, "text-white cursor-default shadow-sm")
                          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border cursor-pointer"
                      )}
                    >
                      <cfg.icon className="h-3 w-3" />
                      {cfg.label}
                    </button>
                  );
                })}

                {/* Approve / Reject buttons for reviewer */}
                {(canApproveReject || isApproved || isRejected) && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      onClick={() => handleStatusChange('approved')}
                      disabled={isApproved || isUpdating}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                        isApproved
                          ? "bg-emerald-500 text-white border-transparent cursor-default"
                          : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                      )}
                    >
                      <CheckCircle2 className="h-3 w-3" /> Approve
                    </button>
                    <button
                      onClick={() => handleStatusChange('rejected')}
                      disabled={isRejected || isUpdating}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                        isRejected
                          ? "bg-red-500 text-white border-transparent cursor-default"
                          : "border-red-300 text-red-700 hover:bg-red-50 cursor-pointer"
                      )}
                    >
                      <XCircle className="h-3 w-3" /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto">
              {/* Meta grid */}
              <div className="p-6 grid grid-cols-2 gap-x-8 gap-y-4 text-sm border-b border-border">
                <div className="flex items-start gap-2.5">
                  <Tag className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Control Ref</p>
                    <p className="font-mono font-medium text-xs">{evidence.controlRef}</p>
                    {evidence.controlName && <p className="text-xs text-muted-foreground mt-0.5">{evidence.controlName}</p>}
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <User className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Assignee</p>
                    <p className="text-xs">{evidence.assignee ?? <span className="text-muted-foreground italic">Unassigned</span>}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Calendar className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Due Date</p>
                    {evidence.dueDate ? (
                      <p className={cn(
                        "text-xs font-mono",
                        new Date(evidence.dueDate) < new Date() && !['approved','submitted'].includes(evidence.status)
                          ? "text-destructive font-semibold"
                          : ""
                      )}>
                        {new Date(evidence.dueDate) < new Date() && !['approved','submitted'].includes(evidence.status) && (
                          <AlertCircle className="inline h-3 w-3 mr-1" />
                        )}
                        {format(new Date(evidence.dueDate), 'MMM d, yyyy')}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No due date</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <User className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Requested By</p>
                    <p className="text-xs">{evidence.requestedBy ?? <span className="text-muted-foreground italic">—</span>}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 col-span-2">
                  <Clock className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Requested</p>
                    <p className="text-xs font-mono">{format(new Date(evidence.requestedAt), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {evidence.description && (
                <div className="px-6 py-4 border-b border-border">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Description</p>
                  <p className="text-sm text-foreground leading-relaxed">{evidence.description}</p>
                </div>
              )}

              {/* File upload */}
              <div className="px-6 py-4 border-b border-border">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Evidence File</p>
                {evidence.fileName ? (
                  <div className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-muted/30">
                    <Paperclip className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{evidence.fileName}</p>
                      {evidence.fileUrl && (
                        <a
                          href={evidence.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Download
                        </a>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5 text-muted-foreground"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileUp className="h-3.5 w-3.5" /> Replace
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className={cn(
                      "w-full flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-dashed border-border",
                      "hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer",
                      uploadingFile && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <FileUp className="h-8 w-8 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-sm font-medium">{uploadingFile ? 'Uploading…' : 'Upload evidence file'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">PDF, DOCX, PNG, XLSX, or any file type</p>
                    </div>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Notes */}
              <div className="px-6 py-4 border-b border-border">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Notes</p>
                <Textarea
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
                  placeholder="Add internal notes, observations, or audit remarks…"
                  className="min-h-[100px] text-sm resize-none"
                />
                {notesDirty && (
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => { setNotes(evidence.notes ?? ''); setNotesDirty(false); }}
                    >
                      <X className="h-3 w-3 mr-1" /> Discard
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={handleSaveNotes} disabled={isUpdating}>
                      <Check className="h-3 w-3 mr-1" /> Save Notes
                    </Button>
                  </div>
                )}
              </div>

              {/* Activity log */}
              <div className="px-6 py-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3 flex items-center gap-1.5">
                  <ActivityIcon className="h-3.5 w-3.5" /> Activity
                </p>
                {evidenceActivities.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No activity recorded yet.</p>
                ) : (
                  <div className="space-y-0 relative">
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                    {evidenceActivities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 pb-4 relative">
                        <div className="h-3.5 w-3.5 rounded-full bg-background border-2 border-border mt-1 shrink-0 z-10" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs">
                            <span className="font-semibold">{activity.actor}</span>
                            {' '}
                            <span className="text-muted-foreground">{activity.action}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
