# TransLine Full System E2E Checklist

This checklist is aligned with the current assignment model:
- Assignment source of truth: `vehicle_assignments`
- Active assignment: `unassigned_at IS NULL`
- Canonical assignment RPCs: `assign_vehicle`, `unassign_driver`
- Assignment truth is distinct from telemetry/status truth

---

## 1) Core setup checks

- [ ] Portal loads without crashing
- [ ] Driver app opens without crashing
- [ ] Admin can log into portal
- [ ] Driver can log into app
- [ ] Supabase connection works in both
- [ ] No obvious console errors on first load
- [ ] No missing-table / missing-column / schema-cache errors
- [ ] Main pages open:
  - [ ] Drivers
  - [ ] Vehicles
  - [ ] Driver Profile
  - [ ] Live Map
  - [ ] Shift-related screens
  - [ ] Odometer-related screens

---

## 2) Assignment lifecycle checklist

### Assign vehicle from Vehicles page
- [ ] Open Vehicles page
- [ ] Choose an unassigned vehicle
- [ ] Assign a driver and save
- [ ] Confirm vehicle now shows assigned driver
- [ ] Confirm driver now shows current vehicle on Drivers page
- [ ] Refresh page and confirm assignment persists
- [ ] Confirm no duplicate active assignment appears

### Assign vehicle from Drivers page
- [ ] Open Drivers page
- [ ] Choose a driver
- [ ] Assign a vehicle and save
- [ ] Confirm driver now shows assigned vehicle
- [ ] Confirm Vehicles page shows same assignment
- [ ] Refresh and confirm data is still correct

### Reassign driver to another vehicle
- [ ] Start with driver already assigned
- [ ] Assign that same driver to a different vehicle
- [ ] Confirm old assignment is closed
- [ ] Confirm new vehicle becomes active assignment
- [ ] Confirm only one active assignment exists in UI
- [ ] Confirm both Drivers and Vehicles pages agree

### Reassign vehicle to another driver
- [ ] Start with vehicle already assigned
- [ ] Assign a different driver to that vehicle
- [ ] Confirm previous driver is no longer active on that vehicle
- [ ] Confirm new driver becomes current driver
- [ ] Confirm no duplicate active assignment appears

### Unassign from Vehicles page
- [ ] Open a vehicle with active driver
- [ ] Unassign
- [ ] Confirm vehicle shows no current driver
- [ ] Confirm corresponding driver shows no current vehicle
- [ ] Refresh and confirm unassignment persisted

### Unassign from Drivers page
- [ ] Open a driver with active vehicle
- [ ] Unassign
- [ ] Confirm driver shows no current vehicle
- [ ] Confirm vehicle shows no assigned driver
- [ ] Refresh and confirm state remains correct

### Unassign driver from all vehicles
- [ ] Use any driver-level unassign flow
- [ ] Confirm all active assignments for that driver are closed
- [ ] Confirm no current vehicle remains for that driver
- [ ] Confirm no stale assignment remains on Vehicles page

### Delete driver with active assignment
- [ ] Pick driver who currently has a vehicle
- [ ] Delete driver
- [ ] Confirm delete succeeds
- [ ] Confirm vehicle becomes unassigned
- [ ] Confirm deleted driver disappears from list
- [ ] Confirm no broken rows remain in driver list or vehicle list

### Assignment truth vs telemetry truth
- [ ] Open Driver Profile
- [ ] Confirm Assigned Vehicle reflects assignment system
- [ ] Confirm Telemetry Vehicle is shown separately if available
- [ ] Confirm they are not mislabeled as the same thing
- [ ] Open Live Map
- [ ] Confirm any vehicle shown there is clearly telemetry-related, not assignment truth
- [ ] Confirm wording makes sense to admin user

---

## 3) Driver account and profile checklist

### Driver creation
- [ ] Create a new driver from portal
- [ ] Confirm required fields save correctly
- [ ] Confirm no profile/full_name mismatch errors
- [ ] Confirm new driver appears in Drivers page
- [ ] Confirm driver can be assigned a vehicle

### Driver editing
- [ ] Edit driver details and save
- [ ] Confirm changes appear immediately
- [ ] Refresh and confirm persistence

### Driver delete
- [ ] Delete unassigned driver
- [ ] Confirm success and disappearance from list

### Driver profile page
- [ ] Open driver profile
- [ ] Confirm page loads
- [ ] Confirm assignment history appears
- [ ] Confirm current assigned vehicle appears correctly
- [ ] Confirm telemetry vehicle is separated if shown
- [ ] Confirm no broken labels, empty placeholders, or wrong field names

