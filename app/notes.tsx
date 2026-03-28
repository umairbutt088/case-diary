import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Bounceable } from "@/components/ui";
import { ScreenHeader } from "@/components/ui/screen-header";
import type { AppColors } from "@/constants/color-palette";
import { theme } from "@/constants/theme";
import { useAppTheme } from "@/context/app-theme-context";
import { useAuth } from "@/context/auth-context";
import { useThemePalette } from "@/hooks/use-theme-palette";
import {
  type ActivityNote,
  getActivityNotesStorageKey,
  sanitizeActivityNotes,
} from "@/lib/activity-notes";
import { getTodayISO } from "@/types/case";

type NotesFilter = "today" | "all";

function createNotesStyles(C: AppColors, onPrimary: string) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 14,
    },
    filterRow: {
      flexDirection: "row",
      backgroundColor: "transparent",
      width: "100%",
      paddingVertical: 10,
      justifyContent: "space-around",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.borderGray,
      marginBottom: 12,
    },
    filterBtn: {
      width: "45%",
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: 12,
      backgroundColor: C.grey100,
      borderWidth: 1,
      borderColor: "transparent",
    },
    filterBtnActive: {
      backgroundColor: C.themeBlack,
      borderColor: C.themeBlack,
    },
    filterBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: C.gray50,
    },
    filterBtnTextActive: {
      color: onPrimary,
    },
    editorCard: {
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 12,
      padding: 12,
      backgroundColor: C.pureWhite,
    },
    notesInput: {
      minHeight: 86,
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: C.black,
      textAlignVertical: "top",
    },
    actionsRow: {
      marginTop: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    primaryButton: {
      backgroundColor: C.themeBlack,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    primaryButtonText: {
      color: onPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
    secondaryButton: {
      backgroundColor: C.background,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
    },
    secondaryButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: C.gray50,
    },
    notesList: {
      marginTop: 12,
    },
    notesListContent: {
      paddingBottom: 104,
      gap: 10,
    },
    composerWrap: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 86,
      paddingHorizontal: 24,
      zIndex: 20,
    },
    emptyText: {
      color: C.gray50,
      fontSize: 14,
      textAlign: "center",
      paddingVertical: 24,
    },
    noteCard: {
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: C.pureWhite,
    },
    noteTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    noteContent: {
      flex: 1,
      fontSize: 14,
      color: C.black,
      lineHeight: 20,
    },
    noteContentDone: {
      color: C.gray50,
      textDecorationLine: "line-through",
    },
    noteStatusBadge: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: C.zodiacColour + "1a",
      borderWidth: 1,
      borderColor: C.zodiacColour + "55",
    },
    noteStatusBadgeDone: {
      backgroundColor: C.gray100,
      borderColor: C.borderGray,
    },
    noteStatusText: {
      fontSize: 11,
      fontWeight: "700",
      color: C.zodiacColour,
    },
    noteStatusTextDone: {
      color: C.gray50,
    },
    noteTime: {
      marginTop: 6,
      fontSize: 12,
      color: C.gray50,
    },
    noteActions: {
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    noteAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    noteActionText: {
      fontSize: 13,
      color: C.zodiacColour,
      fontWeight: "600",
    },
    noteActionInactive: {
      color: C.gray50,
    },
    noteActionDelete: {
      color: C.themeRed,
    },
    fab: {
      position: "absolute",
      right: 24,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: C.themeBlack,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 30,
      ...theme.shadow,
    },
  });
}

