/**
 * Offline queue for cases: store pending cases when offline, sync to Supabase when online.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { addCaseHearingEntry } from "@/lib/case-hearings";
import {
  patchCachedCase,
  removeCachedCase,
  upsertCachedCase,
} from "@/lib/cases-cache";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";

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

type PendingInsertCase = {
  id: string;
  createdAt: number;
  kind: "insert";
  user_id: string;
  row: PendingCaseRow;
  local_case_id?: string;
};

type PendingUpdateCase = {
  id: string;
  createdAt: number;
  kind: "update";
  user_id: string;
  case_id: string;
  patch: Partial<CaseRow>;
};

type PendingDeleteCase = {
  id: string;
  createdAt: number;
  /** "delete" = soft-delete (sets deleted_at). "hard_delete" = permanent removal. */
  kind: "delete" | "hard_delete";
  user_id: string;
  case_id: string;
};

/** Queued from case detail "Add proceeding" while offline; sync replays hearing + case patch. */
type PendingHearingInsert = {
  id: string;
  createdAt: number;
  kind: "hearing_insert";
  user_id: string;
  case_id: string;
  hearing_date: string;
  proceeding: string | null;
  judge_name: string | null;
  current_status: string | null;
  next_status: string | null;
  next_hearing_date: string | null;
  casePatch: Partial<CaseRow>;
};

type PendingCaseOperation =
  | PendingInsertCase
  | PendingUpdateCase
  | PendingDeleteCase
  | PendingHearingInsert;

function toOperation(item: unknown): PendingCaseOperation | null {
  if (!item || typeof item !== "object") return null;
  const maybe = item as Partial<PendingCaseOperation & StoredPendingCase>;
  const id = typeof maybe.id === "string" ? maybe.id : "";
  const createdAt = typeof maybe.createdAt === "number" ? maybe.createdAt : Date.now();
  if (!id) return null;

  // Backward compatibility for old queue shape (insert-only entries)
  if (!maybe.kind && maybe.row && typeof maybe.row === "object") {
    const row = maybe.row as PendingCaseRow;
    return {
      id,
      createdAt,
      kind: "insert",
      user_id: row.user_id,
      row,
    };
  }

  if (maybe.kind === "insert" && maybe.row && typeof maybe.user_id === "string") {
    return {
      id,
      createdAt,
      kind: "insert",
      user_id: maybe.user_id,
      row: maybe.row as PendingCaseRow,
      local_case_id:
        typeof maybe.local_case_id === "string" ? maybe.local_case_id : undefined,
    };
  }

  if (
    maybe.kind === "update" &&
    typeof maybe.user_id === "string" &&
    typeof maybe.case_id === "string" &&
    maybe.patch &&
    typeof maybe.patch === "object"
  ) {
    return {
      id,
      createdAt,
      kind: "update",
      user_id: maybe.user_id,
      case_id: maybe.case_id,
      patch: maybe.patch as Partial<CaseRow>,
    };
  }

  if (
    (maybe.kind === "delete" || maybe.kind === "hard_delete") &&
    typeof maybe.user_id === "string" &&
    typeof maybe.case_id === "string"
  ) {
    return {
      id,
      createdAt,
      kind: maybe.kind,
      user_id: maybe.user_id,
      case_id: maybe.case_id,
    };
  }

  if (
    maybe.kind === "hearing_insert" &&
    typeof maybe.user_id === "string" &&
    typeof maybe.case_id === "string" &&
    typeof maybe.hearing_date === "string" &&
    maybe.casePatch &&
    typeof maybe.casePatch === "object"
  ) {
    return {
      id,
      createdAt,
      kind: "hearing_insert",
      user_id: maybe.user_id,
      case_id: maybe.case_id,
      hearing_date: maybe.hearing_date,
      proceeding: typeof maybe.proceeding === "string" ? maybe.proceeding : null,
      judge_name: typeof maybe.judge_name === "string" ? maybe.judge_name : null,
      current_status:
        typeof maybe.current_status === "string" ? maybe.current_status : null,
      next_status: typeof maybe.next_status === "string" ? maybe.next_status : null,
      next_hearing_date:
        typeof maybe.next_hearing_date === "string" ? maybe.next_hearing_date : null,
      casePatch: maybe.casePatch as Partial<CaseRow>,
    };
  }

  return null;
}

