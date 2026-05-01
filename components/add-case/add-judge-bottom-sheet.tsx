import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CourtTierPicker } from "@/components/add-case/court-tier-picker";
import { FormFieldWithHint } from "@/components/add-case/form-field-with-hint";
import { ThemedText } from "@/components/themed-text";
import {
  type AppColors,
  modalSheetBackground,
} from "@/constants/color-palette";
import { useAppTheme } from "@/context/app-theme-context";
import { useAuth } from "@/context/auth-context";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { useIsOnline } from "@/hooks/use-is-online";
import { addCachedJudge, queueAddJudge } from "@/lib/offline-reference-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type SavedJudge = {
  name: string;
  courtRoomAddress: string | null;
  courtTier: string;
};

type Props = {
  visible: boolean;
  defaultCourtTier?: string;
  onClose: () => void;
  onSaved: (judge: SavedJudge) => void;
  /**
   * When true, renders without an inner Modal (full-screen overlay). Use inside another Modal
   * so the sheet appears above the parent — nested Modals are unreliable on RN.
   */
  inline?: boolean;
};

type AddJudgeForm = {
  name: string;
  courtRoomAddress: string;
};

const initialForm: AddJudgeForm = {
  name: "",
  courtRoomAddress: "",
};

function createAddJudgeBottomSheetStyles(
  C: AppColors,
  onPrimary: string,
  modalSheet: string,
) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    sheet: {
      backgroundColor: modalSheet,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: "90%",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: C.grey100,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: C.black,
    },
    cancel: {
      fontSize: 16,
      color: C.btnBlue,
      fontWeight: "500",
    },
    scroll: {
      maxHeight: 520,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 32,
    },
    errorText: {
      fontSize: 14,
      color: C.themeRed,
      marginTop: 8,
    },
    selectedTierText: {
      fontSize: 14,
      color: C.gray50,
    },
    buttons: {
      flexDirection: "row",
      gap: 12,
      marginTop: 24,
    },
    btn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    btnSecondary: {
      backgroundColor: C.themeGray3,
    },
    btnSecondaryText: {
      fontSize: 16,
      fontWeight: "600",
      color: C.black,
    },
    btnPrimary: {
      backgroundColor: C.themeBlack,
    },
    btnPrimaryText: {
      fontSize: 16,
      fontWeight: "600",
      color: onPrimary,
    },
    inlineRoot: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1000,
      elevation: 1000,
    },
  });
}

export function AddJudgeBottomSheet({
  visible,
  defaultCourtTier,
  onClose,
  onSaved,
  inline = false,
}: Props) {
  const { session } = useAuth();
  const isOnline = useIsOnline();
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = isDark ? C.black : C.pureWhite;
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(
    () => createAddJudgeBottomSheetStyles(C, onPrimary, modalSheet),
    [C, onPrimary, modalSheet],
  );
  const [form, setForm] = useState<AddJudgeForm>(initialForm);
  const [selectedCourtTier, setSelectedCourtTier] = useState(defaultCourtTier ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeCourtTier = selectedCourtTier.trim();

  useEffect(() => {
    if (!visible) return;
    setForm(initialForm);
    setSelectedCourtTier(defaultCourtTier ?? "");
    setError(null);
  }, [visible, defaultCourtTier]);

  const update = useCallback((updates: Partial<AddJudgeForm>) => {
    setForm((prev) => ({ ...prev, ...updates }));
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const handleSave = useCallback(async () => {
    const name = form.name.trim();
    if (!name) {
      setError("Judge name is required.");
      return;
    }
    if (!activeCourtTier) {
      setError("Court tier is required.");
      return;
    }
    if (!session?.user?.id || !isSupabaseConfigured) {
      setError("You must be signed in to add a judge.");
      return;
    }
    if (!isOnline) {
      const offlineJudge = {
        name,
        courtRoomAddress: form.courtRoomAddress.trim() || null,
        courtTier: activeCourtTier,
      };
      await addCachedJudge(session.user.id, offlineJudge);
      await queueAddJudge(session.user.id, offlineJudge);
      onSaved(offlineJudge);
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    const { error: e } = await supabase.from("judges").insert({
      user_id: session.user.id,
      name,
      court_room_address: form.courtRoomAddress.trim() || null,
      court_tier: activeCourtTier,
    });
    setSaving(false);

    if (e) {
      if (e.code === "23505") {
        setError("This judge already exists for the selected court tier.");
      } else if (e.message?.toLowerCase().includes("court_tier")) {
        setError(
          "Judge tier setup is missing in database. Please run latest migrations.",
        );
      } else {
        setError(e.message || "Failed to add judge.");
      }
      return;
    }

    onSaved({
      name,
      courtRoomAddress: form.courtRoomAddress.trim() || null,
      courtTier: activeCourtTier,
    });
    await addCachedJudge(session.user.id, {
      name,
      courtRoomAddress: form.courtRoomAddress.trim() || null,
      courtTier: activeCourtTier,
    });
    onClose();
  }, [form, activeCourtTier, session?.user?.id, onSaved, onClose, isOnline]);

  if (!visible) return null;

  const sheetBody = (
    <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Add Judge</ThemedText>
          <Pressable onPress={handleClose} hitSlop={12}>
            <ThemedText style={styles.cancel}>Cancel</ThemedText>
          </Pressable>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FormFieldWithHint
            label="Judge Name"
            required
            value={form.name}
            onChangeText={(v) => update({ name: v })}
            placeholder="Enter judge name"
          />
          <FormFieldWithHint
            label="Court room address"
            value={form.courtRoomAddress}
            onChangeText={(v) => update({ courtRoomAddress: v })}
            placeholder="e.g. Building A, 2nd Floor"
            hint="Optional. Auto-fills case court room when this judge is selected."
          />
          <CourtTierPicker
            label="Court tier"
            value={selectedCourtTier}
            onChange={(v) => {
              setSelectedCourtTier(v);
              setError(null);
            }}
            required
            hint="Use the same tier list as case creation."
          />
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
          <View style={styles.buttons}>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={handleClose}
              disabled={saving}
            >
              <ThemedText style={styles.btnSecondaryText}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={onPrimary} />
              ) : (
                <ThemedText style={styles.btnPrimaryText}>Save Judge</ThemedText>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );

  if (inline) {
    return <View style={styles.inlineRoot}>{sheetBody}</View>;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      {sheetBody}
    </Modal>
  );
}
