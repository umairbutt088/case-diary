export type CaseFeePaymentRow = {
  id: string;
  case_id: string;
  user_id: string;
  amount: number;
  payment_date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};