export default function NotesScreen() {
  const { session } = useAuth();
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = isDark ? C.black : C.pureWhite;
  const styles = useMemo(
    () => createNotesStyles(C, onPrimary),
    [C, onPrimary],
  );
  const [notes, setNotes] = useState<ActivityNote[]>([]);
  const [filter, setFilter] = useState<NotesFilter>("today");
  const [noteInput, setNoteInput] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const today = getTodayISO();

  const storageKey = useMemo(
    () => getActivityNotesStorageKey(session?.user?.id),
    [session?.user?.id],
  );

  const visibleNotes = useMemo(
    () => (filter === "today" ? notes.filter((note) => note.noteDate === today) : notes),
    [filter, notes, today],
  );

  const loadNotes = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) {
        setNotes([]);
        return;
      }
      const parsed = JSON.parse(raw);
      const sanitized = sanitizeActivityNotes(parsed, today);
      setNotes(sanitized);
      if (Array.isArray(parsed) && sanitized.length !== parsed.length) {
        await AsyncStorage.setItem(storageKey, JSON.stringify(sanitized));
      }
    } catch {
      setNotes([]);
    }
  }, [storageKey, today]);

  const persistNotes = useCallback(
    async (nextNotes: ActivityNote[]) => {
      setNotes(nextNotes);
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(nextNotes));
      } catch {
        Alert.alert("Error", "Could not save notes.");
      }
    },
    [storageKey],
  );

  useFocusEffect(
    useCallback(() => {
      void loadNotes();
    }, [loadNotes]),
  );

  const resetEditor = useCallback(() => {
    setNoteInput("");
    setEditingNoteId(null);
    setIsComposerOpen(false);
  }, []);

  const saveNote = useCallback(async () => {
    const trimmed = noteInput.trim();
    if (!trimmed) {
      Alert.alert("Add note", "Please write something before saving.");
      return;
    }

    const now = new Date().toISOString();
    let nextNotes: ActivityNote[] = [];
    if (editingNoteId) {
      nextNotes = notes
        .map((note) =>
          note.id === editingNoteId ? { ...note, content: trimmed, updatedAt: now } : note,
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } else {
      nextNotes = [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          content: trimmed,
          createdAt: now,
          updatedAt: now,
          isDone: false,
          noteDate: today,
        },
        ...notes,
      ];
    }

    await persistNotes(nextNotes);
    resetEditor();
  }, [editingNoteId, noteInput, notes, persistNotes, resetEditor, today]);

  const editNote = useCallback((note: ActivityNote) => {
    setEditingNoteId(note.id);
    setNoteInput(note.content);
    setIsComposerOpen(true);
  }, []);

  const deleteNote = useCallback(
    (noteId: string) => {
      Alert.alert("Delete note?", "This note will be removed.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const nextNotes = notes.filter((note) => note.id !== noteId);
            void persistNotes(nextNotes);
            if (editingNoteId === noteId) {
              resetEditor();
            }
          },
        },
      ]);
    },
    [editingNoteId, notes, persistNotes, resetEditor],
  );

  const toggleDone = useCallback(
    (noteId: string) => {
      const now = new Date().toISOString();
      const nextNotes = notes
        .map((note) =>
          note.id === noteId ? { ...note, isDone: !note.isDone, updatedAt: now } : note,
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      void persistNotes(nextNotes);
    },
    [notes, persistNotes],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader title="Notes" />
      <Animated.View style={styles.container} entering={FadeInUp.duration(320).springify()}>
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterBtn, filter === "today" && styles.filterBtnActive]}
            onPress={() => setFilter("today")}
          >
            <ThemedText
              style={[styles.filterBtnText, filter === "today" && styles.filterBtnTextActive]}
            >
              Today Notes
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.filterBtn, filter === "all" && styles.filterBtnActive]}
            onPress={() => setFilter("all")}
          >
            <ThemedText
              style={[styles.filterBtnText, filter === "all" && styles.filterBtnTextActive]}
            >
              All Notes
            </ThemedText>
          </Pressable>
        </View>

        <Animated.ScrollView
          style={styles.notesList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.notesListContent}
        >
          {visibleNotes.length === 0 ? (
            <ThemedText style={styles.emptyText}>
              {filter === "today"
                ? "No notes for today yet."
                : "No notes yet. Add one to get started."}
            </ThemedText>
          ) : (
            visibleNotes.map((note) => (
              <View key={note.id} style={styles.noteCard}>
                <View style={styles.noteTopRow}>
                  <ThemedText style={[styles.noteContent, note.isDone && styles.noteContentDone]}>
                    {note.content}
                  </ThemedText>
                  <View style={[styles.noteStatusBadge, note.isDone && styles.noteStatusBadgeDone]}>
                    <ThemedText
                      style={[styles.noteStatusText, note.isDone && styles.noteStatusTextDone]}
                    >
                      {note.isDone ? "Done" : "Active"}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.noteTime}>
                  {filter === "all" ? `Date ${note.noteDate} - ` : ""}
                  Updated {new Date(note.updatedAt).toLocaleString()}
                </ThemedText>

                <View style={styles.noteActions}>
                  <Bounceable style={styles.noteAction} onPress={() => toggleDone(note.id)}>
                    <MaterialIcons
                      name={note.isDone ? "radio-button-unchecked" : "check-circle"}
                      size={16}
                      color={note.isDone ? C.gray50 : C.zodiacColour}
                    />
                    <ThemedText
                      style={[styles.noteActionText, note.isDone && styles.noteActionInactive]}
                    >
                      {note.isDone ? "Mark active" : "Done"}
                    </ThemedText>
                  </Bounceable>
                  <Bounceable style={styles.noteAction} onPress={() => editNote(note)}>
                    <MaterialIcons name="edit" size={16} color={C.zodiacColour} />
                    <ThemedText style={styles.noteActionText}>Edit</ThemedText>
                  </Bounceable>
                  <Bounceable style={styles.noteAction} onPress={() => deleteNote(note.id)}>
                    <MaterialIcons name="delete" size={16} color={C.themeRed} />
                    <ThemedText style={[styles.noteActionText, styles.noteActionDelete]}>
                      Delete
                    </ThemedText>
                  </Bounceable>
                </View>
              </View>
            ))
          )}
        </Animated.ScrollView>

        {isComposerOpen ? (
          <View style={styles.composerWrap}>
            <View style={styles.editorCard}>
              <TextInput
                style={styles.notesInput}
                placeholder={
                  filter === "today"
                    ? "Write a note for today..."
                    : "Write a note (saved for today)..."
                }
                placeholderTextColor={C.gray50}
                value={noteInput}
                onChangeText={setNoteInput}
                multiline
                autoFocus
              />
              <View style={styles.actionsRow}>
                <Bounceable style={styles.secondaryButton} onPress={resetEditor}>
                  <ThemedText style={styles.secondaryButtonText}>
                    {editingNoteId ? "Cancel edit" : "Close"}
                  </ThemedText>
                </Bounceable>
                <Bounceable style={styles.primaryButton} onPress={() => void saveNote()}>
                  <ThemedText style={styles.primaryButtonText}>
                    {editingNoteId ? "Update note" : "Save note"}
                  </ThemedText>
                </Bounceable>
              </View>
            </View>
          </View>
        ) : null}

        <Bounceable
          style={styles.fab}
          onPress={() => {
            setEditingNoteId(null);
            setNoteInput("");
            setIsComposerOpen(true);
          }}
        >
          <MaterialIcons name="add" size={28} color={onPrimary} />
        </Bounceable>
      </Animated.View>
    </SafeAreaView>
  );
}
