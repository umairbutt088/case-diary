/**
 * Client row as returned from Supabase public.clients
 */
export type ClientRow = {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  care_of: string | null;
  created_at: string;
};
