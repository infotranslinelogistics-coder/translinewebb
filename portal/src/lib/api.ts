import { supabase } from './supabase-client';
import { Driver } from '../types/driver';

// Fetch dashboard stats
export async function fetchDashboardStats() {
  try {
    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .select('*')
      .eq('status', 'active');
    
    if (shiftsError) throw shiftsError;
    
    const { data: drivers, error: driversError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'driver')
      .eq('status', 'active');
    
    if (driversError) throw driversError;
    
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('*');
    
    if (vehiclesError) throw vehiclesError;
    
    const { data: failedEvents, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'failed');

    if (eventsError) throw eventsError;

    return {
      activeShiftsCount: shifts?.length || 0,
      activeDriversCount: drivers?.length || 0,
      vehiclesInUseCount: vehicles?.filter(v => v.assigned_driver_id).length || 0,
      alerts: {
        stuckShifts: shifts?.filter(s => {
          const duration = Date.now() - new Date(s.started_at).getTime();
          return duration > 12 * 60 * 60 * 1000;
        }).length || 0,
        missingOdometer: shifts?.filter(s => !s.odometer_photo_url).length || 0,
        failedEvents: failedEvents?.length || 0,
      },
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
}

// Fetch active shifts
export async function fetchActiveShifts() {
  const { data, error } = await supabase
    .from('shifts')
    .select(`
      *,
      driver:profiles!shifts_driver_id_fkey(id, full_name),
      vehicle:vehicles(id, registration, type)
    `)
    .eq('status', 'active')
    .order('started_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Fetch shift details including events
export async function fetchShiftDetails(shiftId: string) {
  const { data: shift, error: shiftError } = await supabase
    .from('shifts')
    .select(`
      *,
      driver:profiles!shifts_driver_id_fkey(id, full_name, phone),
      vehicle:vehicles(id, registration, type, depot)
    `)
    .eq('id', shiftId)
    .single();

  if (shiftError) throw shiftError;

  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .eq('shift_id', shiftId)
    .order('occurred_at', { ascending: true });

  if (eventsError) throw eventsError;

  // Fetch related data
  const { data: fuelLogs, error: fuelLogsError } = await supabase
    .from('fuel_logs')
    .select('*')
    .eq('shift_id', shiftId);

  if (fuelLogsError) throw fuelLogsError;

  const { data: incidents, error: incidentsError } = await supabase
    .from('incidents')
    .select('*')
    .eq('shift_id', shiftId);

  if (incidentsError) throw incidentsError;

  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('*')
    .eq('shift_id', shiftId);

  if (notesError) throw notesError;

  return {
    shift,
    events: events || [],
    fuelLogs: fuelLogs || [],
    incidents: incidents || [],
    notes: notes || [],
  };
}

// Fetch drivers
export async function fetchDrivers(): Promise<Driver[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'driver')
    .order('full_name');

  if (error) {
    console.error('Error fetching drivers:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    throw new Error(`Failed to fetch drivers: ${error.message} (${error.code || 'unknown'})`);
  }
  
  // Add 'name' alias for backwards compatibility
  return (data || []).map(driver => ({
    ...driver,
    name: driver.full_name // Ensure both fields exist
  })) as Driver[];
}

// Fetch vehicles
export async function fetchVehicles() {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('registration');

  if (error) throw error;
  return data || [];
}

// Admin action: Force end shift
export async function forceEndShift(shiftId: string, reason: string, adminName: string) {
  const { error } = await supabase
    .from('shifts')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString(),
      admin_ended_reason: reason,
      admin_ended_by: adminName,
    })
    .eq('id', shiftId);

  if (error) throw error;

  // Log admin action as event
  const { error: eventError } = await supabase.from('events').insert({
    shift_id: shiftId,
    event_type: 'admin_force_end',
    occurred_at: new Date().toISOString(),
    metadata: { reason, admin_name: adminName },
  });

  if (eventError) {
    console.error('Failed to log admin action event:', eventError);
    // Don't throw here as the shift was already ended successfully
  }

  // Log to admin_actions table
  await logAdminAction('force_end_shift', shiftId, 'shift', reason, { admin_name: adminName });
}

// Get odometer photo URL
export async function getOdometerPhotoUrl(path: string) {
  const { data } = supabase.storage
    .from('odometer-photos')
    .getPublicUrl(path);
  
  return data.publicUrl;
}

// Log admin action
export async function logAdminAction(
  actionType: string,
  targetId: string | null,
  targetType: string | null,
  reason: string | null,
  metadata: any = null
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated user');
    }

    // Get admin profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const { error } = await supabase.from('admin_actions').insert({
      admin_id: user.id,
      admin_name: profile?.full_name || user.email || 'Unknown Admin',
      action_type: actionType,
      target_id: targetId,
      target_type: targetType,
      reason: reason,
      metadata: metadata,
    });

    if (error) throw error;
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Don't throw - logging should not break the main action
  }
}

// Fetch admin actions/audit log
export async function fetchAdminActions(limit: number = 50) {
  const { data, error } = await supabase
    .from('admin_actions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Upload odometer photo
export async function uploadOdometerPhoto(file: File, shiftId: string): Promise<string> {
  try {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size exceeds 5MB limit.');
    }

    // Generate unique filename with validated extension
    const fileExt = file.type.split('/')[1]; // Get extension from MIME type
    const fileName = `${shiftId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('odometer-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Update shift record
    const { error: updateError } = await supabase
      .from('shifts')
      .update({ odometer_photo_url: filePath })
      .eq('id', shiftId);

    if (updateError) throw updateError;

    // Create event entry
    await supabase.from('events').insert({
      shift_id: shiftId,
      event_type: 'admin_odometer_upload',
      occurred_at: new Date().toISOString(),
      status: 'success',
      metadata: { file_path: filePath },
    });

    // Log admin action
    await logAdminAction('upload_odometer', shiftId, 'shift', 'Admin uploaded odometer photo', { file_path: filePath });

    return filePath;
  } catch (error) {
    console.error('Error uploading odometer photo:', error);
    throw error;
  }
}
