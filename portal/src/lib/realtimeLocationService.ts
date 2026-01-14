import { supabase } from './supabase-client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { LocationLog } from '../types/location';

type LocationCallback = (location: LocationLog) => void;

class RealtimeLocationService {
  private channel: RealtimeChannel | null = null;
  private callbacks: Set<LocationCallback> = new Set();

  subscribe(callback: LocationCallback): () => void {
    this.callbacks.add(callback);

    if (!this.channel) {
      this.startListening();
    }

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
      if (this.callbacks.size === 0) {
        this.stopListening();
      }
    };
  }

  private startListening() {
    this.channel = supabase
      .channel('location_updates')
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_logs'
        },
        (payload) => {
          const location = payload.new as LocationLog;
          this.callbacks.forEach(callback => callback(location));
        }
      )
      .subscribe();
  }

  private stopListening() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
  }

  async getLatestLocations(driverId?: string): Promise<LocationLog[]> {
    let query = supabase
      .from('location_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (driverId) {
      query = query.eq('driver_id', driverId);
    }

    const { data, error } = await query.limit(100);

    if (error) throw error;
    return data || [];
  }

  async getDriverLocations(driverId: string, limit: number = 100): Promise<LocationLog[]> {
    const { data, error } = await supabase
      .from('location_logs')
      .select('*')
      .eq('driver_id', driverId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }
}

export const realtimeLocationService = new RealtimeLocationService();