async function getStored(): Promise<PendingCaseOperation[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_CASES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(toOperation).filter((i): i is PendingCaseOperation => Boolean(i));
  } catch {
    return [];
  }
}

async function setStored(items: PendingCaseOperation[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_CASES_KEY, JSON.stringify(items));
}

function buildLocalCaseRow(
  localId: string,
  row: PendingCaseRow,
  nowIso: string,
): CaseRow {
  return {
    id: localId,
    user_id: row.user_id,
    case_title: row.case_title ?? null,
    case_number: row.case_number ?? null,
    case_type: row.case_type ?? null,
    case_sub_type: row.case_sub_type ?? null,
    petitioner_name: row.petitioner_name,
    respondent_name: row.respondent_name,
    court_tier: row.court_tier ?? null,
    court_name: row.court_name ?? null,
    court_room: row.court_room ?? null,
    judge_name: row.judge_name ?? null,
    my_client_is: row.my_client_is ?? null,
    linked_client_id: row.linked_client_id ?? null,
    linked_client_name: row.linked_client_name ?? null,
    date_of_filing: row.date_of_filing ?? null,
    next_hearing_date: row.next_hearing_date ?? null,
    current_status: row.current_status ?? null,
    next_status: row.next_status ?? null,
    notes: row.notes ?? null,
    created_at: nowIso,
    updated_at: nowIso,
    deleted_at: null,
  };
}

