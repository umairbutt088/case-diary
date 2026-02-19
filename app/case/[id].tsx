import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";
import { formatCaseDate, getCaseDisplayTitle } from "@/types/case";
import type { ClientRow } from "@/types/client";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const text = value?.trim() || "—";
  return (
    <View style={styles.detailRow}>
      <ThemedText style={styles.detailLabel}>{label}</ThemedText>
      <ThemedText style={styles.detailValue}>{text}</ThemedText>
    </View>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {children}
    </View>
  );
}

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [caseData, setCaseData] = useState<CaseRow | null>(null);
  const [linkedClient, setLinkedClient] = useState<ClientRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Invalid case");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase
        .from("cases")
        .select("*")
        .eq("id", id)
        .single();
      if (cancelled) return;
      setLoading(false);
      if (e) {
        setError(e.message || "Failed to load case");
        return;
      }
      setCaseData(data as CaseRow);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const clientId = caseData?.linked_client_id;
    if (!clientId) {
      setLinkedClient(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();
      if (cancelled) return;
      if (!e && data) setLinkedClient(data as ClientRow);
      else setLinkedClient(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [caseData?.linked_client_id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !caseData) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons
              name="arrow-back"
              size={24}
              color={theme.colors.btnBlue}
            />
          </Pressable>
        </View>
        <View style={styles.centered}>
          <ThemedText style={styles.errorText}>
            {error || "Case not found"}
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const title = getCaseDisplayTitle(caseData);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons
            name="arrow-back"
            size={24}
            color={theme.colors.btnBlue}
          />
        </Pressable>
        <ThemedText style={styles.headerTitle} numberOfLines={1}>
          {title}
        </ThemedText>
        <Pressable
          style={styles.editBtn}
          onPress={() => router.push(`/case/${id}/edit`)}
        >
          <MaterialIcons name="edit" size={22} color={theme.colors.btnBlue} />
          <ThemedText style={styles.editBtnText}>Edit</ThemedText>
        </Pressable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SectionCard title="Parties & type">
          <DetailRow label="Petitioner" value={caseData.petitioner_name} />
          <DetailRow label="Respondent" value={caseData.respondent_name} />
          <DetailRow label="Case number" value={caseData.case_number} />
          <DetailRow label="Case type" value={caseData.case_type} />
          <DetailRow label="Type of case" value={caseData.case_sub_type} />
        </SectionCard>

        <SectionCard title="Court">
          <DetailRow label="Court tier" value={caseData.court_tier} />
          <DetailRow label="Court room location" value={caseData.court_room} />
          <DetailRow label="Judge name" value={caseData.judge_name} />
        </SectionCard>

        <SectionCard title="Client">
          <DetailRow
            label="My client is"
            value={
              caseData.my_client_is === "petitioner"
                ? "Petitioner"
                : caseData.my_client_is === "respondent"
                  ? "Respondent"
                  : null
            }
          />
          {linkedClient ? (
            <>
              <DetailRow label="Client name" value={linkedClient.name} />
              {linkedClient.care_of?.trim() ? (
                <DetailRow label="Care of" value={linkedClient.care_of} />
              ) : null}
              {linkedClient.address?.trim() ? (
                <DetailRow label="Address" value={linkedClient.address} />
              ) : null}
              {linkedClient.phone?.trim() ? (
                <DetailRow label="Phone" value={linkedClient.phone} />
              ) : null}
              {linkedClient.email?.trim() ? (
                <DetailRow label="Email" value={linkedClient.email} />
              ) : null}
            </>
          ) : caseData.linked_client_name ? (
            <DetailRow
              label="Linked client"
              value={caseData.linked_client_name}
            />
          ) : null}
        </SectionCard>

        <SectionCard title="Dates & status">
          <DetailRow
            label="Date of filing"
            value={
              caseData.date_of_filing
                ? formatCaseDate(caseData.date_of_filing)
                : null
            }
          />
          <DetailRow
            label="Next hearing date"
            value={
              caseData.next_hearing_date
                ? formatCaseDate(caseData.next_hearing_date)
                : null
            }
          />
          <DetailRow label="Current status" value={caseData.current_status} />
          <DetailRow label="Next status" value={caseData.next_status} />
        </SectionCard>

        <SectionCard title="Notes">
          <DetailRow label="Notes" value={caseData.notes} />
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.themeGray3,
    backgroundColor: theme.colors.pureWhite,
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.black,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  editBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.btnBlue,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: theme.colors.pureWhite,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...theme.shadow,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.gray50,
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailRow: {
    marginBottom: 14,
  },
  detailLabel: {
    fontSize: 13,
    color: theme.colors.gray50,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: theme.colors.black,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    color: theme.colors.themeRed,
    fontSize: 16,
  },
});
