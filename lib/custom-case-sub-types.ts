import AsyncStorage from "@react-native-async-storage/async-storage";

function normalizeCaseTypeKey(caseType: string) {
  return caseType.trim().toLowerCase().replace(/\s+/g, "_");
}

function getCustomCaseSubTypesKey(userId: string, caseType: string) {
  return `@legal_diary/custom_case_sub_types/${userId}/${normalizeCaseTypeKey(caseType)}`;
}

function normalizeName(name: string) {
  return name.trim();
}

function dedupeNames(names: string[]): string[] {
  return Array.from(
    new Map(names.map((name) => [name.trim().toLowerCase(), name.trim()])).values(),
  ).sort((a, b) => a.localeCompare(b));
}

export async function getCustomCaseSubTypes(
  userId: string,
  caseType: string,
): Promise<string[]> {
  const trimmedCaseType = caseType.trim();
  if (!trimmedCaseType) return [];
  try {
    const raw = await AsyncStorage.getItem(
      getCustomCaseSubTypesKey(userId, trimmedCaseType),
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? dedupeNames(parsed) : [];
  } catch {
    return [];
  }
}

export async function addCustomCaseSubType(
  userId: string,
  caseType: string,
  name: string,
): Promise<string[]> {
  const trimmedCaseType = caseType.trim();
  const trimmedName = normalizeName(name);
  if (!trimmedCaseType || !trimmedName) {
    return getCustomCaseSubTypes(userId, trimmedCaseType);
  }
  const subTypes = await getCustomCaseSubTypes(userId, trimmedCaseType);
  const next = dedupeNames([...subTypes, trimmedName]);
  await AsyncStorage.setItem(
    getCustomCaseSubTypesKey(userId, trimmedCaseType),
    JSON.stringify(next),
  );
  return next;
}
