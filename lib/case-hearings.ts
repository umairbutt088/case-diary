import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { CaseHearingRow } from "@/types/case-hearing";

type AddCaseHearingInput = {
  caseId: string;
  userId: string;
  hearingDate: string | null;
  currentStatus?: string | null;
  nextStatus?: string | null;
  nextHearingDate?: string | null;
  proceeding?: string | null;
};

export async function addCaseHearingEntry(input: AddCaseHearingInput) {
  if (!isSupabaseConfigured) return false;
  if (!input.caseId || !input.userId || !input.hearingDate) return false;

  const proceeding = input.proceeding?.trim() || input.currentStatus?.trim() || null;

  const { error } = await supabase.from("case_hearings").insert({
    case_id: input.caseId,
    user_id: input.userId,
    hearing_date: input.hearingDate,
    proceeding,
    current_status: input.currentStatus?.trim() || null,
    next_status: input.nextStatus?.trim() || null,
    next_hearing_date: input.nextHearingDate || null,
  });

  return !error;
}

export async function getCaseHearingHistory(
  caseId: string,
  userId: string,
  options?: { limit?: number; offset?: number },
) {
  if (!isSupabaseConfigured || !caseId || !userId) {
    return [] as CaseHearingRow[];
  }

  let query = supabase
    .from("case_hearings")
    .select("*")
    .eq("case_id", caseId)
    .eq("user_id", userId)
    .order("hearing_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (typeof options?.offset === "number" || typeof options?.limit === "number") {
    const offset = Math.max(0, options?.offset ?? 0);
    const limit = Math.max(1, options?.limit ?? 20);
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error } = await query;

  if (error || !data) return [] as CaseHearingRow[];
  return data as CaseHearingRow[];
}
