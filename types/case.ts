/**
 * Case row as returned from Supabase public.cases
 */
export type CaseRow = {
  id: string;
  user_id: string;
  case_title: string | null;
  case_number: string | null;
  case_type: string | null;
  case_sub_type: string | null;
  petitioner_name: string;
  respondent_name: string;
  court_tier: string | null;
  court_name: string | null;
  court_room: string | null;
  judge_name: string | null;
  my_client_is: string | null;
  linked_client_id: string | null;
  date_of_filing: string | null;
  next_hearing_date: string | null;
  current_status: string | null;
  next_status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Display title: "Petitioner vs. Respondent" (or case_title if set) */
export function getCaseDisplayTitle(row: CaseRow): string {
  if (row.case_title?.trim()) return row.case_title.trim();
  const p = row.petitioner_name?.trim() || "Petitioner";
  const r = row.respondent_name?.trim() || "Respondent";
  return `${p} vs. ${r}`;
}

/** Format YYYY-MM-DD to DD/MM/YYYY for display */
export function formatCaseDate(isoDate: string | null): string {
  if (!isoDate || isoDate.length < 10) return "—";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
