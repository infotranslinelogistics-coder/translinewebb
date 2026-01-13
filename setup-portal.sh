#!/bin/bash
set -e

# Create /portal directory structure
sudo mkdir -p /portal/src/{components/ui,utils/supabase,assets}
sudo mkdir -p /portal/public
sudo chown -R $(whoami):$(whoami) /portal

# Copy portal files from workspace to /portal
# Copy extracted components
cp /workspaces/Translineweb/portal_extracted/AdminOverrides.tsx /portal/src/components/
cp /workspaces/Translineweb/portal_extracted/DriversManagement.tsx /portal/src/components/
cp /workspaces/Translineweb/portal_extracted/EventLogs.tsx /portal/src/components/
cp /workspaces/Translineweb/portal_extracted/LiveShiftsMonitor.tsx /portal/src/components/
cp /workspaces/Translineweb/portal_extracted/OdometerReview.tsx /portal/src/components/
cp /workspaces/Translineweb/portal_extracted/OverviewDashboard.tsx /portal/src/components/
cp /workspaces/Translineweb/portal_extracted/ShiftDetailView.tsx /portal/src/components/
cp /workspaces/Translineweb/portal_extracted/VehiclesManagement.tsx /portal/src/components/

# Copy UI components
cp /workspaces/Translineweb/portal_extracted/ui/* /portal/src/components/ui/

# Copy utilities
cp /workspaces/Translineweb/portal_extracted/info.tsx /portal/src/utils/supabase/
cp /workspaces/Translineweb/portal_extracted/kv_store.tsx /portal/src/utils/supabase/
cp /workspaces/Translineweb/portal_extracted/globals.css /portal/src/

# Copy figma components
cp -r /workspaces/Translineweb/portal_extracted/figma /portal/src/components/

# Copy main portal App.tsx and related files
cp /workspaces/Translineweb/portal/App.tsx /portal/src/

# List what was created
echo "Portal structure created at /portal:"
find /portal -type f | sort

echo "Setup complete!"
