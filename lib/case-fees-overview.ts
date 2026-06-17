import type { CaseRow } from "@/types/case";
import { toFeeNumber } from "@/lib/case-fees";

export type CaseFeeStatus = "active" | "disposed";

export type CaseFeeOverviewItem = CaseRow & {
  feeStatus: CaseFeeStatus;
};

export type CaseFeeOverviewSummary = {
  caseCount: number;
  casesWithFees: number;
  totalBilled: number;
  totalReceived: number;
  totalRemaining: number;
};

export function getCaseFeeStatus(
  row: Pick<CaseRow, "disposed_at">,
): CaseFeeStatus {
  return row.disposed_at ? "disposed" : "active";
}

export function summarizeCaseFees(
  cases: Pick<CaseRow, "total_fee" | "fee_received">[],
): CaseFeeOverviewSummary {
  let totalBilled = 0;
  let totalReceived = 0;
  let casesWithFees = 0;

  for (const row of cases) {
    const billed = toFeeNumber(row.total_fee);
    const received = toFeeNumber(row.fee_received) ?? 0;

    if (billed != null) {
      casesWithFees += 1;
      totalBilled += billed;
      totalReceived += received;
    }
  }

  const totalRemaining = Math.max(
    0,
    Math.round((totalBilled - totalReceived) * 100) / 100,
  );

  return {
    caseCount: cases.length,
    casesWithFees,
    totalBilled,
    totalReceived,
    totalRemaining,
  };
}

export function hasRecordedFee(
  row: Pick<CaseRow, "total_fee" | "fee_received">,
): boolean {
  return (
    toFeeNumber(row.total_fee) != null || toFeeNumber(row.fee_received) != null
  );
}