---

## 4) Vehicle management checklist

### Vehicle creation
- [ ] Create vehicle
- [ ] Confirm it appears in list
- [ ] Confirm registration/rego displays correctly
- [ ] Confirm no dependence on `plate_number` where `rego` should be shown

### Vehicle editing
- [ ] Edit vehicle details and save
- [ ] Refresh and confirm persistence

### Vehicle assignment display
- [ ] Confirm assigned driver shows correctly
- [ ] Confirm unassigned vehicles show clearly as unassigned
- [ ] Confirm dropdowns use correct vehicle IDs and readable labels

### Vehicle deletion
- [ ] Delete unassigned vehicle (if supported)
- [ ] Confirm no UI corruption after delete
- [ ] Confirm list refreshes properly

---

## 5) Shift flow checklist

### Start shift with valid assignment
- [ ] Driver logs into app
- [ ] Driver has active assigned vehicle
- [ ] Start pre-shift flow
- [ ] Confirm assigned vehicle is shown correctly
- [ ] Start shift successfully

### Start shift with no assignment
- [ ] Driver has no active vehicle assignment
- [ ] Try to start shift
- [ ] Confirm app blocks shift start properly
- [ ] Confirm error message is clear

### Start shift with wrong active assignment state
- [ ] If driver has active shift tied to different vehicle, test conflict handling
- [ ] Confirm app warns clearly
- [ ] Confirm app does not silently continue with wrong vehicle

### End shift
- [ ] End active shift
- [ ] Confirm post-shift flow appears
- [ ] Confirm shift closes successfully
- [ ] Confirm app returns to correct state

### Shift visibility in portal
- [ ] Confirm active shifts appear correctly in portal (if applicable)
- [ ] Confirm ended shifts no longer appear as active
- [ ] Confirm no duplicate shift state

---

## 6) Odometer workflow checklist

### Pre-shift odometer capture
- [ ] Driver begins pre-shift flow
- [ ] Confirm odometer capture requires camera (if intended)
- [ ] Confirm gallery upload behavior matches intended rules
- [ ] Take odometer photo
- [ ] Confirm upload succeeds
- [ ] Confirm odometer value saves
- [ ] Confirm timestamp is recorded
- [ ] Confirm GPS/location data is attached (if required)
- [ ] Confirm shift linkage is correct

### Post-shift odometer capture
- [ ] End shift
- [ ] Capture ending odometer
- [ ] Confirm upload succeeds
- [ ] Confirm value, photo, timestamp, and location save correctly
- [ ] Confirm linkage to correct driver, vehicle, and shift

### Missing GPS handling
- [ ] Deny location permission or simulate no location
- [ ] Confirm app blocks or warns if GPS is required
- [ ] Confirm message is understandable

### Odometer photo storage
- [ ] Confirm photos upload to expected storage path/bucket
- [ ] Confirm admin can view/read uploaded photos where intended
- [ ] Confirm file path format is consistent
- [ ] Confirm wrong-bucket / permission issues do not occur

### Odometer history in portal
- [ ] Open relevant admin view/profile
- [ ] Confirm odometer logs show correct values
- [ ] Confirm photos open correctly (if supported)
- [ ] Confirm timestamps look right
- [ ] Confirm no mismatched driver/vehicle/shift associations

---

## 7) Fuel workflow checklist

### Fuel entry creation
- [ ] Add fuel log from intended flow
- [ ] Confirm amount/volume saves
- [ ] Confirm cost saves
- [ ] Confirm date/time saves
- [ ] Confirm vehicle link is correct
- [ ] Confirm driver link is correct (if applicable)

### Fuel receipt/photo upload
- [ ] Upload receipt/image (if supported)
- [ ] Confirm upload succeeds
- [ ] Confirm image opens later
- [ ] Confirm no storage permission issues

### Fuel history display
- [ ] Open fuel history/admin view
- [ ] Confirm latest entry appears
- [ ] Confirm values display correctly
- [ ] Confirm totals/summaries are accurate (if shown)

### Fuel entry validation
- [ ] Try missing required fields
- [ ] Confirm UI validation catches it
- [ ] Try unrealistic values
- [ ] Confirm system handles gracefully

---

## 8) Uploads checklist

Applies to odometer, fuel receipts, vehicle photos, log photos, and shift-related uploads.

### General upload checks
- [ ] Upload succeeds on good connection
- [ ] Upload does not silently fail
- [ ] Error message appears on failed upload
- [ ] Uploaded file links to correct record
- [ ] File opens afterward
- [ ] File path naming looks consistent
- [ ] Storage bucket is correct
- [ ] Permissions are correct for driver/admin roles

