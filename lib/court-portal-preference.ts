import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@legal_diary/last_court_portal_id";

export async function getLastCourtPortalId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function setLastCourtPortalId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}
