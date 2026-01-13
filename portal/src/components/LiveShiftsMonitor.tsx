import { useState, useEffect, useRef } from 'react';
import { Eye, AlertCircle, CheckCircle, Camera, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { fetchActiveShifts, forceEndShift, uploadOdometerPhoto } from '../lib/api';

interface LiveShiftsMonitorProps {
  onViewShift: (shiftId: string) => void;
}

export default function LiveShiftsMonitor({ onViewShift }: LiveShiftsMonitorProps) {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [forceEndDialog, setForceEndDialog] = useState<{ open: boolean; shiftId: string | null; reason: string }>({
    open: false,
    shiftId: null,
    reason: '',
  });
  const [uploadDialog, setUploadDialog] = useState<{ open: boolean; shiftId: string | null; file: File | null }>({
    open: false,
    shiftId: null,
    file: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchShifts();
    const interval = setInterval(fetchShifts, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchShifts = async () => {
    try {
      const data = await fetchActiveShifts();
      setShifts(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      setLoading(false);
    }
  };

  const handleForceEnd = async () => {
    if (!forceEndDialog.shiftId || !forceEndDialog.reason.trim()) {
      alert('Please provide a reason for force-ending this shift');
      return;
    }

    try {
      await forceEndShift(forceEndDialog.shiftId, forceEndDialog.reason, 'Admin User');
      setForceEndDialog({ open: false, shiftId: null, reason: '' });
      fetchShifts();
      alert('Shift force-ended successfully');
    } catch (error) {
      console.error('Error force-ending shift:', error);
      alert('Failed to force-end shift');
    }
  };

  const handleUploadOdometer = async () => {
    if (!uploadDialog.shiftId || !uploadDialog.file) {
      alert('Please select a file to upload');
      return;
    }

    try {
      await uploadOdometerPhoto(uploadDialog.file, uploadDialog.shiftId);
      setUploadDialog({ open: false, shiftId: null, file: null });
      fetchShifts();
      alert('Odometer photo uploaded successfully');
    } catch (error) {
      console.error('Error uploading odometer:', error);
      alert('Failed to upload odometer photo');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        alert('File size exceeds 5MB limit. Please select a smaller file.');
        event.target.value = ''; // Clear the input
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
        event.target.value = ''; // Clear the input
        return;
      }

      setUploadDialog({ ...uploadDialog, file });
    }
  };

  const getShiftStatus = (shift: any) => {
    const duration = Date.now() - new Date(shift.started_at).getTime();
    const hours = duration / (1000 * 60 * 60);

    if (hours > 12) return 'error';
    if (!shift.odometer_photo_url) return 'warning';
    return 'ok';
  };

  const getDurationString = (startTime: string) => {
    const duration = Date.now() - new Date(startTime).getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading shifts...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Live Shifts Monitor</h2>
        <p className="text-sm text-muted-foreground mt-1">Real-time monitoring of active shifts</p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-b border-border hover:bg-muted/30">
              <TableHead className="text-xs font-bold text-foreground uppercase">Status</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Driver</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Vehicle</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Start Time</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Duration</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Odometer</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No active shifts
                </TableCell>
              </TableRow>
            ) : (
              shifts.map((shift) => {
                const status = getShiftStatus(shift);
                return (
                  <TableRow key={shift.id} className="border-b border-border hover:bg-muted/20">
                    <TableCell>
                      {status === 'ok' && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#10b981]" />
                          <span className="text-xs text-[#10b981] font-medium">OK</span>
                        </div>
                      )}
                      {status === 'warning' && (
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-[#f59e0b]" />
                          <span className="text-xs text-[#f59e0b] font-medium">WARNING</span>
                        </div>
                      )}
                      {status === 'error' && (
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-[#ef4444]" />
                          <span className="text-xs text-[#ef4444] font-medium">ERROR</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground">{shift.driver?.full_name || 'Unknown'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{shift.vehicle?.registration || 'Unknown'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(shift.started_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{getDurationString(shift.started_at)}</TableCell>
                    <TableCell>
                      {shift.odometer_photo_url ? (
                        <CheckCircle className="w-4 h-4 text-[#10b981]" />
                      ) : (
                        <Camera className="w-4 h-4 text-[#f59e0b]" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onViewShift(shift.id)}
                          className="text-xs"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        {!shift.odometer_photo_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setUploadDialog({ open: true, shiftId: shift.id, file: null })}
                            className="text-xs border-[#f59e0b] text-[#f59e0b] hover:bg-[#f59e0b]/10"
                          >
                            <Camera className="w-3 h-3 mr-1" />
                            Upload
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setForceEndDialog({ open: true, shiftId: shift.id, reason: '' })}
                          className="text-xs"
                        >
                          Force End
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Force End Dialog */}
      <Dialog open={forceEndDialog.open} onOpenChange={(open: boolean) => setForceEndDialog({ ...forceEndDialog, open })}>
        <DialogContent className="bg-card border-destructive">
          <DialogHeader>
            <DialogTitle className="text-destructive">⚠️ Force End Shift</DialogTitle>
            <DialogDescription>
              This action will immediately end the shift. You must provide a reason for this action.
              This will be logged and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-foreground mb-2 block">Reason (Required)</label>
            <Textarea
              placeholder="e.g., Driver reported emergency, vehicle breakdown, etc."
              value={forceEndDialog.reason}
              onChange={(e) => setForceEndDialog({ ...forceEndDialog, reason: e.target.value })}
              className="min-h-24"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForceEndDialog({ open: false, shiftId: null, reason: '' })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleForceEnd}>
              Confirm Force End
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Odometer Dialog */}
      <Dialog open={uploadDialog.open} onOpenChange={(open: boolean) => setUploadDialog({ ...uploadDialog, open })}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Upload Start Odometer Photo</DialogTitle>
            <DialogDescription>
              Select an odometer photo file to upload. This will be attached to the shift.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-foreground mb-2 block">Select Photo File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="block w-full text-sm text-foreground
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-semibold
                file:bg-primary file:text-primary-foreground
                hover:file:bg-primary/90
                cursor-pointer"
            />
            {uploadDialog.file && (
              <p className="text-xs text-muted-foreground mt-2">
                Selected: {uploadDialog.file.name} ({(uploadDialog.file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialog({ open: false, shiftId: null, file: null })}>
              Cancel
            </Button>
            <Button onClick={handleUploadOdometer} disabled={!uploadDialog.file}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
