/**
 * Offline queue for cases: store pending cases when offline, sync to Supabase when online.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const PENDING_CASES_KEY = "@legal_diary/pending_cases";

/** Case row ready for Supabase insert (matches public.cases schema) */
export type PendingCaseRow = {
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
  my_client_is: "petitioner" | "respondent" | null;
  linked_client_id: string | null;
  linked_client_name: string | null;
  date_of_filing: string | null;
  next_hearing_date: string | null;
  current_status: string | null;
  next_status: string | null;
  notes: string | null;
};

type StoredPendingCase = {
  id: string;
  createdAt: number;
  row: PendingCaseRow;
};

async function getStored(): Promise<StoredPendingCase[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_CASES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredPendingCase[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function setStored(items: StoredPendingCase[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_CASES_KEY, JSON.stringify(items));
}

/** Get all pending cases (for current user or all if userId not provided) */
export async function getPendingCases(
  userId?: string
): Promise<StoredPendingCase[]> {
  const items = await getStored();
  if (userId) {
    return items.filter((i) => i.row.user_id === userId);
  }
  return items;
}

/** Get count of pending cases for a user */
export async function getPendingCasesCount(userId: string): Promise<number> {
  const items = await getPendingCases(userId);
  return items.length;
}

/** Add a case to the offline queue */
export async function addPendingCase(row: PendingCaseRow): Promise<void> {
  const items = await getStored();
  const id = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  items.push({
    id,
    createdAt: Date.now(),
    row,
  });
  await setStored(items);
}

/** Remove a pending case by id */
async function removePendingCase(id: string): Promise<void> {
  const items = await getStored();
  const filtered = items.filter((i) => i.id !== id);
  await setStored(filtered);
}

export type SyncResult = {
  synced: number;
  failed: number;
};

/** Sync all pending cases for the current user to Supabase. Returns counts. */
export async function syncPendingCases(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured) return { synced: 0, failed: 0 };

  const items = await getPendingCases(userId);
  if (items.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of items) {
    const { error } = await supabase
      .from("cases")
      .insert(item.row)
      .select()
      .single();

    if (error) {
      failed += 1;
      // Keep in queue for retry; don't remove
      continue;
    }

    await removePendingCase(item.id);
    synced += 1;
  }

  return { synced, failed };
}
