export type DrawerParamList = {
  Dashboard: undefined;
  Drivers: undefined;
  DriverProfile: { driverId: string };
  Vehicles: undefined;
  VehicleProfile: { vehicleId: string };
  LiveMap: undefined;
  Shifts: undefined;
  ShiftDetail: { shiftId: string };
  FuelLogs: undefined;
  OdometerLogs: undefined;
  ChecklistApprovals: undefined;
  Maintenance: undefined;
  Logs: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};
