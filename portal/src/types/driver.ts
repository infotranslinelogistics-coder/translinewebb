export interface Driver {
  id: string;
  full_name: string;
  name?: string; // Alias for backwards compatibility
  email: string;
  phone?: string;
  role: string;
  status: string;
  last_login?: string;
  created_at: string;
  updated_at?: string;
}
