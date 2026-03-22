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

export async function getCaseHearingHistory(caseId: string, userId: string) {
  if (!isSupabaseConfigured || !caseId || !userId) {
    return [] as CaseHearingRow[];
  }

  const { data, error } = await supabase
    .from("case_hearings")
    .select("*")
    .eq("case_id", caseId)
    .eq("user_id", userId)
    .order("hearing_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [] as CaseHearingRow[];
  return data as CaseHearingRow[];
}
