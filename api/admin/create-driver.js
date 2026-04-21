import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const supabaseAnon = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRole);

    /* ---------------------------------- */
    /* verify logged in user              */
    /* ---------------------------------- */

    const { data: userData, error: userError } =
      await supabaseAnon.auth.getUser();

    if (userError || !userData?.user) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const userId = userData.user.id;

    /* ---------------------------------- */
    /* verify admin role                  */
    /* ---------------------------------- */

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (!profile || profile.role !== "admin") {
      return res.status(403).json({ error: "Not admin" });
    }

    /* ---------------------------------- */
    /* get body                           */
    /* ---------------------------------- */

    const { email, full_name, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    const safeName =
      (full_name && full_name.trim() !== "")
        ? full_name
        : (name && name.trim() !== "")
          ? name
          : email.split("@")[0];

    /* ---------------------------------- */
    /* find existing auth user            */
    /* ---------------------------------- */

    let authUserId;

    const { data: existingUsers } =
      await supabaseAdmin.auth.admin.listUsers();

    const existing = existingUsers.users.find(
      u => u.email.toLowerCase() === email.toLowerCase()
    );

    if (existing) {

      authUserId = existing.id;

    } else {

      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true
        });

      if (createError) {
        return res.status(500).json({ error: createError.message });
      }

      authUserId = newUser.user.id;
    }

    /* ---------------------------------- */
    /* upsert profile                     */
    /* ---------------------------------- */

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authUserId,
        full_name: safeName,
        role: "driver"
      });

    if (profileError) {
      return res.status(500).json({ error: profileError.message });
    }

    /* ---------------------------------- */
    /* upsert driver                      */
    /* ---------------------------------- */

    const { error: driverError } = await supabaseAdmin
      .from("drivers")
      .upsert({
        user_id: authUserId,
        status: "active"
      });

    if (driverError) {
      return res.status(500).json({ error: driverError.message });
    }

    /* ---------------------------------- */
    /* audit log                          */
    /* ---------------------------------- */

    await supabaseAdmin
      .from("admin_audit_logs")
      .insert({
        admin_id: userId,
        action: "create_driver",
        target_user: authUserId
      });

    return res.status(200).json({
      success: true,
      user_id: authUserId
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      error: "Server error",
      detail: err.message
    });

  }

}
