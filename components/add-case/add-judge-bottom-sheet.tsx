import { useCallback, useEffect, useState } from "react";
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

import { FormField } from "@/components/add-case/form-field";
import { FormFieldWithHint } from "@/components/add-case/form-field-with-hint";
import { ThemedText } from "@/components/themed-text";
import {
  COURT_TIERS,
  type CourtTier,
} from "@/constants/case-form";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type SavedJudge = {
  name: string;
  courtRoomAddress: string | null;
  courtTier: CourtTier;
};

type Props = {
  visible: boolean;
  defaultCourtTier: CourtTier | "";
  onClose: () => void;
  onSaved: (judge: SavedJudge) => void;
};

type AddJudgeForm = {
  name: string;
  courtRoomAddress: string;
};

const initialForm: AddJudgeForm = {
  name: "",
  courtRoomAddress: "",
};

export function AddJudgeBottomSheet({
  visible,
  defaultCourtTier,
  onClose,
  onSaved,
}: Props) {
  const { session } = useAuth();
  const [form, setForm] = useState<AddJudgeForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedTierLabel =
    COURT_TIERS.find((tier) => tier.value === defaultCourtTier)?.label ??
    null;

  useEffect(() => {
    if (!visible) return;
    setForm(initialForm);
    setError(null);
  }, [visible]);

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
    if (!defaultCourtTier) {
      setError("Select court tier first in the case form.");
      return;
    }
    if (!session?.user?.id || !isSupabaseConfigured) {
      setError("You must be signed in to add a judge.");
      return;
    }

    setSaving(true);
    setError(null);
    const { error: e } = await supabase.from("judges").insert({
      user_id: session.user.id,
      name,
      court_room_address: form.courtRoomAddress.trim() || null,
      court_tier: defaultCourtTier,
    });
    setSaving(false);

    if (e) {
      if (e.code === "23505") {
        setError("This judge already exists in your list.");
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
      courtTier: defaultCourtTier,
    });
    onClose();
  }, [form, defaultCourtTier, session?.user?.id, onSaved, onClose]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
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
            <FormField label="Court Tier">
              <ThemedText style={styles.selectedTierText}>
                {selectedTierLabel
                  ? `Selected: ${selectedTierLabel}`
                  : "No court tier selected"}
              </ThemedText>
            </FormField>
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
                  <ActivityIndicator size="small" color={theme.colors.pureWhite} />
                ) : (
                  <ThemedText style={styles.btnPrimaryText}>Save Judge</ThemedText>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: theme.colors.pureWhite,
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
    borderBottomColor: theme.colors.grey100,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.black,
  },
  cancel: {
    fontSize: 16,
    color: theme.colors.btnBlue,
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
    color: theme.colors.themeRed,
    marginTop: 8,
  },
  selectedTierText: {
    fontSize: 14,
    color: theme.colors.gray50,
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
    backgroundColor: theme.colors.themeGray3,
  },
  btnSecondaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.black,
  },
  btnPrimary: {
    backgroundColor: theme.colors.themeBlack,
  },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.pureWhite,
  },
});
