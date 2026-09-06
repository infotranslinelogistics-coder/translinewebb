import { countTotalDrivers } from './drivers';
import {
  countActiveShifts,
  countDistinctDriversOnActiveShifts,
  countDistinctVehiclesOnActiveShifts,
  countTodayShifts,
  countForceEndedToday,
} from './shifts';
import { countTotalVehicles, countVehiclesInMaintenance } from './vehicles';
import { countPendingMaintenance } from './maintenance';
import { countAdminActionsToday } from './adminAudit';

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
}

export interface LiveMonitor {
  activeShiftCount: number;
  forceEndedToday: number;
  adminActionsToday: number;
}

export async function getLiveMonitor(): Promise<LiveMonitor> {
  const [activeShiftCount, forceEndedToday, adminActionsToday] = await Promise.all([
    countActiveShifts(),
    countForceEndedToday(),
    countAdminActionsToday().catch(() => 0),
  ]);
  return { activeShiftCount, forceEndedToday, adminActionsToday };
}
