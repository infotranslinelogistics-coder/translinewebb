import { createClient } from '@supabase/supabase-js';

function getMissingEnvVars() {
  const missing = [];
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  return missing;
}

export async function deleteDriver(req, res) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Admin session expired. Please log in again.' });
  }

  const missingEnvVars = getMissingEnvVars();
  if (missingEnvVars.length > 0) {
    console.error('deleteDriver: missing required env vars:', missingEnvVars.join(', '));
    return res.status(500).json({ error: `Missing ${missingEnvVars.join(', ')}` });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceRoleClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await serviceRoleClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Admin session expired. Please log in again.' });
  }
  const requesterId = userData.user.id;

  const { data: profile, error: profileError } = await serviceRoleClient
    .from('profiles')
    .select('role')
    .eq('id', requesterId)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: 'Requester profile not found' });
  }
  if (profile.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: admin role required' });
  }

  const { driver_id: driverId } = req.body || {};
  if (!driverId || typeof driverId !== 'string') {
    return res.status(400).json({ error: 'driver_id is required' });
  }

  const { data: driver, error: driverLookupError } = await serviceRoleClient
    .from('drivers')
    .select('id, user_id, full_name')
    .eq('id', driverId)
    .single();

  if (driverLookupError || !driver) {
    return res.status(404).json({ error: 'Driver not found' });
  }

  const endedAt = new Date().toISOString();

  const { error: assignmentsError } = await serviceRoleClient
    .from('vehicle_assignments')
    .delete()
    .eq('driver_id', driverId);
  if (assignmentsError) {
    console.error('deleteDriver: vehicle_assignments cleanup error=', assignmentsError);
    return res.status(500).json({ error: assignmentsError.message || 'Failed to clean vehicle assignments' });
  }

  const { error: presenceError } = await serviceRoleClient
    .from('driver_presence')
    .delete()
    .eq('driver_id', driverId);
  if (presenceError) {
    console.error('deleteDriver: driver_presence cleanup error=', presenceError);
    return res.status(500).json({ error: presenceError.message || 'Failed to clean driver presence' });
  }

  const { error: activeShiftsError } = await serviceRoleClient
    .from('shifts')
    .update({
      status: 'cancelled',
      ended_at: endedAt,
    })
    .eq('driver_id', driverId)
    .is('ended_at', null);
  if (activeShiftsError) {
    console.error('deleteDriver: active shifts cleanup error=', activeShiftsError);
    return res.status(500).json({ error: activeShiftsError.message || 'Failed to close active shifts' });
  }

  const { error: deleteDriverRowError } = await serviceRoleClient
    .from('drivers')
    .delete()
    .eq('id', driverId);
  if (deleteDriverRowError) {
    console.error('deleteDriver: drivers delete error=', deleteDriverRowError);
    return res.status(500).json({ error: deleteDriverRowError.message || 'Failed to delete driver row' });
  }

  if (driver.user_id) {
    const { error: deleteAuthUserError } = await serviceRoleClient.auth.admin.deleteUser(driver.user_id);
    if (deleteAuthUserError) {
      console.error('deleteDriver: auth user delete error=', deleteAuthUserError);
      return res.status(500).json({ error: deleteAuthUserError.message || 'Failed to delete auth user' });
    }
  }

  serviceRoleClient.from('admin_audit_logs').insert({
    admin_id: requesterId,
    action: 'delete_driver',
    target_type: 'driver',
    target_id: driverId,
    metadata: {
      auth_user_id: driver.user_id,
      full_name: driver.full_name ?? null,
    },
  }).then(({ error: auditError }) => {
    if (auditError) console.warn('deleteDriver: audit log insert failed=', auditError);
  });

  return res.status(200).json({ success: true, driver_id: driverId, user_id: driver.user_id ?? null });
}
