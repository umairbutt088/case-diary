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

import { FormFieldWithHint } from "@/components/add-case/form-field-with-hint";
import { ThemedText } from "@/components/themed-text";
import {
  type AppColors,
  modalSheetBackground,
} from "@/constants/color-palette";
import { useAppTheme } from "@/context/app-theme-context";
import { useAuth } from "@/context/auth-context";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type NewClientForm = {
  name: string;
  address: string;
  phone: string;
  email: string;
};

type Props = {
  visible: boolean;
  initialName?: string;
  onClose: () => void;
  onSaved: (clientId: string) => void;
};

const initialForm: NewClientForm = {
  name: "",
  address: "",
  phone: "",
  email: "",
};

function createAddNewClientModalStyles(
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
    },
    cancel: {
      fontSize: 16,
      color: C.btnBlue,
      fontWeight: "500",
    },
    scroll: {
      maxHeight: 480,
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

export function AddNewClientModal({
  visible,
  initialName = "",
  onClose,
  onSaved,
}: Props) {
  const { session, effectiveOwnerId } = useAuth();
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = C.textInverse;
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(
    () => createAddNewClientModalStyles(C, onPrimary, modalSheet),
    [C, onPrimary, modalSheet],
  );
  const [form, setForm] = useState<NewClientForm>({
    ...initialForm,
    name: initialName.trim(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback((updates: Partial<NewClientForm>) => {
    setForm((prev) => ({ ...prev, ...updates }));
    setError(null);
  }, []);

  useEffect(() => {
    if (visible) {
      setForm((prev) => ({ ...prev, name: initialName.trim() }));
      setError(null);
    }
  }, [visible, initialName]);

  const resetForm = useCallback(() => {
    setForm({ ...initialForm, name: initialName.trim() });
    setError(null);
  }, [initialName]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleSave = useCallback(async () => {
    const name = form.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    if (!session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured) {
      setError("You must be signed in to add a client.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: e } = await supabase
      .from("clients")
      .insert({
        user_id: effectiveOwnerId,
        name,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        care_of: null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (e) {
      if (e.code === "23505") {
        setError("This client already exists.");
      } else {
        setError(e.message || "Failed to add client.");
      }
      return;
    }
    if (data?.id) {
      Keyboard.dismiss();
      resetForm();
      onSaved(data.id);
      onClose();
    }
  }, [form, session?.user?.id, effectiveOwnerId, onSaved, onClose, resetForm]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText type="accent" style={styles.title}>Add New Client</ThemedText>
            <Pressable onPress={handleClose} hitSlop={12}>
              <ThemedText type="default" style={styles.cancel}>Cancel</ThemedText>
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <FormFieldWithHint
              label="Name"
              required
              value={form.name}
              onChangeText={(v) => update({ name: v })}
              placeholder="Client name"
            />
            <FormFieldWithHint
              label="Address"
              value={form.address}
              onChangeText={(v) => update({ address: v })}
              placeholder="Full address"
              multiline
              numberOfLines={3}
            />
            <FormFieldWithHint
              label="Phone"
              value={form.phone}
              onChangeText={(v) => update({ phone: v })}
              placeholder="Phone number"
              keyboardType="phone-pad"
            />
            <FormFieldWithHint
              label="Email"
              value={form.email}
              onChangeText={(v) => update({ email: v })}
              placeholder="Email (if any)"
              keyboardType="email-address"
              autoCapitalize="none"
              textContentType="emailAddress"
              autoComplete="email"
            />
            {error ? (
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            ) : null}
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
                  <ThemedText style={styles.btnPrimaryText}>Save Client</ThemedText>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
