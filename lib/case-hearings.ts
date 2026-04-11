import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { CaseHearingRow } from "@/types/case-hearing";

export type AddCaseHearingInput = {
  caseId: string;
  userId: string;
  hearingDate: string | null;
  currentStatus?: string | null;
  nextStatus?: string | null;
  nextHearingDate?: string | null;
  proceeding?: string | null;
  judgeName?: string | null;
};

export type AddCaseHearingResult =
  | { ok: true }
  | { ok: false; message: string };

export async function addCaseHearingEntry(
  input: AddCaseHearingInput,
): Promise<AddCaseHearingResult> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      message: "Database is not configured. Check your Supabase settings.",
    };
  }
  if (!input.caseId?.trim() || !input.userId?.trim()) {
    return { ok: false, message: "Missing case or user." };
  }
  if (!input.hearingDate?.trim()) {
    return { ok: false, message: "Hearing date is required to save history." };
  }

  const proceeding = input.proceeding?.trim() || input.currentStatus?.trim() || null;
  const judgeName = input.judgeName?.trim() || null;

  const { error } = await supabase.from("case_hearings").insert({
    case_id: input.caseId,
    user_id: input.userId,
    hearing_date: input.hearingDate.trim(),
    proceeding,
    judge_name: judgeName,
    current_status: input.currentStatus?.trim() || null,
    next_status: input.nextStatus?.trim() || null,
    next_hearing_date: input.nextHearingDate?.trim() || null,
  });

  if (error) {
    const msg = error.message?.trim();
    return {
      ok: false,
      message: msg || "Could not save hearing record.",
    };
  }
  return { ok: true };
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
