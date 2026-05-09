import { createClient } from '@supabase/supabase-js';

function getMissingEnvVars() {
  const missing = [];
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  return missing;
}

export async function createDriver(req, res) {
  // Extract the Bearer token from the Authorization header
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const missingEnvVars = getMissingEnvVars();
  if (missingEnvVars.length > 0) {
    console.error('createDriver: missing required env vars:', missingEnvVars.join(', '));
    return res.status(500).json({ error: `Missing ${missingEnvVars.join(', ')}` });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Create a Supabase client with the service role key to verify the requester's JWT and perform admin operations
  const serviceRoleClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify token and get user
  const { data: userData, error: userError } = await serviceRoleClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  const requesterId = userData.user.id;

  // Check that the requester has admin role in the profiles table
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

  // Validate request body
  const { email, password, full_name, name } = req.body || {};
  const providedName = typeof full_name === 'string' && full_name.trim().length > 0
    ? full_name.trim()
    : typeof name === 'string' && name.trim().length > 0
      ? name.trim()
      : null;
  if (!email || !password || !providedName) {
    return res.status(400).json({ error: 'email, password, and name are required' });
  }

  let authUserId = null;
  let createdAuthUserInThisRequest = false;

  const { data: existingUsersData, error: existingUsersError } = await serviceRoleClient.auth.admin.listUsers();
  if (existingUsersError) {
    console.error('createDriver: auth.admin.listUsers error=', existingUsersError);
    return res.status(500).json({ error: existingUsersError.message || 'Failed to check existing users' });
  }

  const existingUser = (existingUsersData?.users ?? []).find(
    (user) => (user.email ?? '').toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    authUserId = existingUser.id;
  } else {
    // Create the new user in Supabase Auth using service role
    const { data: newUser, error: createError } = await serviceRoleClient.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: providedName, status: 'active' },
      email_confirm: true,
    });
    if (createError || !newUser?.user) {
      console.error('createDriver: auth.admin.createUser error=', createError);
      return res.status(400).json({ error: createError?.message || 'Failed to create auth user' });
    }

    authUserId = newUser.user.id;
    createdAuthUserInThisRequest = true;
  }

  if (!authUserId) {
    return res.status(500).json({ error: 'Failed to resolve auth user id' });
  }

  const { error: profileUpsertError } = await serviceRoleClient
    .from('profiles')
    .upsert({
      id: authUserId,
      full_name: providedName,
      role: 'driver',
    });

  if (profileUpsertError) {
    if (createdAuthUserInThisRequest) {
      await serviceRoleClient.auth.admin.deleteUser(authUserId);
    }
    console.error('createDriver: profiles upsert error=', profileUpsertError);
    return res.status(500).json({ error: profileUpsertError.message || 'Failed to upsert profile' });
  }

  // Ensure a corresponding record exists in drivers table linked by user_id
  const { data: driverRecord, error: insertError } = await serviceRoleClient
    .from('drivers')
    .upsert({
      user_id: authUserId,
      full_name: providedName,
      status: 'active',
    }, {
      onConflict: 'user_id',
    })
    .select()
    .single();
  if (insertError) {
    console.error('createDriver: drivers insert error=', insertError);
    // Attempt to clean up the created auth user to avoid orphaned accounts
    if (createdAuthUserInThisRequest) {
      await serviceRoleClient.auth.admin.deleteUser(authUserId);
    }
    return res.status(500).json({ error: insertError.message || 'Failed to insert driver record' });
  }

  // Log the admin action in the audit log (best-effort, non-blocking)
  serviceRoleClient.from('admin_audit_logs').insert({
    admin_id: requesterId,
    action: 'create_driver',
    target_type: 'driver',
    target_id: authUserId,
    metadata: {
      email,
      full_name: providedName,
      created_auth_user: createdAuthUserInThisRequest,
    },
  }).then(({ error: auditError }) => {
    if (auditError) console.warn('createDriver: audit log insert failed=', auditError);
  });

  return res.status(201).json({ driver: driverRecord });
}
