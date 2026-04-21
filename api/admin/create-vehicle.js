import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const supabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'Missing auth token' })
    }

    // Validate caller
    const { data: userData, error: userError } =
      await supabaseClient.auth.getUser(token)
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    const requesterId = userData.user.id

    // Check admin role
    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', requesterId)
        .single()

    if (profileError) {
      console.error('Admin profile lookup failed:', profileError.message)
      return res.status(500).json({ error: 'Failed to verify admin role' })
    }

    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Not admin' })
    }

    // Validate body
    const { rego, make, model } = req.body
    if (!rego) {
      return res.status(400).json({ error: 'Missing required field: rego' })
    }

    // Check rego not already in use
    const { data: existing } = await supabaseAdmin
      .from('vehicles')
      .select('id')
      .eq('rego', rego.toUpperCase().trim())
      .single()

    if (existing) {
      return res.status(409).json({ error: 'A vehicle with this rego already exists' })
    }

    // Create vehicle
    const { data: vehicle, error: vehicleError } =
      await supabaseAdmin
        .from('vehicles')
        .insert({
          rego: rego.toUpperCase().trim(),
          make: make || null,
          model: model || null,
          is_active: true,
          status: 'active'
        })
        .select('id, rego, make, model, status')
        .single()

    if (vehicleError) {
      console.error('Vehicle creation failed:', vehicleError.message)
      return res.status(500).json({ error: 'Failed to create vehicle', details: vehicleError.message })
    }

    // Audit log (non-blocking)
    supabaseAdmin
      .from('admin_audit_logs')
      .insert({
        admin_id: requesterId,
        action: 'create_vehicle',
        details: { rego, make, model }
      })
      .then(({ error }) => {
        if (error) console.warn('Audit log failed (non-blocking):', error.message)
      })

    return res.status(200).json({ success: true, vehicle })

  } catch (err) {
    console.error('CREATE VEHICLE CRASH:', err)
    return res.status(500).json({
      error: 'Unexpected server error',
      details: err.message
    })
  }
}
