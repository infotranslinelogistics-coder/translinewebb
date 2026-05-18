import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Textarea } from '@/app/components/ui/textarea';
import { Input } from '@/app/components/ui/input';
import { Check, Search, ShieldAlert, XCircle, Loader } from 'lucide-react';
import {
  approveChecklistRequest,
  listChecklistApprovals,
  rejectChecklistRequest,
  type ChecklistApprovalRequest,
} from '@/lib/db/checklistApprovals';
import { formatPerthDateTime, PERTH_TIME_LABEL } from '@/lib/dateTime';

const statusBadgeClass = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'approved') return 'bg-green-950 text-green-400 border-green-900';
  if (normalized === 'rejected') return 'bg-red-950 text-red-400 border-red-900';
  return 'bg-yellow-950 text-yellow-300 border-yellow-900';
};

const isPendingStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  return normalized === 'pending' || normalized === 'requested' || normalized === 'awaiting_approval';
};

function getFailedItemSummary(request: ChecklistApprovalRequest): string {
  if (request.failed_items.length === 0) {
    return request.failed_items_count > 0
      ? `${request.failed_items_count} failed item(s)`
      : 'No failed item details';
  }

  return request.failed_items
    .map((item) => {
      const note = item.notes ? ` (${item.notes})` : '';
      const value = item.valueLabel ? `: ${item.valueLabel}` : '';
      return `${item.label}${value}${note}`;
    })
    .join(', ');
}

