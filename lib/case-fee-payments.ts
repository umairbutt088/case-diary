import { toFeeNumber } from "@/lib/case-fees";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getTodayISO } from "@/types/case";
import type { CaseFeePaymentRow } from "@/types/case-fee-payment";

export type RecordCaseFeePaymentInput = {
  caseId: string;
  userId: string;
  amount: number;
  paymentDate?: string;
  note?: string | null;
  currentTotalFee?: number | string | null;
  currentFeeReceived?: number | string | null;
};

export type RecordCaseFeePaymentResult =
  | { ok: true; feeReceived: number; payment: CaseFeePaymentRow }
  | { ok: false; message: string };

export async function getCaseFeePayments(
  caseId: string,
  userId: string,
  options?: { limit?: number; offset?: number },
): Promise<CaseFeePaymentRow[]> {
  if (!isSupabaseConfigured || !caseId || !userId) return [];

  let query = supabase
    .from("case_fee_payments")
    .select("*")
    .eq("case_id", caseId)
    .eq("user_id", userId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (typeof options?.offset === "number" || typeof options?.limit === "number") {
    const offset = Math.max(0, options?.offset ?? 0);
    const limit = Math.max(1, options?.limit ?? 20);
    query = query.range(offset, offset + limit - 1);
  } else if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as CaseFeePaymentRow[];
}

export async function recordCaseFeePayment(
  input: RecordCaseFeePaymentInput,
): Promise<RecordCaseFeePaymentResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: "Database is not configured." };
  }
  if (!input.caseId?.trim() || !input.userId?.trim()) {
    return { ok: false, message: "Missing case or user." };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, message: "Enter an amount greater than zero." };
  }

  const totalFee = toFeeNumber(input.currentTotalFee);
  const currentReceived = toFeeNumber(input.currentFeeReceived) ?? 0;
  const nextReceived = Math.round((currentReceived + input.amount) * 100) / 100;

  if (totalFee != null && nextReceived > totalFee) {
    return {
      ok: false,
      message: `This payment would exceed the total fee (Rs ${totalFee.toLocaleString("en-PK")}).`,
    };
  }

  const paymentDate = input.paymentDate?.trim() || getTodayISO();
  const note = input.note?.trim() || null;

  const { data: paymentData, error: paymentError } = await supabase
    .from("case_fee_payments")
    .insert({
      case_id: input.caseId,
      user_id: input.userId,
      amount: input.amount,
      payment_date: paymentDate,
      note,
    })
    .select("*")
    .single();

  if (paymentError || !paymentData) {
    return {
      ok: false,
      message: paymentError?.message || "Could not record payment.",
    };
  }

  const { error: updateError } = await supabase
    .from("cases")
    .update({ fee_received: nextReceived })
    .eq("id", input.caseId)
    .eq("user_id", input.userId);

  if (updateError) {
    await supabase
      .from("case_fee_payments")
      .delete()
      .eq("id", (paymentData as CaseFeePaymentRow).id);
    return {
      ok: false,
      message: updateError.message || "Could not update case fee balance.",
    };
  }

  return {
    ok: true,
    feeReceived: nextReceived,
    payment: paymentData as CaseFeePaymentRow,
  };
}
