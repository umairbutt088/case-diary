import { MaterialIcons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Bounceable } from "@/components/ui";
import { ScreenHeader } from "@/components/ui/screen-header";
import type { AppColors } from "@/constants/color-palette";
import { ACTS_LIBRARY, type ActLibraryItem } from "@/constants/acts-library";
import { theme } from "@/constants/theme";
import { useThemePalette } from "@/hooks/use-theme-palette";

function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createActsStyles(C: AppColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    content: {
      padding: 20,
      paddingBottom: 36,
      gap: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: "800",
      color: C.black,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 13,
      color: C.gray50,
      marginBottom: 8,
    },
    searchInput: {
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 12,
      paddingHorizontal: 14,
      height: 46,
      color: C.black,
      backgroundColor: C.pureWhite,
      fontSize: 15,
      marginBottom: 4,
    },
    card: {
      borderRadius: 14,
      backgroundColor: C.pureWhite,
      paddingVertical: 12,
      paddingHorizontal: 12,
      ...theme.shadow,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    cardMain: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: C.black,
      marginBottom: 4,
    },
    cardMeta: {
      fontSize: 12,
      color: C.gray50,
    },
    openIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.gray100,
    },
    emptyText: {
      marginTop: 18,
      textAlign: "center",
      color: C.gray50,
      fontSize: 14,
    },
    openingWrap: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 8,
    },
    openingText: {
      fontSize: 13,
      color: C.gray50,
    },
  });
}

export default function ActsScreen() {
  const C = useThemePalette();
  const styles = useMemo(() => createActsStyles(C), [C]);
  const [query, setQuery] = useState("");
  const [openingActId, setOpeningActId] = useState<string | null>(null);
  const [filteredActs, setFilteredActs] = useState<readonly ActLibraryItem[]>(
    ACTS_LIBRARY,
  );

  const handleSearchChange = (value: string) => {
    setQuery(value);
    const q = normalizeForSearch(value);
    if (!q) {
      setFilteredActs(ACTS_LIBRARY);
      return;
    }
    const qTokens = q.split(" ");
    const next = ACTS_LIBRARY.filter((a) => {
      const normalizedTitle = normalizeForSearch(a.title);
      return qTokens.every((token) => normalizedTitle.includes(token));
    });
    setFilteredActs(next);
  };

  const openAct = async (act: ActLibraryItem) => {
    setOpeningActId(act.id);
    try {
      const asset = Asset.fromModule(act.pdfModule);
      await asset.downloadAsync();
      const candidateUris = [asset.uri, asset.localUri].filter(
        (value): value is string => Boolean(value),
      );

      let opened = false;
      for (const uri of candidateUris) {
        try {
          await WebBrowser.openBrowserAsync(uri, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          });
          opened = true;
          break;
        } catch {
          try {
            await Linking.openURL(uri);
            opened = true;
            break;
          } catch {
            // Try next available URI strategy.
          }
        }
      }

      if (!opened && asset.localUri) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(asset.localUri, {
            mimeType: "application/pdf",
            UTI: "com.adobe.pdf",
            dialogTitle: act.title,
          });
          opened = true;
        }
      }

      if (!opened) throw new Error("Unable to open PDF");
    } catch {
      Alert.alert("Error", "Could not open this act.");
    } finally {
      setOpeningActId((prev) => (prev === act.id ? null : prev));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Acts & Laws" />
      <FlatList
        data={filteredActs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <ThemedText style={styles.subtitle}>
              Read legal acts directly in the app. Search by title, category, or year.
            </ThemedText>
            <TextInput
              value={query}
              onChangeText={handleSearchChange}
              placeholder="Search by act name"
              placeholderTextColor={C.gray50}
              style={styles.searchInput}
              autoCorrect={false}
              spellCheck={false}
              autoCapitalize="none"
            />
            {openingActId ? (
              <View style={styles.openingWrap}>
                <ActivityIndicator size="small" color={C.black} />
                <ThemedText style={styles.openingText}>Opening act...</ThemedText>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>No acts found for this search.</ThemedText>
        }
        renderItem={({ item }) => (
          <Bounceable style={styles.card} onPress={() => void openAct(item)}>
            <View style={styles.cardRow}>
              <View style={styles.cardMain}>
                <ThemedText style={styles.cardTitle}>{item.title}</ThemedText>
                <ThemedText style={styles.cardMeta}>
                  {item.jurisdiction} • {item.category} • {item.year}
                </ThemedText>
              </View>
              <View style={styles.openIconWrap}>
                <MaterialIcons name="open-in-new" size={18} color={C.black} />
              </View>
            </View>
          </Bounceable>
        )}
      />
    </SafeAreaView>
  );
}
