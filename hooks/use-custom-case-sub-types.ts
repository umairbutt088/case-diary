import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildCaseSubTypeOptions,
  getCaseSubTypesForType,
} from "@/constants/case-form";
import { useAuth } from "@/context/auth-context";
import {
  addCustomCaseSubType,
  getCustomCaseSubTypes,
} from "@/lib/custom-case-sub-types";

export function useCustomCaseSubTypes(caseType: string, selectedSubType = "") {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const normalizedCaseType = caseType.trim();
  const [customSubTypes, setCustomSubTypes] = useState<string[]>([]);

  useEffect(() => {
    if (!userId || !normalizedCaseType) {
      setCustomSubTypes([]);
      return;
    }
    void getCustomCaseSubTypes(userId, normalizedCaseType).then(setCustomSubTypes);
  }, [userId, normalizedCaseType]);

  const baseSubTypes = useMemo(
    () => getCaseSubTypesForType(normalizedCaseType),
    [normalizedCaseType],
  );

  const caseSubTypeOptions = useMemo(
    () =>
      buildCaseSubTypeOptions(baseSubTypes, customSubTypes, selectedSubType),
    [baseSubTypes, customSubTypes, selectedSubType],
  );

  const saveCustomCaseSubType = useCallback(
    async (name: string) => {
      if (!userId || !normalizedCaseType) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;
      const next = await addCustomCaseSubType(userId, normalizedCaseType, trimmed);
      setCustomSubTypes(next);
      return trimmed;
    },
    [userId, normalizedCaseType],
  );

  return { caseSubTypeOptions, saveCustomCaseSubType };
}
