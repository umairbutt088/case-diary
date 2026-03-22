export type CaseHearingRow = {
  id: string;
  case_id: string;
  user_id: string;
  hearing_date: string;
  proceeding: string | null;
  current_status: string | null;
  next_status: string | null;
  next_hearing_date: string | null;
  created_at: string;
  updated_at: string;
};
