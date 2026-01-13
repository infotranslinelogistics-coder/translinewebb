import { useState, useEffect } from 'react';
import { Camera, Eye } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Button } from './ui/button';
import { Card } from './ui/card';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-987e9da2`;

interface OdometerReviewProps {
  onViewShift: (shiftId: string) => void;
}

export function OdometerReview({ onViewShift }: OdometerReviewProps) {
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      const response = await fetch(`${API_BASE}/odometer-photos`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await response.json();
      setPhotos(data.photos || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching odometer photos:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading odometer photos...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Odometer & Media Review</h2>
        <p className="text-sm text-muted-foreground mt-1">Gallery view of uploaded odometer photos</p>
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-12">
          <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No odometer photos uploaded yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {photos.map((photo, idx) => (
            <Card key={idx} className="bg-card border border-border overflow-hidden">
              <div className="aspect-video bg-muted relative">
                <img
                  src={photo.photo_url}
                  alt={`${photo.type} odometer`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2">
                  <div
                    className={`px-2 py-1 rounded text-xs font-bold ${
                      photo.type === 'start'
                        ? 'bg-[#10b981] text-white'
                        : 'bg-[#1e90ff] text-white'
                    }`}
                  >
                    {photo.type.toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Shift ID</span>
                    <span className="text-xs font-mono text-foreground">{photo.shift_id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Driver</span>
                    <span className="text-xs text-foreground">{photo.driver_id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Vehicle</span>
                    <span className="text-xs text-foreground">{photo.vehicle_id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Timestamp</span>
                    <span className="text-xs text-foreground">
                      {new Date(photo.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onViewShift(photo.shift_id)}
                  className="w-full text-xs"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  View Shift
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
