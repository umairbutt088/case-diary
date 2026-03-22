import { MaterialIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { DateField } from "@/components/add-case/date-field";
import { Bounceable } from "@/components/ui/bounceable";
import { ScreenHeader } from "@/components/ui/screen-header";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useIsOnline } from "@/hooks/use-is-online";
import {
  getCachedCaseById,
  patchCachedCase,
  removeCachedCase,
  upsertCachedCase,
} from "@/lib/cases-cache";
import { addCaseHearingEntry, getCaseHearingHistory } from "@/lib/case-hearings";
import { addPendingCaseDelete } from "@/lib/offline-queue";
import { supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";
import { formatCaseDate, getCaseDisplayTitle, getTodayISO } from "@/types/case";
import type { CaseHearingRow } from "@/types/case-hearing";
import type { ClientRow } from "@/types/client";
import { getPartyTerminology } from "@/constants/case-form";

const DETAIL_HEARING_PAGE_SIZE = 20;

function DetailRow({
  label,
  value,
  onValueLongPress,
  valueAccessibilityHint,
  onCopyPress,
}: {
  label: string;
  value: string | null | undefined;
  onValueLongPress?: () => void;
  valueAccessibilityHint?: string;
  onCopyPress?: () => void;
}) {
  const text = value?.trim() || "—";
  return (
    <View style={styles.detailRow}>
      <ThemedText style={styles.detailLabel}>{label}</ThemedText>
      <View style={styles.detailValueRow}>
        {onValueLongPress ? (
          <Pressable
            onLongPress={onValueLongPress}
            delayLongPress={250}
            accessibilityLabel={`${label}: ${text}`}
            accessibilityHint={valueAccessibilityHint}
            style={styles.detailValuePressable}
          >
            <ThemedText style={styles.detailValue}>{text}</ThemedText>
          </Pressable>
        ) : (
          <ThemedText style={[styles.detailValue, styles.detailValuePressable]}>
            {text}
          </ThemedText>
        )}
        {onCopyPress ? (
          <Bounceable
            onPress={onCopyPress}
            style={styles.copyIconButton}
            hitSlop={8}
            accessibilityLabel={`Copy ${label}`}
          >
            <MaterialIcons name="content-copy" size={16} color={theme.colors.gray50} />
          </Bounceable>
        ) : null}
      </View>
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
  const { session } = useAuth();
  const isOnline = useIsOnline();
  const [caseData, setCaseData] = useState<CaseRow | null>(null);
  const [linkedClient, setLinkedClient] = useState<ClientRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [hearingHistory, setHearingHistory] = useState<CaseHearingRow[]>([]);
  const [showProceedingForm, setShowProceedingForm] = useState(false);
  const [nextStatusDraft, setNextStatusDraft] = useState("");
  const [nextDateDraft, setNextDateDraft] = useState("");
  const [savingProceeding, setSavingProceeding] = useState(false);
  const [proceedingError, setProceedingError] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const copyNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCopyNotice = (message: string) => {
    setCopyNotice(message);
    if (copyNoticeTimeoutRef.current) clearTimeout(copyNoticeTimeoutRef.current);
    copyNoticeTimeoutRef.current = setTimeout(() => {
      setCopyNotice(null);
      copyNoticeTimeoutRef.current = null;
    }, 1400);
  };

  useEffect(() => {
    if (!id) {
      setError("Invalid case");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      if (session?.user?.id && !isOnline) {
        const cached = await getCachedCaseById(session.user.id, id);
        if (cancelled) return;
        setLoading(false);
        if (!cached) {
          setError("Case not available offline");
          return;
        }
        setCaseData(cached);
        return;
      }
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
      const row = data as CaseRow;
      setCaseData(row);
      if (session?.user?.id) {
        await upsertCachedCase(session.user.id, row);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, session?.user?.id, isOnline]);

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

  useEffect(() => {
    const caseId = caseData?.id;
    const userId = session?.user?.id;
    if (!caseId || !userId || !isOnline) {
      setHearingHistory([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const history = await getCaseHearingHistory(caseId, userId, {
        limit: DETAIL_HEARING_PAGE_SIZE,
        offset: 0,
      });
      if (cancelled) return;
      setHearingHistory(history);
    })();

    return () => {
      cancelled = true;
    };
  }, [caseData?.id, session?.user?.id, isOnline]);

  useEffect(() => {
    setNextDateDraft(caseData?.next_hearing_date || "");
  }, [caseData?.next_hearing_date]);

  useEffect(() => {
    return () => {
      if (copyNoticeTimeoutRef.current) {
        clearTimeout(copyNoticeTimeoutRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !caseData) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScreenHeader title="Error" />
        <View style={styles.centered}>
          <ThemedText style={styles.errorText}>
            {error || "Case not found"}
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const title = getCaseDisplayTitle(caseData);
  const recentHearings = hearingHistory.slice(0, 1);
  const hasMoreHearings = hearingHistory.length > 1;
  const previousHearingDate = caseData.next_hearing_date || getTodayISO();
  const previousProceeding =
    caseData.next_status?.trim() ||
    caseData.current_status?.trim() ||
    "Proceeding updated";
  const copyCaseNumber = async () => {
    if (!caseData.case_number?.trim()) {
      showCopyNotice("No case number");
      return;
    }
    await Clipboard.setStringAsync(caseData.case_number.trim());
    showCopyNotice("Case number copied");
  };
  const partyTerms = getPartyTerminology(caseData.court_tier ?? "", caseData.case_sub_type ?? "");
  const saveProceeding = async () => {
    if (!session?.user?.id) return;
    if (!isOnline) {
      setProceedingError("Proceeding history requires internet for now.");
      return;
    }
    if (!nextDateDraft.trim()) {
      setProceedingError("Next hearing date is required.");
      return;
    }
    if (!nextStatusDraft.trim()) {
      setProceedingError("Next proceeding detail is required.");
      return;
    }

    setSavingProceeding(true);
    setProceedingError(null);

    const resolvedCurrentStatus = previousProceeding;
    const resolvedNextStatus = nextStatusDraft.trim();
    const resolvedNextDate = nextDateDraft.trim();

    const historySaved = await addCaseHearingEntry({
      caseId: caseData.id,
      userId: session.user.id,
      hearingDate: previousHearingDate,
      proceeding: previousProceeding,
      currentStatus: resolvedCurrentStatus,
      nextStatus: resolvedNextStatus,
      nextHearingDate: resolvedNextDate,
    });

    if (!historySaved) {
      setSavingProceeding(false);
      setProceedingError("Failed to save proceeding history.");
      return;
    }

    const patch = {
      current_status: resolvedCurrentStatus,
      next_status: resolvedNextStatus,
      next_hearing_date: resolvedNextDate,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("cases")
      .update(patch)
      .eq("id", caseData.id)
      .eq("user_id", session.user.id);

    if (updateError) {
      setSavingProceeding(false);
      setProceedingError(updateError.message || "Failed to update case status.");
      return;
    }

    await patchCachedCase(session.user.id, caseData.id, patch);
    setCaseData((prev) => (prev ? { ...prev, ...patch } : prev));

    const history = await getCaseHearingHistory(caseData.id, session.user.id, {
      limit: DETAIL_HEARING_PAGE_SIZE,
      offset: 0,
    });
    setHearingHistory(history);

    setNextStatusDraft("");
    setNextDateDraft(resolvedNextDate);
    setShowProceedingForm(false);
    setSavingProceeding(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader
        title={title}
        onTitleLongPress={() => Alert.alert("Case title", title, [{ text: "OK" }])}
        rightComponent={
          <Bounceable
            style={styles.editBtn}
            onPress={() => router.push(`/case/${id}/edit`)}
          >
            <MaterialIcons name="edit" size={22} color={theme.colors.black} />
            <ThemedText style={styles.editBtnText}>Edit</ThemedText>
          </Bounceable>
        }
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(400).springify().damping(20)}>
          <SectionCard title="Parties & type">
            <DetailRow label={partyTerms.firstParty} value={caseData.petitioner_name} />
            <DetailRow label={partyTerms.secondParty} value={caseData.respondent_name} />
            <DetailRow
              label="Case number"
              value={caseData.case_number}
              onValueLongPress={() => void copyCaseNumber()}
              onCopyPress={() => void copyCaseNumber()}
              valueAccessibilityHint="Long press to copy case number"
            />
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
                  ? partyTerms.firstParty
                  : caseData.my_client_is === "respondent"
                    ? partyTerms.secondParty
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

          <SectionCard title="Hearing history">
            <Bounceable
              style={styles.addProceedingBtn}
              onPress={() => {
                setShowProceedingForm((prev) => !prev);
                setProceedingError(null);
              }}
            >
              <MaterialIcons
                name={showProceedingForm ? "close" : "add"}
                size={18}
                color={theme.colors.black}
              />
              <ThemedText style={styles.addProceedingText}>
                Add proceeding
              </ThemedText>
            </Bounceable>

            <View style={styles.currentHearingCard}>
              <ThemedText style={styles.currentHearingTitle}>Next hearing</ThemedText>
              <ThemedText style={styles.currentHearingDate}>
                {caseData.next_hearing_date
                  ? formatCaseDate(caseData.next_hearing_date)
                  : "No date set"}
              </ThemedText>
              <ThemedText style={styles.currentHearingDetail}>
                {(caseData.next_status || caseData.current_status || "No proceeding detail").trim()}
              </ThemedText>
            </View>

            <ThemedText style={styles.previousHeading}>Previous hearings</ThemedText>

            {recentHearings.length === 0 ? (
              <DetailRow label="Proceedings" value="No history yet" />
            ) : (
              recentHearings.map((entry) => (
                <View key={entry.id} style={styles.historyItem}>
                  <ThemedText style={styles.historyDate}>
                    {formatCaseDate(entry.hearing_date)}
                  </ThemedText>
                  <ThemedText style={styles.historyProceeding}>
                    {(entry.proceeding || entry.current_status || "Proceeding updated").trim()}
                  </ThemedText>
                  <ThemedText style={styles.historyNext}>
                    Next: {entry.next_status?.trim() || "—"} •{" "}
                    {entry.next_hearing_date
                      ? formatCaseDate(entry.next_hearing_date)
                      : "No date"}
                  </ThemedText>
                </View>
              ))
            )}

            {hasMoreHearings ? (
              <Bounceable
                style={styles.seeAllBtn}
                onPress={() => router.push(`/case/${id}/hearings`)}
              >
                <ThemedText style={styles.seeAllBtnText}>See all hearings</ThemedText>
                <MaterialIcons
                  name="chevron-right"
                  size={18}
                  color={theme.colors.black}
                />
              </Bounceable>
            ) : null}
          </SectionCard>

          <SectionCard title="Notes">
            <DetailRow label="Notes" value={caseData.notes} />
          </SectionCard>

          <Bounceable
            style={styles.deleteButton}
            onPress={() => {
              Alert.alert(
                "Delete case?",
                "This cannot be undone. The case and its details will be permanently removed.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      if (!id || !session?.user?.id) return;
                      if (!isOnline) {
                        await addPendingCaseDelete(session.user.id, id);
                        await removeCachedCase(session.user.id, id);
                        router.replace("/(tabs)");
                        return;
                      }
                      setDeleting(true);
                      const { error: e } = await supabase
                        .from("cases")
                        .delete()
                        .eq("id", id)
                        .eq("user_id", session.user.id);
                      setDeleting(false);
                      if (e) {
                        Alert.alert("Error", e.message);
                        return;
                      }
                      await removeCachedCase(session.user.id, id);
                      router.replace("/(tabs)");
                    },
                  },
                ],
              );
            }}
            disabled={deleting}
          >
            {deleting ? (
              <ThemedText style={styles.deleteButtonText}>Deleting…</ThemedText>
            ) : (
              <ThemedText style={styles.deleteButtonText}>Delete case</ThemedText>
            )}
          </Bounceable>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showProceedingForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProceedingForm(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              if (!savingProceeding) setShowProceedingForm(false);
            }}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Add proceeding</ThemedText>
              <Bounceable
                style={styles.modalClose}
                onPress={() => {
                  if (!savingProceeding) setShowProceedingForm(false);
                }}
              >
                <MaterialIcons name="close" size={20} color={theme.colors.black} />
              </Bounceable>
            </View>

            <ScrollView
              style={styles.proceedingForm}
              contentContainerStyle={styles.proceedingFormContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.previousInfoBox}>
                <ThemedText style={styles.previousInfoLabel}>Previous hearing</ThemedText>
                <ThemedText style={styles.previousInfoDate}>
                  {formatCaseDate(previousHearingDate)}
                </ThemedText>
                <ThemedText style={styles.previousInfoText}>
                  {previousProceeding}
                </ThemedText>
              </View>

              <ThemedText style={styles.inputLabel}>Next proceeding detail</ThemedText>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={nextStatusDraft}
                onChangeText={setNextStatusDraft}
                placeholder="e.g. Evidence, Final arguments"
                placeholderTextColor={theme.colors.gray50}
                multiline
              />

              <DateField
                label="Next hearing date"
                required
                value={nextDateDraft}
                onChange={setNextDateDraft}
                placeholder="e.g. 30/03/2026"
              />

              {proceedingError ? (
                <ThemedText style={styles.formErrorText}>{proceedingError}</ThemedText>
              ) : null}

              <Bounceable
                style={styles.saveProceedingBtn}
                onPress={() => void saveProceeding()}
                disabled={savingProceeding}
              >
                <ThemedText style={styles.saveProceedingBtnText}>
                  {savingProceeding ? "Saving..." : "Save proceeding"}
                </ThemedText>
              </Bounceable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {copyNotice ? (
        <View pointerEvents="none" style={styles.copyToastWrap}>
          <ThemedText style={styles.copyToastText}>{copyNotice}</ThemedText>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    color: theme.colors.black,
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
  historyItem: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderGray,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.black,
    marginBottom: 4,
  },
  historyProceeding: {
    fontSize: 15,
    color: theme.colors.black,
    marginBottom: 4,
  },
  historyNext: {
    fontSize: 13,
    color: theme.colors.gray50,
  },
  currentHearingCard: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.cream50,
  },
  currentHearingTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: theme.colors.gray50,
    marginBottom: 4,
    fontWeight: "600",
  },
  currentHearingDate: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.black,
    marginBottom: 6,
  },
  currentHearingDetail: {
    fontSize: 15,
    color: theme.colors.black,
  },
  previousHeading: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: theme.colors.gray50,
    marginBottom: 10,
    fontWeight: "600",
  },
  seeAllBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  seeAllBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.black,
  },
  addProceedingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.colors.cream50,
  },
  addProceedingText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.black,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: theme.colors.pureWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: "80%",
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
    color: theme.colors.black,
  },
  modalClose: {
    minWidth: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: theme.colors.background,
  },
  proceedingForm: {
    flexGrow: 0,
    maxHeight: "100%",
  },
  proceedingFormContent: {
    marginBottom: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: theme.colors.pureWhite,
  },
  previousInfoBox: {
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: theme.colors.cream50,
    padding: 10,
  },
  previousInfoLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.gray50,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  previousInfoDate: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.black,
    marginBottom: 2,
  },
  previousInfoText: {
    fontSize: 14,
    color: theme.colors.black,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.gray50,
    marginBottom: 6,
    marginTop: 8,
    textTransform: "uppercase",
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.black,
    backgroundColor: theme.colors.background,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  formErrorText: {
    marginTop: 10,
    fontSize: 13,
    color: theme.colors.themeRed,
  },
  saveProceedingBtn: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: theme.colors.black,
  },
  saveProceedingBtnText: {
    color: theme.colors.pureWhite,
    fontSize: 14,
    fontWeight: "600",
  },
  detailValueRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "space-between",
    gap: 8,
  },
  detailValuePressable: {
    flex: 1,
  },
  copyIconButton: {
    padding: 4,
    alignSelf: "flex-end",
  },
  copyToastWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  copyToastText: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    fontSize: 14,
    color: theme.colors.pureWhite,
    backgroundColor: theme.colors.black + "CC",
    overflow: "hidden",
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
  deleteButton: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.themeRed,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.themeRed,
  },
});