/** Get all pending cases (for current user or all if userId not provided) */
export async function getPendingCases(
  userId?: string
): Promise<PendingCaseOperation[]> {
  const items = await getStored();
  if (userId) {
    return items.filter((i) => i.user_id === userId);
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
  const localCaseId = `local_${id}`;
  const nowIso = new Date().toISOString();
  items.push({
    id,
    createdAt: Date.now(),
    kind: "insert",
    user_id: row.user_id,
    row,
    local_case_id: localCaseId,
  });
  await setStored(items);
  await upsertCachedCase(row.user_id, buildLocalCaseRow(localCaseId, row, nowIso));
}

/** Queue a proceeding save (case_hearings insert + cases row patch) for sync when online. */
export async function addPendingProceedingSave(params: {
  userId: string;
  caseId: string;
  hearingDate: string;
  proceeding: string | null;
  judgeName: string | null;
  currentStatus: string | null;
  nextStatus: string | null;
  nextHearingDate: string | null;
  casePatch: Partial<CaseRow>;
}): Promise<void> {
  const items = await getStored();
  const id = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  items.push({
    id,
    createdAt: Date.now(),
    kind: "hearing_insert",
    user_id: params.userId,
    case_id: params.caseId,
    hearing_date: params.hearingDate,
    proceeding: params.proceeding,
    judge_name: params.judgeName,
    current_status: params.currentStatus,
    next_status: params.nextStatus,
    next_hearing_date: params.nextHearingDate,
    casePatch: params.casePatch,
  });
  await setStored(items);
}

export async function addPendingCaseUpdate(
  userId: string,
  caseId: string,
  patch: Partial<CaseRow>,
): Promise<void> {
  const items = await getStored();
  const localInsertIndex = items.findIndex(
    (i) => i.kind === "insert" && i.user_id === userId && i.local_case_id === caseId,
  );
  if (localInsertIndex >= 0) {
    const existing = items[localInsertIndex] as PendingInsertCase;
    existing.row = {
      ...existing.row,
      ...patch,
    } as PendingCaseRow;
    items[localInsertIndex] = existing;
    await setStored(items);
    return;
  }
  const id = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  items.push({
    id,
    createdAt: Date.now(),
    kind: "update",
    user_id: userId,
    case_id: caseId,
    patch,
  });
  await setStored(items);
}

/** Queue a soft-delete (moves case to Trash by setting deleted_at). */
export async function addPendingCaseDelete(
  userId: string,
  caseId: string,
): Promise<void> {
  const items = await getStored();
  const remaining = items.filter((i) => {
    if (i.user_id !== userId) return true;
    // Deleting an unsynced local case should just remove its pending insert.
    if (i.kind === "insert" && i.local_case_id === caseId) return false;
    // Drop queued proceedings for this case so sync does not update a trashed row.
    if (i.kind === "hearing_insert" && i.case_id === caseId) return false;
    return true;
  });
  if (remaining.length !== items.length) {
    await setStored(remaining);
    return;
  }

  const id = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  remaining.push({
    id,
    createdAt: Date.now(),
    kind: "delete",
    user_id: userId,
    case_id: caseId,
  });
  await setStored(remaining);
}

/** Queue a hard (permanent) delete. Only called from the Trash screen. */
export async function addPendingCaseHardDelete(
  userId: string,
  caseId: string,
): Promise<void> {
  const items = await getStored();
  const pruned = items.filter((i) => {
    if (i.user_id !== userId) return true;
    if (i.kind === "insert" && i.local_case_id === caseId) return false;
    if (i.kind === "hearing_insert" && i.case_id === caseId) return false;
    if (i.kind === "update" && i.case_id === caseId) return false;
    if (i.kind === "delete" && i.case_id === caseId) return false;
    if (i.kind === "hard_delete" && i.case_id === caseId) return false;
    return true;
  });
  const id = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  pruned.push({
    id,
    createdAt: Date.now(),
    kind: "hard_delete",
    user_id: userId,
    case_id: caseId,
  });
  await setStored(pruned);
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

  const items = (await getPendingCases(userId)).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  if (items.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of items) {
    if (item.kind === "insert") {
      const { data, error } = await supabase
        .from("cases")
        .insert(item.row)
        .select()
        .single();

      if (error) {
        failed += 1;
        continue;
      }

      if (data) {
        if (item.local_case_id) {
          await removeCachedCase(userId, item.local_case_id);
        }
        await upsertCachedCase(userId, data as CaseRow);
      }
      await removePendingCase(item.id);
      synced += 1;
      continue;
    }

    if (item.kind === "update") {
      const { error } = await supabase
        .from("cases")
        .update(item.patch)
        .eq("id", item.case_id)
        .eq("user_id", userId);

      if (error) {
        failed += 1;
        continue;
      }

      await removePendingCase(item.id);
      synced += 1;
      continue;
    }

    if (item.kind === "hearing_insert") {
      const hearingResult = await addCaseHearingEntry({
        caseId: item.case_id,
        userId: item.user_id,
        hearingDate: item.hearing_date,
        proceeding: item.proceeding,
        currentStatus: item.current_status,
        nextStatus: item.next_status,
        nextHearingDate: item.next_hearing_date,
        judgeName: item.judge_name,
      });
      if (!hearingResult.ok) {
        failed += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from("cases")
        .update(item.casePatch)
        .eq("id", item.case_id)
        .eq("user_id", userId);

      if (updateError) {
        failed += 1;
        continue;
      }

      await patchCachedCase(userId, item.case_id, item.casePatch);
      await removePendingCase(item.id);
      synced += 1;
      continue;
    }

    if (item.kind === "hard_delete") {
      // Permanent deletion from the Trash screen
      const { error } = await supabase
        .from("cases")
        .delete()
        .eq("id", item.case_id)
        .eq("user_id", userId);

      if (error) { failed += 1; continue; }
      await removeCachedCase(userId, item.case_id);
    } else {
      // Soft delete — set deleted_at so the case moves to Trash
      const { error } = await supabase
        .from("cases")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", item.case_id)
        .eq("user_id", userId);

      if (error) { failed += 1; continue; }
      await removeCachedCase(userId, item.case_id);
    }

    await removePendingCase(item.id);
    synced += 1;
  }

  return { synced, failed };
}
