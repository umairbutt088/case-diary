import { useCallback, useEffect, useMemo, useState } from "react";

import { buildCaseTypeOptions } from "@/constants/case-form";
import { useAuth } from "@/context/auth-context";
import { addCustomCaseType, getCustomCaseTypes } from "@/lib/custom-case-types";

export function useCustomCaseTypes(selectedType = "") {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [customTypes, setCustomTypes] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) {
      setCustomTypes([]);
      return;
    }
    void getCustomCaseTypes(userId).then(setCustomTypes);
  }, [userId]);

  const caseTypeOptions = useMemo(
    () => buildCaseTypeOptions(customTypes, selectedType),
    [customTypes, selectedType],
  );

  const saveCustomCaseType = useCallback(
    async (name: string) => {
      if (!userId) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;
      const next = await addCustomCaseType(userId, trimmed);
      setCustomTypes(next);
      return trimmed;
    },
    [userId],
  );

  return { customTypes, caseTypeOptions, saveCustomCaseType };
}
