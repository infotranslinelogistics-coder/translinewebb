import { supabase } from '../supabase';

export async function countAdminActionsToday(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('admin_audit_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', start.toISOString());
  if (error) throw error;
  return count ?? 0;
}
