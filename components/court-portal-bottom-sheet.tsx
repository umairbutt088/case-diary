import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Bounceable } from "@/components/ui";
import {
  type AppColors,
  modalSheetBackground,
} from "@/constants/color-palette";
import {
  COURT_PORTAL_SECTIONS,
  getPakistanCourtPortalById,
  type PakistanCourtPortal,
} from "@/constants/court-cms";
import { useAppTheme } from "@/context/app-theme-context";
import { useThemePalette } from "@/hooks/use-theme-palette";
import {
  getLastCourtPortalId,
  setLastCourtPortalId,
} from "@/lib/court-portal-preference";

type CourtPortalBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  onOpenPortal: (entry: PakistanCourtPortal) => void;
};

export function CourtPortalBottomSheet({
  visible,
  onClose,
  onOpenPortal,
}: CourtPortalBottomSheetProps) {
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const styles = useMemo(
    () => createStyles(C, modalSheetBackground(C, isDark)),
    [C, isDark],
  );
  const [courtPortalPickId, setCourtPortalPickId] = useState<string | null>(null);
  const [lastPortalId, setLastPortalIdState] = useState<string | null>(null);

  useEffect(() => {
    void getLastCourtPortalId().then((id) => setLastPortalIdState(id));
  }, []);

  useEffect(() => {
    if (!visible) return;
    const pre = getPakistanCourtPortalById(lastPortalId);
    setCourtPortalPickId(pre?.id ?? null);
  }, [visible, lastPortalId]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalOverlay} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <ThemedText type="accent" style={styles.modalTitle}>Court case search</ThemedText>
            <Bounceable style={styles.modalClose} onPress={onClose}>
              <MaterialIcons name="close" size={20} color={C.textPrimary} />
            </Bounceable>
          </View>
          <ThemedText type="default" style={styles.courtPortalModalIntro}>
            Select trial court / registry, a High Court, or the Supreme Court, then open the
            website and paste your case number on the court site.
          </ThemedText>
          <ScrollView
            style={styles.courtPortalScroll}
            contentContainerStyle={styles.courtPortalListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {COURT_PORTAL_SECTIONS.map((section, sectionIdx) => (
              <View key={section.title}>
                <ThemedText type="accent"
                  style={[
                    styles.courtPortalSectionTitle,
                    sectionIdx === 0 && styles.courtPortalSectionTitleFirst,
                  ]}
                >
                  {section.title}
                </ThemedText>
                {section.items.map((portal) => {
                  const selected = courtPortalPickId === portal.id;
                  return (
                    <TouchableOpacity
                      key={portal.id}
                      style={[
                        styles.courtPortalOption,
                        selected && styles.courtPortalOptionSelected,
                      ]}
                      activeOpacity={0.75}
                      onPress={() => setCourtPortalPickId(portal.id)}
                    >
                      <View style={styles.courtPortalOptionRow}>
                        <View style={styles.courtPortalOptionTexts}>
                          <ThemedText type="label" style={styles.courtPortalOptionLabel}>
                            {portal.label}
                          </ThemedText>
                          <ThemedText type="default" style={styles.courtPortalOptionDesc}>
                            {portal.description}
                          </ThemedText>
                        </View>
                        <View style={styles.courtPortalOptionIconCol}>
                          {selected ? (
                            <MaterialIcons
                              name="check-circle"
                              size={24}
                              color={C.textAccent}
                            />
                          ) : (
                            <MaterialIcons
                              name="radio-button-unchecked"
                              size={22}
                              color={C.borderGray}
                            />
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
          <Bounceable
            style={[
              styles.courtPortalOpenBtn,
              !courtPortalPickId && styles.courtPortalOpenBtnDisabled,
            ]}
            disabled={!courtPortalPickId}
            onPress={() => {
              const entry = getPakistanCourtPortalById(courtPortalPickId);
              if (!entry) return;
              onClose();
              void setLastCourtPortalId(entry.id);
              setLastPortalIdState(entry.id);
              onOpenPortal(entry);
            }}
          >
            <ThemedText style={styles.courtPortalOpenBtnText}>Open website</ThemedText>
          </Bounceable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(C: AppColors, modalSheet: string) {
  return StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.34)",
    },
    modalCard: {
      backgroundColor: modalSheet,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 18,
      maxHeight: "74%",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
    },
    modalClose: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.background,
    },
    courtPortalModalIntro: {
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 10,
    },
    courtPortalScroll: {
      marginBottom: 12,
    },
    courtPortalListContent: {
      paddingBottom: 8,
    },
    courtPortalSectionTitle: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 12,
      marginBottom: 8,
    },
    courtPortalSectionTitleFirst: {
      marginTop: 0,
    },
    courtPortalOption: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.borderGray,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
      backgroundColor: C.background,
    },
    courtPortalOptionSelected: {
      borderColor: C.themeBlack,
      backgroundColor: C.gray100,
    },
    courtPortalOptionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    courtPortalOptionTexts: {
      flex: 1,
      gap: 2,
    },
    courtPortalOptionLabel: {
      fontSize: 14,
      fontWeight: "700",
    },
    courtPortalOptionDesc: {
      fontSize: 12,
      lineHeight: 17,
    },
    courtPortalOptionIconCol: {
      width: 26,
      alignItems: "flex-end",
    },
    courtPortalOpenBtn: {
      height: 46,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.themeBlack,
    },
    courtPortalOpenBtnDisabled: {
      opacity: 0.5,
    },
    courtPortalOpenBtnText: {
      color: C.textInverse,
      fontWeight: "700",
      fontSize: 15,
    },
  });
}
