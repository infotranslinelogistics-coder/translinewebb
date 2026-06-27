import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

function getMissingEnvVars() {
  const missing = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!serviceRole) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!anonKey) missing.push('SUPABASE_ANON_KEY');
  return missing;
}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const missingEnvVars = getMissingEnvVars();
    if (missingEnvVars.length > 0) {
      console.error('api/list-driver-emails: missing required env vars:', missingEnvVars.join(', '));
      return res.status(500).json({ error: `Missing ${missingEnvVars.join(', ')}` });
    }

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

    const { user_ids } = req.body;

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: 'user_ids must be a non-empty array' });
    }

    const wanted = new Set(user_ids);
    const emails = {};

    /* ---------------------------------- */
    /* paginate through auth users        */
    /* ---------------------------------- */

    let page = 1;
    const perPage = 1000;
    while (Object.keys(emails).length < wanted.size && page < 50) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      for (const u of data.users) {
        if (wanted.has(u.id)) {
          emails[u.id] = u.email ?? null;
        }
      }

      if (data.users.length < perPage) break;
      page += 1;
    }

    return res.status(200).json({ emails });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      error: "Server error",
      detail: err.message
    });

  }

}
