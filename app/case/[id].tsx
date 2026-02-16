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
import type { ClientRow } from "@/types/client";
import type { CaseRow } from "@/types/case";
import { formatCaseDate, getCaseDisplayTitle } from "@/types/case";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const text = value?.trim() || "—";
  return (
    <View style={detailStyles.row}>
      <ThemedText style={detailStyles.label}>{label}</ThemedText>
      <ThemedText style={detailStyles.value}>{text}</ThemedText>
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
      <SafeAreaView style={detailStyles.safeArea} edges={["top"]}>
        <View style={detailStyles.centered}>
          <ActivityIndicator size="large" color={theme.colors.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !caseData) {
    return (
      <SafeAreaView style={detailStyles.safeArea} edges={["top"]}>
        <View style={detailStyles.header}>
          <Pressable onPress={() => router.back()} style={detailStyles.backBtn}>
            <ThemedText style={detailStyles.backText}>← Back</ThemedText>
          </Pressable>
        </View>
        <View style={detailStyles.centered}>
          <ThemedText style={detailStyles.errorText}>
            {error || "Case not found"}
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const title = getCaseDisplayTitle(caseData);

  return (
    <SafeAreaView style={detailStyles.safeArea} edges={["top"]}>
      <View style={detailStyles.header}>
        <Pressable onPress={() => router.back()} style={detailStyles.backBtn}>
          <ThemedText style={detailStyles.backText}>← Back</ThemedText>
        </Pressable>
      </View>
      <ScrollView
        style={detailStyles.scroll}
        contentContainerStyle={detailStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={detailStyles.pageTitle}>{title}</ThemedText>

        <ThemedText style={detailStyles.sectionTitle}>
          Parties & type
        </ThemedText>
        <DetailRow label="Petitioner" value={caseData.petitioner_name} />
        <DetailRow label="Respondent" value={caseData.respondent_name} />
        <DetailRow label="Case number" value={caseData.case_number} />
        <DetailRow label="Case type" value={caseData.case_type} />
        <DetailRow label="Type of case" value={caseData.case_sub_type} />

        <ThemedText style={detailStyles.sectionTitle}>Court</ThemedText>
        <DetailRow label="Court tier" value={caseData.court_tier} />
        <DetailRow label="Court name" value={caseData.court_name} />
        <DetailRow label="Court room location" value={caseData.court_room} />
        <DetailRow label="Judge name" value={caseData.judge_name} />

        <ThemedText style={detailStyles.sectionTitle}>Client</ThemedText>
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
          <DetailRow label="Linked client" value={caseData.linked_client_name} />
        ) : null}

        <ThemedText style={detailStyles.sectionTitle}>
          Dates & status
        </ThemedText>
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

        <ThemedText style={detailStyles.sectionTitle}>Notes</ThemedText>
        <DetailRow label="Notes" value={caseData.notes} />
      </ScrollView>
    </SafeAreaView>
  );
}

const detailStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.pureWhite,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.themeGray3,
  },
  backBtn: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backText: {
    fontSize: 17,
    color: theme.colors.btnBlue,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.black,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.black,
    marginBottom: 12,
    marginTop: 8,
  },
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: theme.colors.gray50,
    marginBottom: 2,
  },
  value: {
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
