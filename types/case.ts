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
  linked_client_name: string | null;
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

/** Today's date in YYYY-MM-DD (local time) for DB comparisons */
export function getTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Overdue = next hearing date exists but is in the past.
 * Once a new future/current next hearing date is set, overdue clears automatically.
 */
export function isCaseOverdue(params: {
  nextHearingDate: string | null | undefined;
  updatedAt: string | null | undefined;
  todayISO?: string;
}): boolean {
  const today = params.todayISO ?? getTodayISO();
  const nextDate = params.nextHearingDate?.slice(0, 10) ?? null;
  if (!nextDate) return false;
  return nextDate < today;
}

/** Current week bounds (Sunday–Saturday) in YYYY-MM-DD */
export function getWeekBounds(): { weekStart: string; weekEnd: string } {
  const d = new Date();
  const dayOfWeek = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - dayOfWeek);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  const toISO = (x: Date) => {
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, "0");
    const day = String(x.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  return { weekStart: toISO(sunday), weekEnd: toISO(saturday) };
}
