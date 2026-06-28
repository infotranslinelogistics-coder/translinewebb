import 'react-native-url-polyfill/auto';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import DriversScreen from './src/screens/DriversScreen';
import DriverProfileScreen from './src/screens/DriverProfileScreen';
import VehiclesScreen from './src/screens/VehiclesScreen';
import VehicleProfileScreen from './src/screens/VehicleProfileScreen';
import LiveMapScreen from './src/screens/LiveMapScreen';
import ShiftsScreen from './src/screens/ShiftsScreen';
import ShiftDetailScreen from './src/screens/ShiftDetailScreen';
import FuelLogsScreen from './src/screens/FuelLogsScreen';
import OdometerLogsScreen from './src/screens/OdometerLogsScreen';
import ChecklistApprovalsScreen from './src/screens/ChecklistApprovalsScreen';
import MaintenanceScreen from './src/screens/MaintenanceScreen';
import LogsScreen from './src/screens/LogsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import type { DrawerParamList, RootStackParamList } from './src/types/navigation';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

function MainDrawer() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0B0B0B' },
        headerTintColor: '#FFFFFF',
        drawerStyle: { backgroundColor: '#0B0B0B' },
        drawerActiveTintColor: '#FF6B35',
        drawerInactiveTintColor: '#9CA3AF',
        sceneStyle: { backgroundColor: '#0B0B0B' },
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} />
      <Drawer.Screen name="Drivers" component={DriversScreen} />
      <Drawer.Screen
        name="DriverProfile"
        component={DriverProfileScreen}
        options={{ drawerItemStyle: { display: 'none' }, title: 'Driver' }}
      />
      <Drawer.Screen name="Vehicles" component={VehiclesScreen} />
      <Drawer.Screen
        name="VehicleProfile"
        component={VehicleProfileScreen}
        options={{ drawerItemStyle: { display: 'none' }, title: 'Vehicle' }}
      />
      <Drawer.Screen name="LiveMap" component={LiveMapScreen} options={{ title: 'Live Map' }} />
      <Drawer.Screen name="Shifts" component={ShiftsScreen} />
      <Drawer.Screen
        name="ShiftDetail"
        component={ShiftDetailScreen}
        options={{ drawerItemStyle: { display: 'none' }, title: 'Shift' }}
      />
      <Drawer.Screen name="FuelLogs" component={FuelLogsScreen} options={{ title: 'Fuel Logs' }} />
      <Drawer.Screen name="OdometerLogs" component={OdometerLogsScreen} options={{ title: 'Odometer Logs' }} />
      <Drawer.Screen
        name="ChecklistApprovals"
        component={ChecklistApprovalsScreen}
        options={{ title: 'Checklist Approvals' }}
      />
      <Drawer.Screen name="Maintenance" component={MaintenanceScreen} />
      <Drawer.Screen name="Logs" component={LogsScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
}

function RootNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0B0B', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#FF6B35" />
      </View>
    );
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <RootStack.Screen name="Main" component={MainDrawer} />
      ) : (
        <RootStack.Screen name="Login" component={LoginScreen} />
      )}
    </RootStack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