### Upload retry behavior
- [ ] Simulate failed upload
- [ ] Retry
- [ ] Confirm retry works
- [ ] Confirm no duplicate broken records are created

### Upload visibility
- [ ] Driver can upload only what they should
- [ ] Admin can view what they should
- [ ] Public/unauthorized access is not accidentally allowed

### Upload metadata
- [ ] Timestamp recorded
- [ ] Correct driver recorded
- [ ] Correct vehicle recorded
- [ ] Correct shift recorded (where applicable)
- [ ] GPS metadata included where required

---

## 9) Live tracking / telemetry checklist

### Driver location updates
- [ ] Start active shift
- [ ] Confirm location updates begin
- [ ] Confirm portal live map shows driver
- [ ] Confirm coordinates update over time

### Telemetry labeling
- [ ] Confirm vehicle shown on live map is clearly telemetry-related where appropriate
- [ ] Confirm admin is not misled into thinking telemetry vehicle always equals assigned vehicle

### Driver presence/status
- [ ] Confirm online/offline/break/driving/idle states update as expected
- [ ] Confirm status changes appear in portal (if supported)
- [ ] Confirm stale states clear when driver disconnects or ends shift

### Map stability
- [ ] Live map page loads
- [ ] Driver markers render correctly
- [ ] Vehicle filters still work
- [ ] Selecting driver does not crash page
- [ ] No broken map tiles or fatal errors

---

## 10) Maintenance / inspections checklist

### Maintenance item creation
- [ ] Add maintenance item
- [ ] Confirm save works
- [ ] Confirm it appears in list

### Maintenance log creation
- [ ] Log maintenance against vehicle
- [ ] Confirm vehicle link is correct
- [ ] Confirm date/details are correct

### Maintenance visibility
- [ ] Open vehicle details/history
- [ ] Confirm maintenance appears in correct place
- [ ] Confirm no cross-linking to wrong vehicle

### Maintenance upload/photo
- [ ] Upload evidence/photo (if supported)
- [ ] Confirm file saves and opens

---

## 11) Portal reliability checklist

### Refetch / stale UI
- [ ] After assign/unassign, confirm UI refreshes correctly
- [ ] After create/edit/delete, confirm list updates correctly
- [ ] Confirm no stale badge or stale current vehicle remains

### Error handling
- [ ] Trigger intentional failures
- [ ] Confirm errors are readable
- [ ] Confirm app does not hang on spinner forever
- [ ] Confirm user can recover without full page reset

### Reload safety
- [ ] Refresh each major page
- [ ] Confirm state reloads correctly from backend
- [ ] Confirm pages do not only “look right” until refresh

### Console sanity
- [ ] Watch browser console while testing
- [ ] Confirm no repeated red errors
- [ ] Note minor warnings if present

---

## 12) Driver app reliability checklist

### Login
- [ ] Driver can log in
- [ ] Wrong credentials show proper error
- [ ] App does not hang on login

### Assignment fetch
- [ ] Driver with assignment sees correct vehicle
- [ ] Driver without assignment sees clear empty state
- [ ] Refresh/reopen app keeps correct result

### Permissions
- [ ] Camera permission flow works
- [ ] Location permission flow works
- [ ] Denied permission path is handled clearly

### App resume / reconnect
- [ ] Background app and reopen
- [ ] Confirm active shift state remains correct
- [ ] Confirm app does not lose assignment unexpectedly
- [ ] Confirm telemetry resumes if applicable

---

## 13) Cross-page consistency checklist

Compare the same driver/vehicle pair across:
- Drivers page
- Vehicles page
- Driver Profile
- Live Map
- Shift screen
- Odometer screen

Confirm:
- [ ] Assigned vehicle is the same everywhere assignment truth is intended
- [ ] Telemetry vehicle is only shown where telemetry truth is intended
- [ ] Labels are consistent
- [ ] Vehicle rego is displayed consistently
- [ ] No page uses legacy direct-FK terminology

---

## 14) Final regression pass

- [ ] Create driver
- [ ] Create vehicle
- [ ] Assign vehicle
- [ ] Start shift
- [ ] Upload pre-shift odometer
- [ ] Update live location
- [ ] Add fuel entry
- [ ] End shift
- [ ] Upload post-shift odometer
- [ ] Unassign vehicle
- [ ] Delete driver

If the full chain passes cleanly, the system is in a strong state.
