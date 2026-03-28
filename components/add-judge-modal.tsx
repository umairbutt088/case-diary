import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CourtTierPicker } from "@/components/add-case/court-tier-picker";
import { ThemedText } from "@/components/themed-text";
import {
  type AppColors,
  modalSheetBackground,
} from "@/constants/color-palette";
import { useAppTheme } from "@/context/app-theme-context";
import { useAuth } from "@/context/auth-context";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { addCachedJudge } from "@/lib/offline-reference-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type JudgeFormState = {
  name: string;
  court_tier: string;
  court_room_address: string;
};

const initialForm: JudgeFormState = {
  name: "",
  court_tier: "",
  court_room_address: "",
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved?: (judgeId: string) => void;
};

function createAddJudgeModalStyles(
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
    inputLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: C.gray50,
      textTransform: "uppercase",
      marginBottom: 6,
      marginTop: 10,
    },
    input: {
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: C.black,
      backgroundColor: C.background,
    },
    tierPickerWrap: {
      marginTop: 8,
    },
    errorText: {
      fontSize: 14,
      color: C.themeRed,
      marginTop: 12,
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
  });
}

export function AddJudgeModal({ visible, onClose, onSaved }: Props) {
  const { session } = useAuth();
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = isDark ? C.black : C.pureWhite;
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(
    () => createAddJudgeModalStyles(C, onPrimary, modalSheet),
    [C, onPrimary, modalSheet],
  );
  const [form, setForm] = useState<JudgeFormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setForm(initialForm);
      setError(null);
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    if (saving) return;
    Keyboard.dismiss();
    setForm(initialForm);
    setError(null);
    onClose();
  }, [onClose, saving]);

  const handleSave = useCallback(async () => {
    const name = form.name.trim();
    const courtTier = form.court_tier.trim();
    if (!name) {
      setError("Judge name is required.");
      return;
    }
    if (!courtTier) {
      setError("Court tier is required.");
      return;
    }
    if (!session?.user?.id || !isSupabaseConfigured) {
      setError("You must be signed in to add a judge.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name,
      court_tier: courtTier,
      court_room_address: form.court_room_address.trim() || null,
    };

    const { data, error: e } = await supabase
      .from("judges")
      .insert({
        ...payload,
        user_id: session.user.id,
      })
      .select("id")
      .single();

    setSaving(false);
    if (e) {
      if (e.code === "23505") {
        setError("This judge already exists.");
      } else {
        setError(e.message || "Failed to add judge.");
      }
      return;
    }

    const id = data?.id as string | undefined;
    if (id) {
      await addCachedJudge(session.user.id, {
        name: payload.name,
        courtTier: payload.court_tier,
        courtRoomAddress: payload.court_room_address,
      });
      Keyboard.dismiss();
      setForm(initialForm);
      onSaved?.(id);
      onClose();
    }
  }, [form, session?.user?.id, onSaved, onClose]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Add judge</ThemedText>
            <Pressable onPress={handleClose} hitSlop={12} disabled={saving}>
              <ThemedText style={styles.cancel}>Cancel</ThemedText>
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ThemedText style={styles.inputLabel}>Judge name</ThemedText>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(v) => {
                setForm((prev) => ({ ...prev, name: v }));
                setError(null);
              }}
              placeholder="Judge name"
              placeholderTextColor={C.gray50}
            />

            <View style={styles.tierPickerWrap}>
              <CourtTierPicker
                label="Court tier"
                required
                value={form.court_tier}
                onChange={(v) => {
                  setForm((prev) => ({ ...prev, court_tier: v }));
                  setError(null);
                }}
                hint="Use the same tier list as case creation."
              />
            </View>

            <ThemedText style={styles.inputLabel}>Court room address</ThemedText>
            <TextInput
              style={styles.input}
              value={form.court_room_address}
              onChangeText={(v) => {
                setForm((prev) => ({ ...prev, court_room_address: v }));
                setError(null);
              }}
              placeholder="e.g. Building A, 2nd Floor"
              placeholderTextColor={C.gray50}
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
                onPress={() => void handleSave()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={onPrimary} />
                ) : (
                  <ThemedText style={styles.btnPrimaryText}>Save judge</ThemedText>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
