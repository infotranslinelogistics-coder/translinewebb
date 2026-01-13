import { useState, useEffect } from 'react';
import { Camera, CheckCircle, XCircle, Eye, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { supabase } from '../lib/supabase-client';
import { getOdometerPhotoUrl } from '../lib/api';

export default function OdometerReview() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; shift: any } | null>(null);
  const [filter, setFilter] = useState<string>('pending');

  useEffect(() => {
    fetchShifts();
  }, [filter]);

  const fetchShifts = async () => {
    try {
      let query = supabase
        .from('shifts')
        .select(`
          *,
          driver:profiles!shifts_driver_id_fkey(id, full_name),
          vehicle:vehicles(id, registration, type)
        `)
        .order('started_at', { ascending: false });

      if (filter === 'pending') {
        query = query.not('odometer_photo_url', 'is', null).is('odometer_approved', null);
      } else if (filter === 'missing') {
        query = query.is('odometer_photo_url', null).eq('status', 'active');
      } else if (filter === 'approved') {
        query = query.eq('odometer_approved', true);
      } else if (filter === 'rejected') {
        query = query.eq('odometer_approved', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setShifts(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      setLoading(false);
    }
  };

  const handleApprove = async (shiftId: string) => {
    try {
      const { error } = await supabase
        .from('shifts')
        .update({ odometer_approved: true, odometer_approved_at: new Date().toISOString() })
        .eq('id', shiftId);

      if (error) throw error;
      fetchShifts();
      setSelectedPhoto(null);
      alert('Odometer photo approved');
    } catch (error) {
      console.error('Error approving photo:', error);
      alert('Failed to approve photo');
    }
  };

  const handleReject = async (shiftId: string) => {
    const reason = prompt('Enter reason for rejection (optional):');
    
    try {
      const { error } = await supabase
        .from('shifts')
        .update({ 
          odometer_approved: false, 
          odometer_approved_at: new Date().toISOString(),
          odometer_rejection_reason: reason || 'No reason provided'
        })
        .eq('id', shiftId);

      if (error) throw error;
      fetchShifts();
      setSelectedPhoto(null);
      alert('Odometer photo rejected');
    } catch (error) {
      console.error('Error rejecting photo:', error);
      alert('Failed to reject photo');
    }
  };

  const viewPhoto = (shift: any) => {
    if (shift.odometer_photo_url) {
      const photoUrl = getOdometerPhotoUrl(shift.odometer_photo_url);
      setSelectedPhoto({ url: photoUrl, shift });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading odometer photos...</div>
        </div>
      </div>
    );
  }

  const pendingCount = shifts.filter(s => s.odometer_photo_url && s.odometer_approved === null).length;
  const missingCount = shifts.filter(s => !s.odometer_photo_url && s.status === 'active').length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Odometer Review</h2>
        <p className="text-sm text-muted-foreground mt-1">Review and approve odometer photos</p>
      </div>

      {/* Filter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          className={`p-4 cursor-pointer transition-colors ${filter === 'pending' ? 'border-[#f59e0b]' : 'border-border'}`}
          onClick={() => setFilter('pending')}
        >
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending Review</p>
            <p className="text-3xl font-bold text-[#f59e0b] mt-1">{pendingCount}</p>
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-colors ${filter === 'missing' ? 'border-[#ef4444]' : 'border-border'}`}
          onClick={() => setFilter('missing')}
        >
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Missing Photos</p>
            <p className="text-3xl font-bold text-[#ef4444] mt-1">{missingCount}</p>
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-colors ${filter === 'approved' ? 'border-[#10b981]' : 'border-border'}`}
          onClick={() => setFilter('approved')}
        >
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Approved</p>
            <p className="text-3xl font-bold text-[#10b981] mt-1">
              {shifts.filter(s => s.odometer_approved === true).length}
            </p>
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-colors ${filter === 'rejected' ? 'border-muted' : 'border-border'}`}
          onClick={() => setFilter('rejected')}
        >
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Rejected</p>
            <p className="text-3xl font-bold text-muted-foreground mt-1">
              {shifts.filter(s => s.odometer_approved === false).length}
            </p>
          </div>
        </Card>
      </div>

      {/* Shifts Table */}
      <Card className="bg-card border border-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 border-b border-border hover:bg-muted/30">
                <TableHead className="text-xs font-bold text-foreground">Status</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Driver</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Vehicle</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Started</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Photo</TableHead>
                <TableHead className="text-xs font-bold text-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No shifts found for this filter
                  </TableCell>
                </TableRow>
              ) : (
                shifts.map((shift) => (
                  <TableRow key={shift.id} className="border-b border-border hover:bg-muted/20">
                    <TableCell>
                      {shift.odometer_approved === true ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#10b981]" />
                          <span className="text-xs text-[#10b981] font-medium">APPROVED</span>
                        </div>
                      ) : shift.odometer_approved === false ? (
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-[#ef4444]" />
                          <span className="text-xs text-[#ef4444] font-medium">REJECTED</span>
                        </div>
                      ) : !shift.odometer_photo_url ? (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
                          <span className="text-xs text-[#ef4444] font-medium">MISSING</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Camera className="w-4 h-4 text-[#f59e0b]" />
                          <span className="text-xs text-[#f59e0b] font-medium">PENDING</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground">
                      {shift.driver?.full_name || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {shift.vehicle?.registration || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(shift.started_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {shift.odometer_photo_url ? (
                        <CheckCircle className="w-4 h-4 text-[#10b981]" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#ef4444]" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {shift.odometer_photo_url && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewPhoto(shift)}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                            {shift.odometer_approved === null && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleApprove(shift.id)}
                                  className="bg-[#10b981] hover:bg-[#10b981]/90"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleReject(shift.id)}
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Photo Viewer Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Odometer Photo Review</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Driver:</span> {selectedPhoto.shift.driver?.full_name}
                </div>
                <div>
                  <span className="font-medium">Vehicle:</span> {selectedPhoto.shift.vehicle?.registration}
                </div>
                <div>
                  <span className="font-medium">Started:</span> {new Date(selectedPhoto.shift.started_at).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Status:</span> {selectedPhoto.shift.status}
                </div>
              </div>
              <div className="border border-border rounded-lg overflow-hidden bg-muted">
                <img 
                  src={selectedPhoto.url} 
                  alt="Odometer" 
                  className="w-full h-auto"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%23ddd"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23999"%3EImage not available%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>
              {selectedPhoto.shift.odometer_approved === null && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="default"
                    onClick={() => handleApprove(selectedPhoto.shift.id)}
                    className="bg-[#10b981] hover:bg-[#10b981]/90"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleReject(selectedPhoto.shift.id)}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
