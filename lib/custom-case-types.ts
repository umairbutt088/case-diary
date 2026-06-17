import AsyncStorage from "@react-native-async-storage/async-storage";

function getCustomCaseTypesKey(userId: string) {
  return `@legal_diary/custom_case_types/${userId}`;
}

function normalizeCaseTypeName(name: string) {
  return name.trim();
}

function dedupeCaseTypes(types: string[]): string[] {
  return Array.from(
    new Map(types.map((type) => [type.trim().toLowerCase(), type.trim()])).values(),
  ).sort((a, b) => a.localeCompare(b));
}

export async function getCustomCaseTypes(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(getCustomCaseTypesKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? dedupeCaseTypes(parsed) : [];
  } catch {
    return [];
  }
}

export async function addCustomCaseType(
  userId: string,
  name: string,
): Promise<string[]> {
  const trimmed = normalizeCaseTypeName(name);
  if (!trimmed) return getCustomCaseTypes(userId);
  const types = await getCustomCaseTypes(userId);
  const next = dedupeCaseTypes([...types, trimmed]);
  await AsyncStorage.setItem(getCustomCaseTypesKey(userId), JSON.stringify(next));
  return next;
}
