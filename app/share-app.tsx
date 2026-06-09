import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
  APP_DISPLAY_NAME,
  getPrimaryInstallUrl,
  hasIosStoreListing,
} from "@/constants/app-install";
import type { AppColors } from "@/constants/color-palette";
import { theme } from "@/constants/theme";
import { useHomeBackNavigation } from "@/hooks/use-home-back-navigation";
import { useThemePalette } from "@/hooks/use-theme-palette";
import {
  copyInstallLink,
  openPlatformStore,
  shareInstallLink,
} from "@/lib/app-install";

function createStyles(C: AppColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
      gap: 16,
    },
    heroCard: {
      borderRadius: 16,
      padding: 20,
      backgroundColor: C.pureWhite,
      alignItems: "center",
      ...theme.shadow,
    },
    heroTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: C.black,
      textAlign: "center",
    },
    heroSubtitle: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 20,
      color: C.gray50,
      textAlign: "center",
    },
    qrWrap: {
      marginTop: 20,
      padding: 16,
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: C.borderGray,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 252,
      minWidth: 252,
    },
    qrHint: {
      marginTop: 12,
      fontSize: 13,
      color: C.gray50,
      textAlign: "center",
    },
    linkCard: {
      borderRadius: 14,
      padding: 14,
      backgroundColor: C.grey100,
    },
    linkLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: C.gray50,
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    linkText: {
      fontSize: 13,
      lineHeight: 18,
      color: C.black,
    },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: C.themeBlack,
    },
    actionBtnSecondary: {
      backgroundColor: C.pureWhite,
      borderWidth: 1,
      borderColor: C.borderGray,
    },
    actionBtnText: {
      fontSize: 15,
      fontWeight: "700",
      color: C.pureWhite,
    },
    actionBtnTextSecondary: {
      color: C.black,
    },
    storeBtn: {
      minHeight: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.borderGray,
      backgroundColor: C.pureWhite,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    storeBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: C.black,
      textAlign: "center",
    },
    noteText: {
      fontSize: 12,
      lineHeight: 18,
      color: C.gray50,
      textAlign: "center",
    },
  });
}

export default function ShareAppScreen() {
  const C = useThemePalette();
  const styles = useMemo(() => createStyles(C), [C]);
  const { goBack } = useHomeBackNavigation();
  const [sharing, setSharing] = useState(false);
  const [copying, setCopying] = useState(false);

  const installUrl = getPrimaryInstallUrl();

  const handleCopy = async () => {
    if (copying) return;
    setCopying(true);
    try {
      await copyInstallLink();
      Alert.alert("Link copied", "Install link copied to clipboard.");
    } catch {
      // copyInstallLink shows its own alert
    } finally {
      setCopying(false);
    }
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await shareInstallLink();
    } catch {
      // shareInstallLink shows its own alert
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader title="Share app" onBack={goBack} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <ThemedText style={styles.heroTitle}>Invite someone to install</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            Share the Google Play link or let them scan the QR code to install{" "}
            {APP_DISPLAY_NAME} on Android.
          </ThemedText>

          <View style={styles.qrWrap}>
            <QRCode
              value={installUrl}
              size={220}
              color="#000000"
              backgroundColor="#FFFFFF"
              ecl="M"
            />
          </View>
          <ThemedText style={styles.qrHint}>Scan to open Google Play</ThemedText>
        </View>

        <View style={styles.linkCard}>
          <ThemedText style={styles.linkLabel}>Install link</ThemedText>
          <ThemedText style={styles.linkText} selectable>
            {installUrl}
          </ThemedText>
        </View>

        <Pressable
          style={styles.actionBtn}
          onPress={() => void handleShare()}
          disabled={sharing}
        >
          <MaterialIcons name="share" size={20} color={C.pureWhite} />
          <ThemedText style={styles.actionBtnText}>
            {sharing ? "Opening share…" : "Share install link"}
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={() => void handleCopy()}
          disabled={copying}
        >
          <MaterialIcons name="content-copy" size={20} color={C.black} />
          <ThemedText style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>
            {copying ? "Copying…" : "Copy link"}
          </ThemedText>
        </Pressable>

        <Pressable style={styles.storeBtn} onPress={() => void openPlatformStore()}>
          <ThemedText style={styles.storeBtnText}>Open Google Play</ThemedText>
        </Pressable>

        <ThemedText style={styles.noteText}>
          {hasIosStoreListing()
            ? "Shared messages include both Google Play and App Store links."
            : "iPhone App Store link will be added to shared messages once the iOS app is published."}
        </ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}
