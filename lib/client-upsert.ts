import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export async function upsertClientNameForUser(params: {
  userId: string;
  clientName: string | null | undefined;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const name = params.clientName?.trim() ?? "";
  if (!name) return { ok: true };
  if (!isSupabaseConfigured) return { ok: true };

  const { error } = await supabase.from("clients").upsert(
    [
      {
        user_id: params.userId,
        name,
        address: null,
        phone: null,
        email: null,
        care_of: null,
      },
    ],
    {
      onConflict: "user_id,name",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    return { ok: false, message: error.message || "Failed to sync client name." };
  }
  return { ok: true };
}
