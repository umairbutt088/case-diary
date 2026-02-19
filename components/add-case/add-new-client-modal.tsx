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

import { FormFieldWithHint } from "@/components/add-case/form-field-with-hint";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type NewClientForm = {
  name: string;
  address: string;
  phone: string;
  email: string;
  careOf: string;
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
  careOf: "",
};

export function AddNewClientModal({
  visible,
  initialName = "",
  onClose,
  onSaved,
}: Props) {
  const { session } = useAuth();
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
    if (!session?.user?.id || !isSupabaseConfigured) {
      setError("You must be signed in to add a client.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: e } = await supabase
      .from("clients")
      .insert({
        user_id: session.user.id,
        name,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        care_of: form.careOf.trim() || null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (e) {
      setError(e.message || "Failed to add client.");
      return;
    }
    if (data?.id) {
      Keyboard.dismiss();
      resetForm();
      onSaved(data.id);
      onClose();
    }
  }, [form, session?.user?.id, onSaved, onClose, resetForm]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Add New Client</ThemedText>
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
            />
            <FormFieldWithHint
              label="Care of"
              value={form.careOf}
              onChangeText={(v) => update({ careOf: v })}
              placeholder="Care of (e.g. father's name)"
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
                  <ActivityIndicator size="small" color={theme.colors.black} />
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
    maxHeight: 480,
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
