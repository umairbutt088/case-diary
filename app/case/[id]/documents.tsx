import { MaterialIcons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Bounceable } from "@/components/ui/bounceable";
import { DocumentIconPreview } from "@/components/ui/document-icon-preview";
import { ImageViewerModal } from "@/components/ui/image-viewer-modal";
import { ScreenHeader } from "@/components/ui/screen-header";
import type { AppColors } from "@/constants/color-palette";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useAccessGuard } from "@/hooks/use-access-guard";
import { useIsOnline } from "@/hooks/use-is-online";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { deleteCaseDocument, getCaseDocuments, getDocumentDownloadUrl } from "@/lib/case-documents";
import { supabase } from "@/lib/supabase";
import { formatCaseDate, getCaseDisplayTitle, type CaseRow } from "@/types/case";
import type { CaseDocumentRow } from "@/types/case-document";

function createDocumentsStyles(C: AppColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    caseTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 14,
    },
    card: {
      borderRadius: 12,
      backgroundColor: C.pureWhite,
      padding: 14,
      marginBottom: 12,
      ...theme.shadow,
    },
    historyItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    historyDate: {
      fontSize: 15,
      fontWeight: "700",
      marginBottom: 6,
    },
    historyNext: {
      fontSize: 13,
    },
    emptyText: {
      fontSize: 15,
    },
    errorText: {
      marginBottom: 10,
      fontSize: 14,
    },
  });
}

export default function CaseDocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, can } = useAuth();
  const accessGuard = useAccessGuard("manage_documents");
  const canManageDocuments = can("manage_documents");
  const C = useThemePalette();
  const styles = useMemo(() => createDocumentsStyles(C), [C]);
  const isOnline = useIsOnline();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("All documents");
  const [documents, setDocuments] = useState<CaseDocumentRow[]>([]);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !session?.user?.id) {
      setLoading(false);
      setError("Invalid case.");
      return;
    }

    if (!isOnline) {
      setLoading(false);
      setError("You must be online to view documents.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: caseData } = await supabase.from("cases").select("*").eq("id", id).single();
        if (cancelled) return;
        if (caseData) {
          setTitle(getCaseDisplayTitle(caseData as CaseRow));
        }
        
        const docs = await getCaseDocuments(id);
        if (cancelled) return;
        setDocuments(docs);
      } catch {
        if (cancelled) return;
        setError("Failed to load documents.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, session?.user?.id, isOnline]);

  const handleDeleteDocument = (docId: string, filePath: string) => {
    if (!canManageDocuments) {
      Alert.alert("Restricted", "You do not have permission to manage documents.");
      return;
    }
    if (!isOnline) {
      Alert.alert("Offline", "You need to be online to delete documents.");
      return;
    }
    
    Alert.alert(
      "Delete Document?",
      "Are you sure you want to permanently delete this document?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteCaseDocument(docId, filePath);
              setDocuments((prev) => prev.filter((d) => d.id !== docId));
            } catch (error) {
              Alert.alert("Error", "Could not delete document.");
            }
          }
        }
      ]
    );
  };

  const handleViewDocument = async (doc: CaseDocumentRow) => {
    try {
      const url = await getDocumentDownloadUrl(doc.file_path);
      if (doc.mime_type?.startsWith("image/")) {
        setViewerUrl(url);
      } else {
        await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
      }
    } catch (error) {
      Alert.alert("Error", "Could not open document.");
    }
  };

  if (accessGuard.blocked) {
    return null;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="All documents" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.textPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="All documents" />
      <FlatList
        data={documents}
        keyExtractor={(entry) => entry.id}
        style={{ backgroundColor: C.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <ThemedText type="accent" style={styles.caseTitle}>{title}</ThemedText>
            {error ? <ThemedText type="danger" style={styles.errorText}>{error}</ThemedText> : null}
          </>
        }
        ListEmptyComponent={
          <ThemedText type="muted" style={styles.emptyText}>No documents recorded yet.</ThemedText>
        }
        renderItem={({ item: doc }) => (
          <View style={styles.card}>
            <View style={styles.historyItem}>
              <Bounceable style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingRight: 8 }} onPress={() => void handleViewDocument(doc)}>
                <DocumentIconPreview filePath={doc.file_path} mimeType={doc.mime_type} C={C} />
                <View style={{ flex: 1 }}>
                  <ThemedText type="secondary" style={styles.historyDate} numberOfLines={1}>{doc.file_name}</ThemedText>
                  <ThemedText type="secondary" style={styles.historyNext}>
                    {doc.size_bytes ? (doc.size_bytes / 1024).toFixed(1) + " KB" : "Unknown size"} • {formatCaseDate(doc.created_at)}
                  </ThemedText>
                </View>
              </Bounceable>
              <Bounceable onPress={() => handleDeleteDocument(doc.id, doc.file_path)}>
                <MaterialIcons name="delete-outline" size={24} color={C.themeRed} />
              </Bounceable>
            </View>
          </View>
        )}
      />

      <ImageViewerModal
        visible={viewerUrl !== null}
        imageUrl={viewerUrl}
        onClose={() => setViewerUrl(null)}
      />
    </SafeAreaView>
  );
}
