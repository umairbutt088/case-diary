import { useMemo } from "react";

import { useAuth } from "@/context/auth-context";
import type { AccessPermissions, AccessRole } from "@/types/access";
import type { CaseRow } from "@/types/case";

export function canViewCaseFees(
  role: AccessRole,
  permissions: Pick<AccessPermissions, "view_case_fees">,
  caseRow: Pick<CaseRow, "subordinates_can_view_fees">,
  options?: { accessReady?: boolean },
): boolean {
  if (options?.accessReady === false) return false;
  if (role !== "subordinate") return true;
  if (!permissions.view_case_fees) return false;
  return caseRow.subordinates_can_view_fees !== false;
}

export function stripCaseFeeFields<T extends CaseRow>(row: T): T {
  return {
    ...row,
    total_fee: null,
    fee_received: null,
  };
}

export function useCanViewCaseFees(
  caseRow?: Pick<CaseRow, "subordinates_can_view_fees"> | null,
): boolean {
  const { role, permissions, isAccessLoading } = useAuth();

  return useMemo(() => {
    if (role !== "subordinate") return true;
    if (isAccessLoading) return false;
    if (!permissions.view_case_fees) return false;
    if (!caseRow) return false;

    return caseRow.subordinates_can_view_fees !== false;
  }, [caseRow, isAccessLoading, permissions.view_case_fees, role]);
}
