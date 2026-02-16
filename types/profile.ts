/**
 * Profile row as returned from Supabase public.profiles
 */
export type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  role: string;
  phone: string | null;
  address: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export function getDisplayName(profile: ProfileRow | null): string {
  if (!profile) return "User";
  if (profile.full_name?.trim()) return profile.full_name.trim();
  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  const name = [first, last].filter(Boolean).join(" ");
  return name || profile.email || "User";
}
