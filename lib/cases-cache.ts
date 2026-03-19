import AsyncStorage from "@react-native-async-storage/async-storage";

import type { CaseRow } from "@/types/case";

function getCasesCacheKey(userId: string) {
  return `@legal_diary/cases_cache/${userId}`;
}

export async function getCachedCases(userId: string): Promise<CaseRow[]> {
  try {
    const raw = await AsyncStorage.getItem(getCasesCacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CaseRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setCachedCases(
  userId: string,
  cases: CaseRow[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(getCasesCacheKey(userId), JSON.stringify(cases));
  } catch {
    // Ignore cache write failures.
  }
}

export async function getCachedCaseById(
  userId: string,
  caseId: string,
): Promise<CaseRow | null> {
  const cases = await getCachedCases(userId);
  return cases.find((c) => c.id === caseId) ?? null;
}

export async function upsertCachedCase(
  userId: string,
  row: CaseRow,
): Promise<void> {
  const cases = await getCachedCases(userId);
  const index = cases.findIndex((c) => c.id === row.id);
  if (index === -1) {
    cases.unshift(row);
  } else {
    cases[index] = row;
  }
  await setCachedCases(userId, cases);
}

export async function patchCachedCase(
  userId: string,
  caseId: string,
  patch: Partial<CaseRow>,
): Promise<void> {
  const cases = await getCachedCases(userId);
  const index = cases.findIndex((c) => c.id === caseId);
  if (index === -1) return;
  cases[index] = { ...cases[index], ...patch };
  await setCachedCases(userId, cases);
}

export async function removeCachedCase(
  userId: string,
  caseId: string,
): Promise<void> {
  const cases = await getCachedCases(userId);
  const filtered = cases.filter((c) => c.id !== caseId);
  await setCachedCases(userId, filtered);
}