function ChecklistViewDialog({
  request,
  open,
  onOpenChange,
}: {
  request: ChecklistApprovalRequest | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-gray-800 bg-[#161616] text-gray-100">
        <DialogHeader>
          <DialogTitle className="text-white">Checklist Request Details</DialogTitle>
          <DialogDescription className="text-gray-400">
            Failed pre-start checklist details. Times shown in {PERTH_TIME_LABEL}.
          </DialogDescription>
        </DialogHeader>

        {!request ? (
          <p className="text-sm text-gray-400">No checklist selected.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <p className="text-gray-300">Requested: <span className="text-white">{formatPerthDateTime(request.requested_at)}</span></p>
              <p className="text-gray-300">Status: <span className="text-white capitalize">{request.status}</span></p>
              <p className="text-gray-300">Driver: <span className="text-white">{request.driver_name ?? request.driver_id ?? 'Unknown'}</span></p>
              <p className="text-gray-300">Vehicle: <span className="text-white">{request.vehicle_rego ?? request.vehicle_id ?? 'Unknown'}</span></p>
            </div>

            <div className="rounded-lg border border-gray-800 bg-[#0F0F0F] p-3">
              <p className="mb-2 text-sm font-semibold text-white">Failed Items ({request.failed_items_count})</p>
              {request.failed_items.length === 0 ? (
                <p className="text-sm text-gray-500">No structured failed item list was saved.</p>
              ) : (
                <div className="space-y-2">
                  {request.failed_items.map((item) => (
                    <div key={`${request.request_id}-${item.key}`} className="rounded border border-gray-700 p-2 text-sm">
                      <p className="text-white font-medium">{item.label}</p>
                      {item.valueLabel && <p className="text-gray-300">Value: {item.valueLabel}</p>}
                      {item.notes && <p className="text-gray-400">Note: {item.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-800 bg-[#0F0F0F] p-3">
              <p className="mb-2 text-sm font-semibold text-white">Admin Note</p>
              <p className="text-sm text-gray-300">{request.admin_note ?? 'No admin note yet.'}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ChecklistApprovalsPage() {
  const [rows, setRows] = useState<ChecklistApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approveNoteById, setApproveNoteById] = useState<Record<string, string>>({});
  const [rejectNoteById, setRejectNoteById] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<ChecklistApprovalRequest | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const requests = await listChecklistApprovals();
      setRows(requests);
    } catch (err) {
      console.error('ChecklistApprovalsPage: failed to load requests:', err);
      setError('Failed to load checklist approvals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((row) => {
      const haystack = [
        row.driver_name,
        row.driver_id,
        row.vehicle_rego,
        row.vehicle_id,
        row.status,
        row.admin_note,
        getFailedItemSummary(row),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [rows, search]);

  const pendingCount = useMemo(
    () => rows.filter((row) => isPendingStatus(row.status)).length,
    [rows]
  );

  const approvedCount = useMemo(
    () => rows.filter((row) => row.status.toLowerCase() === 'approved').length,
    [rows]
  );

  const rejectedCount = useMemo(
    () => rows.filter((row) => row.status.toLowerCase() === 'rejected').length,
    [rows]
  );

  const handleApprove = useCallback(
    async (request: ChecklistApprovalRequest) => {
      const note = (approveNoteById[request.request_id] ?? '').trim();
      try {
        setBusyId(request.request_id);
        await approveChecklistRequest(request.request_id, note);
        await load();
      } catch (err) {
        console.error('ChecklistApprovalsPage: approve failed:', err);
        setError('Failed to approve checklist request.');
      } finally {
        setBusyId(null);
      }
    },
    [approveNoteById, load]
  );

  const handleReject = useCallback(
    async (request: ChecklistApprovalRequest) => {
      const note = (rejectNoteById[request.request_id] ?? '').trim();
      if (!note) {
        setError('Reject note is required.');
        return;
      }

      try {
        setBusyId(request.request_id);
        await rejectChecklistRequest(request.request_id, note);
        await load();
      } catch (err) {
        console.error('ChecklistApprovalsPage: reject failed:', err);
        setError('Failed to reject checklist request.');
      } finally {
        setBusyId(null);
      }
    },
    [rejectNoteById, load]
  );

  return (
    <div className="space-y-6">
      {error && (
        <Card className="bg-red-950 border-red-900">
          <CardContent className="p-4 text-red-300">{error}</CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Checklist Approvals</h1>
          <p className="text-gray-400">Admin workflow for failed pre-start checklist requests. All times shown in {PERTH_TIME_LABEL}.</p>
        </div>
        <Button
          variant="outline"
          onClick={load}
          className="border-gray-700 bg-[#0F0F0F] text-gray-200 hover:bg-[#1C1C1C] hover:text-white"
          disabled={loading}
        >
          {loading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Pending</p>
            <p className="text-3xl font-bold text-red-400">{loading ? '-' : pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Approved</p>
            <p className="text-3xl font-bold text-green-400">{loading ? '-' : approvedCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Rejected</p>
            <p className="text-3xl font-bold text-yellow-300">{loading ? '-' : rejectedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#161616] border-gray-800">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-white">Approval Requests</CardTitle>
              <CardDescription className="text-gray-400">Review failed checklist submissions and unblock or reject drivers.</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by driver, vehicle, status..."
                className="pl-10 bg-[#0F0F0F] border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader className="h-8 w-8 animate-spin text-[#FF6B35]" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Requested time</TableHead>
                    <TableHead className="text-gray-400">Driver</TableHead>
                    <TableHead className="text-gray-400">Vehicle</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400">Failed items count</TableHead>
                    <TableHead className="text-gray-400 min-w-[260px]">Failed item details</TableHead>
                    <TableHead className="text-gray-400 min-w-[260px]">Admin note</TableHead>
                    <TableHead className="text-gray-400 min-w-[280px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-gray-500">
                        No checklist approval requests found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((request) => {
                      const isPending = isPendingStatus(request.status);
                      const busy = busyId === request.request_id;

                      return (
                        <TableRow key={request.request_id} className="border-gray-800 align-top">
                          <TableCell className="text-gray-300">{formatPerthDateTime(request.requested_at)}</TableCell>
                          <TableCell className="text-gray-200">{request.driver_name ?? request.driver_id ?? 'Unknown'}</TableCell>
                          <TableCell className="text-gray-200">{request.vehicle_rego ?? request.vehicle_id ?? 'Unknown'}</TableCell>
                          <TableCell>
                            <Badge className={`${statusBadgeClass(request.status)} capitalize`}>
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-200">{request.failed_items_count}</TableCell>
                          <TableCell className="text-gray-300 text-sm">{getFailedItemSummary(request)}</TableCell>
                          <TableCell className="space-y-2">
                            <p className="text-sm text-gray-300">{request.admin_note ?? 'No note'}</p>
                            {isPending && (
                              <>
                                <Textarea
                                  value={approveNoteById[request.request_id] ?? ''}
                                  onChange={(event) =>
                                    setApproveNoteById((prev) => ({ ...prev, [request.request_id]: event.target.value }))
                                  }
                                  placeholder="Optional approval note"
                                  className="min-h-16 bg-[#0F0F0F] border-gray-700 text-white"
                                />
                                <Textarea
                                  value={rejectNoteById[request.request_id] ?? ''}
                                  onChange={(event) =>
                                    setRejectNoteById((prev) => ({ ...prev, [request.request_id]: event.target.value }))
                                  }
                                  placeholder="Required reject note"
                                  className="min-h-16 bg-[#0F0F0F] border-gray-700 text-white"
                                />
                              </>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-gray-700 bg-[#0F0F0F] text-gray-200 hover:bg-[#1C1C1C] hover:text-white"
                                onClick={() => setViewing(request)}
                              >
                                <ShieldAlert className="mr-1 h-4 w-4" />
                                View checklist
                              </Button>

                              {isPending ? (
                                <>
                                  <Button
                                    size="sm"
                                    className="bg-green-600 text-white hover:bg-green-500"
                                    disabled={busy}
                                    onClick={() => handleApprove(request)}
                                  >
                                    <Check className="mr-1 h-4 w-4" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-red-600 text-white hover:bg-red-500"
                                    disabled={busy}
                                    onClick={() => handleReject(request)}
                                  >
                                    <XCircle className="mr-1 h-4 w-4" />
                                    Reject with note
                                  </Button>
                                </>
                              ) : (
                                <p className="text-xs text-gray-500">Request already finalized.</p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ChecklistViewDialog request={viewing} open={Boolean(viewing)} onOpenChange={(next) => !next && setViewing(null)} />
    </div>
  );
}
