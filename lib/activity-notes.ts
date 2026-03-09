export type ActivityNote = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isDone: boolean;
  noteDate: string;
};

const HOME_NOTES_STORAGE_KEY = "homeActivityNotes";

export function getActivityNotesStorageKey(userId?: string): string {
  return `${HOME_NOTES_STORAGE_KEY}:${userId ?? "guest"}`;
}

export function sanitizeActivityNotes(
  rawItems: unknown,
  fallbackDate: string,
): ActivityNote[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .filter(
      (item): item is Partial<ActivityNote> =>
        Boolean(item && typeof item === "object" && (item as ActivityNote).id),
    )
    .map((item) => {
      const createdAt =
        typeof item.createdAt === "string" && item.createdAt
          ? item.createdAt
          : new Date().toISOString();
      const updatedAt =
        typeof item.updatedAt === "string" && item.updatedAt
          ? item.updatedAt
          : createdAt;
      const createdDate = createdAt.length >= 10 ? createdAt.slice(0, 10) : fallbackDate;

      return {
        id: String(item.id),
        content:
          typeof item.content === "string" && item.content.trim()
            ? item.content.trim()
            : "",
        createdAt,
        updatedAt,
        isDone: Boolean(item.isDone),
        noteDate:
          typeof item.noteDate === "string" && item.noteDate.length >= 10
            ? item.noteDate.slice(0, 10)
            : createdDate,
      };
    })
    .filter((item) => item.content.length > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
