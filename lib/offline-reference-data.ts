import AsyncStorage from "@react-native-async-storage/async-storage";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type CachedJudge = {
  name: string;
  courtRoomAddress: string | null;
  courtTier: string;
};

type PendingReferenceOp =
  | {
      id: string;
      createdAt: number;
      user_id: string;
      kind: "add_tier";
      tierName: string;
    }
  | {
      id: string;
      createdAt: number;
      user_id: string;
      kind: "delete_tier";
      tierName: string;
    }
  | {
      id: string;
      createdAt: number;
      user_id: string;
      kind: "add_judge";
      judge: CachedJudge;
    }
  | {
      id: string;
      createdAt: number;
      user_id: string;
      kind: "delete_judge";
      judge: { name: string; courtTier: string };
    };

const PENDING_REFERENCE_OPS_KEY = "@legal_diary/pending_reference_ops";

function getCourtTiersCacheKey(userId: string) {
  return `@legal_diary/custom_court_tiers/${userId}`;
}

function getJudgesCacheKey(userId: string) {
  return `@legal_diary/judges/${userId}`;
}

function normalizeTierName(name: string) {
  return name.trim();
}

function normalizeJudgeName(name: string) {
  return name.trim();
}

function makeOpId() {
  return `pending_ref_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function getPendingOps(): Promise<PendingReferenceOp[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_REFERENCE_OPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingReferenceOp[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function setPendingOps(items: PendingReferenceOp[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_REFERENCE_OPS_KEY, JSON.stringify(items));
}

async function removePendingOp(opId: string): Promise<void> {
  const items = await getPendingOps();
  await setPendingOps(items.filter((i) => i.id !== opId));
}

export async function getCachedCustomCourtTiers(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(getCourtTiersCacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setCachedCustomCourtTiers(
  userId: string,
  tiers: string[],
): Promise<void> {
  const deduped = Array.from(
    new Map(tiers.map((tier) => [tier.trim().toLowerCase(), tier.trim()])).values(),
  ).sort((a, b) => a.localeCompare(b));
  await AsyncStorage.setItem(getCourtTiersCacheKey(userId), JSON.stringify(deduped));
}

export async function addCachedCustomCourtTier(
  userId: string,
  tierName: string,
): Promise<void> {
  const name = normalizeTierName(tierName);
  if (!name) return;
  const tiers = await getCachedCustomCourtTiers(userId);
  const exists = tiers.some((t) => t.toLowerCase() === name.toLowerCase());
  if (exists) return;
  await setCachedCustomCourtTiers(userId, [...tiers, name]);
}

export async function removeCachedCustomCourtTier(
  userId: string,
  tierName: string,
): Promise<void> {
  const name = normalizeTierName(tierName);
  const tiers = await getCachedCustomCourtTiers(userId);
  await setCachedCustomCourtTiers(
    userId,
    tiers.filter((t) => t.toLowerCase() !== name.toLowerCase()),
  );
}

export async function getCachedJudges(userId: string): Promise<CachedJudge[]> {
  try {
    const raw = await AsyncStorage.getItem(getJudgesCacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CachedJudge[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setCachedJudges(
  userId: string,
  judges: CachedJudge[],
): Promise<void> {
  const map = new Map<string, CachedJudge>();
  judges.forEach((j) => {
    const name = normalizeJudgeName(j.name);
    if (!name || !j.courtTier?.trim()) return;
    map.set(`${name.toLowerCase()}::${j.courtTier.trim().toLowerCase()}`, {
      name,
      courtRoomAddress: j.courtRoomAddress?.trim() || null,
      courtTier: j.courtTier.trim(),
    });
  });
  const list = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  await AsyncStorage.setItem(getJudgesCacheKey(userId), JSON.stringify(list));
}

export async function addCachedJudge(userId: string, judge: CachedJudge): Promise<void> {
  const existing = await getCachedJudges(userId);
  await setCachedJudges(userId, [...existing, judge]);
}

export async function removeCachedJudge(
  userId: string,
  name: string,
  courtTier: string,
): Promise<void> {
  const judges = await getCachedJudges(userId);
  await setCachedJudges(
    userId,
    judges.filter(
      (j) =>
        !(
          j.name.toLowerCase() === normalizeJudgeName(name).toLowerCase() &&
          j.courtTier.toLowerCase() === normalizeTierName(courtTier).toLowerCase()
        ),
    ),
  );
}

export async function getCachedJudgesForTier(
  userId: string,
  courtTier: string,
): Promise<CachedJudge[]> {
  const tier = normalizeTierName(courtTier).toLowerCase();
  const judges = await getCachedJudges(userId);
  return judges
    .filter((j) => j.courtTier.trim().toLowerCase() === tier)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function queueAddCourtTier(userId: string, tierName: string): Promise<void> {
  const name = normalizeTierName(tierName);
  if (!name) return;
  const ops = await getPendingOps();
  const withoutDelete = ops.filter(
    (op) =>
      !(
        op.user_id === userId &&
        op.kind === "delete_tier" &&
        op.tierName.toLowerCase() === name.toLowerCase()
      ),
  );
  withoutDelete.push({
    id: makeOpId(),
    createdAt: Date.now(),
    user_id: userId,
    kind: "add_tier",
    tierName: name,
  });
  await setPendingOps(withoutDelete);
}

export async function queueDeleteCourtTier(userId: string, tierName: string): Promise<void> {
  const name = normalizeTierName(tierName);
  if (!name) return;
  const ops = await getPendingOps();
  const filtered = ops.filter((op) => {
    if (op.user_id !== userId) return true;
    if (op.kind === "add_tier" && op.tierName.toLowerCase() === name.toLowerCase()) {
      return false;
    }
    return true;
  });
  filtered.push({
    id: makeOpId(),
    createdAt: Date.now(),
    user_id: userId,
    kind: "delete_tier",
    tierName: name,
  });
  await setPendingOps(filtered);
}

export async function queueAddJudge(userId: string, judge: CachedJudge): Promise<void> {
  const normalized: CachedJudge = {
    name: normalizeJudgeName(judge.name),
    courtRoomAddress: judge.courtRoomAddress?.trim() || null,
    courtTier: normalizeTierName(judge.courtTier),
  };
  if (!normalized.name || !normalized.courtTier) return;
  const ops = await getPendingOps();
  const withoutDelete = ops.filter((op) => {
    if (op.user_id !== userId || op.kind !== "delete_judge") return true;
    return !(
      op.judge.name.toLowerCase() === normalized.name.toLowerCase() &&
      op.judge.courtTier.toLowerCase() === normalized.courtTier.toLowerCase()
    );
  });
  withoutDelete.push({
    id: makeOpId(),
    createdAt: Date.now(),
    user_id: userId,
    kind: "add_judge",
    judge: normalized,
  });
  await setPendingOps(withoutDelete);
}

export async function queueDeleteJudge(
  userId: string,
  judge: { name: string; courtTier: string },
): Promise<void> {
  const normalized = {
    name: normalizeJudgeName(judge.name),
    courtTier: normalizeTierName(judge.courtTier),
  };
  if (!normalized.name || !normalized.courtTier) return;
  const ops = await getPendingOps();
  const filtered = ops.filter((op) => {
    if (op.user_id !== userId) return true;
    if (op.kind === "add_judge") {
      return !(
        op.judge.name.toLowerCase() === normalized.name.toLowerCase() &&
        op.judge.courtTier.toLowerCase() === normalized.courtTier.toLowerCase()
      );
    }
    return true;
  });
  filtered.push({
    id: makeOpId(),
    createdAt: Date.now(),
    user_id: userId,
    kind: "delete_judge",
    judge: normalized,
  });
  await setPendingOps(filtered);
}

export async function syncPendingReferenceData(userId: string): Promise<{
  synced: number;
  failed: number;
}> {
  if (!isSupabaseConfigured) return { synced: 0, failed: 0 };
  const ops = (await getPendingOps())
    .filter((op) => op.user_id === userId)
    .sort((a, b) => a.createdAt - b.createdAt);
  if (!ops.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const op of ops) {
    if (op.kind === "add_tier") {
      const { error } = await supabase.from("court_tiers").insert({
        user_id: userId,
        name: op.tierName,
      });
      if (error && error.code !== "23505") {
        failed += 1;
        continue;
      }
      await removePendingOp(op.id);
      synced += 1;
      continue;
    }

    if (op.kind === "delete_tier") {
      const { error } = await supabase
        .from("court_tiers")
        .delete()
        .eq("user_id", userId)
        .eq("name", op.tierName);
      if (error) {
        failed += 1;
        continue;
      }
      await removePendingOp(op.id);
      synced += 1;
      continue;
    }

    if (op.kind === "add_judge") {
      const { error } = await supabase.from("judges").insert({
        user_id: userId,
        name: op.judge.name,
        court_room_address: op.judge.courtRoomAddress,
        court_tier: op.judge.courtTier,
      });
      if (error && error.code !== "23505") {
        failed += 1;
        continue;
      }
      await removePendingOp(op.id);
      synced += 1;
      continue;
    }

    const { error } = await supabase
      .from("judges")
      .delete()
      .eq("user_id", userId)
      .eq("court_tier", op.judge.courtTier)
      .eq("name", op.judge.name);
    if (error) {
      failed += 1;
      continue;
    }
    await removePendingOp(op.id);
    synced += 1;
  }

  return { synced, failed };
}

/** Clears cached judges/tiers and pending reference ops for this user. */
export async function clearReferenceDataForUser(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(getJudgesCacheKey(userId));
  } catch {
    // ignore
  }
  try {
    await AsyncStorage.removeItem(getCourtTiersCacheKey(userId));
  } catch {
    // ignore
  }
  const ops = await getPendingOps();
  const remaining = ops.filter((op) => op.user_id !== userId);
  await setPendingOps(remaining);
}
