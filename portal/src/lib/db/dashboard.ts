// Dashboard data access layer
import { supabase } from '../supabase';
import { countTotalDrivers } from './drivers';
import { countTotalVehicles, countVehiclesInMaintenance } from './vehicles';
import {
  countActiveShifts,
  countDistinctDriversOnActiveShifts,
  countDistinctVehiclesOnActiveShifts,
  countTodayShifts,
} from './shifts';
import { countPendingMaintenance } from './maintenance';

export interface DashboardStats {
  totalDrivers: number;
  activeDrivers: number;
  totalVehicles: number;
  activeVehicles: number;
  vehiclesInMaintenance: number;
  activeShifts: number;
  todayShifts: number;
  pendingMaintenance: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const [
      totalDrivers,
      activeDrivers,
      totalVehicles,
      activeVehicles,
      vehiclesInMaintenance,
      activeShifts,
      todayShifts,
      pendingMaintenance,
    ] = await Promise.all([
      countTotalDrivers(),
      countDistinctDriversOnActiveShifts(),
      countTotalVehicles(),
      countDistinctVehiclesOnActiveShifts(),
      countVehiclesInMaintenance(),
      countActiveShifts(),
      countTodayShifts(),
      countPendingMaintenance(),
    ]);

    return {
      totalDrivers,
      activeDrivers,
      totalVehicles,
      activeVehicles,
      vehiclesInMaintenance,
      activeShifts,
      todayShifts,
      pendingMaintenance,
    };
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    throw error;
  }
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details?: string;
  created_at: string;
}

export async function listActivityLogs(limit: number = 20): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function createActivityLog(log: Omit<ActivityLog, 'id' | 'created_at'>): Promise<ActivityLog> {
  const { data, error } = await supabase
    .from('activity_logs')
    .insert([log])
    .select()
    .single();

  if (error) throw error;
  return data;
}
