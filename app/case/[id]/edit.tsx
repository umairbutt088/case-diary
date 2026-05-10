import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Keyboard,
    StyleSheet,
    Text,
    View
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddJudgeBottomSheet } from "@/components/add-case/add-judge-bottom-sheet";
import { AddNewClientModal } from "@/components/add-case/add-new-client-modal";
import { ChipGroup } from "@/components/add-case/chip-group";
import { CourtTierPicker } from "@/components/add-case/court-tier-picker";
import { DateField } from "@/components/add-case/date-field";
import { FormField } from "@/components/add-case/form-field";
import { FormFieldWithHint } from "@/components/add-case/form-field-with-hint";
import { JudgeNameSelector } from "@/components/add-case/judge-name-selector";
import { LinkExistingClientField } from "@/components/add-case/link-existing-client-field";
import { RadioOption } from "@/components/add-case/radio-option";
import { ThemedText } from "@/components/themed-text";
import { Bounceable } from "@/components/ui/bounceable";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
    CASE_TYPES,
    getCaseSubTypesForType,
    getDerivedCaseTitle,
    getPartyTerminology,
    initialAddCaseFormState,
    type AddCaseFormState,
    type CaseType,
} from "@/constants/case-form";
import type { AppColors } from "@/constants/color-palette";
import { useAppTheme } from "@/context/app-theme-context";
import { useAuth } from "@/context/auth-context";
import { useAccessGuard } from "@/hooks/use-access-guard";
import { useIsOnline } from "@/hooks/use-is-online";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { addCaseHearingEntry } from "@/lib/case-hearings";
import {
    getCachedCaseById,
    patchCachedCase,
    upsertCachedCase,
} from "@/lib/cases-cache";
import { addPendingCaseUpdate } from "@/lib/offline-queue";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";

function caseRowToFormState(row: CaseRow): AddCaseFormState {
  return {
    caseNumber: row.case_number ?? "",
    caseType: (row.case_type as CaseType) ?? "",
    caseSubType: row.case_sub_type ?? "",
    courtTier: row.court_tier ?? "",
    courtName: row.court_name ?? "",
    courtRoom: row.court_room ?? "",
    judgeName: row.judge_name ?? "",
    petitionerName: row.petitioner_name ?? "",
    respondentName: row.respondent_name ?? "",
    myClientIs:
      row.my_client_is === "petitioner"
        ? "petitioner"
        : row.my_client_is === "respondent"
          ? "respondent"
          : "",
    clientOption: row.linked_client_id
      ? "new"
      : row.linked_client_name
        ? "link"
        : "",
    linkedClientSearch: "",
    linkedClientId: row.linked_client_id ?? null,
    linkedClientName: row.linked_client_name ?? "",
    dateOfFiling: row.date_of_filing ?? "",
    nextHearingDate: row.next_hearing_date ?? "",
    caseStatus: row.current_status ?? "",
    nextStatus: row.next_status ?? "",
    notes: row.notes ?? "",
  };
}

function createEditCaseStyles(C: AppColors, onPrimary: string) {
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
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: C.gray50,
      marginBottom: 12,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    fieldError: {
      color: C.themeRed,
      fontSize: 14,
      marginTop: 4,
      marginBottom: 4,
    },
    statusInput: {
      minHeight: 100,
    },
    addClientBtn: {
      borderWidth: 1,
      borderColor: C.themeBlack,
      borderRadius: 10,
      backgroundColor: C.themeBlack,
      paddingVertical: 14,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    addClientText: {
      fontSize: 16,
      fontWeight: "600",
      color: onPrimary,
    },
    saveError: {
      color: C.themeRed,
      fontSize: 14,
      marginTop: 12,
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
      backgroundColor: C.btnGray,
    },
    btnSecondaryText: {
      fontSize: 16,
      fontWeight: "600",
      color: C.GrayBtnTitle,
    },
    btnPrimary: {
      backgroundColor: C.themeBlack,
    },
    btnPrimaryText: {
      fontSize: 16,
      fontWeight: "600",
      color: onPrimary,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    errorText: {
      color: C.themeRed,
      fontSize: 16,
    },
  });
}

export default function EditCaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session, effectiveOwnerId } = useAuth();
  const accessGuard = useAccessGuard("edit_cases");
  const isOnline = useIsOnline();
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = isDark ? C.black : C.pureWhite;
  const styles = useMemo(
    () => createEditCaseStyles(C, onPrimary),
    [C, onPrimary],
  );
  const [caseData, setCaseData] = useState<CaseRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AddCaseFormState>(initialAddCaseFormState);
  const [errors, setErrors] = useState<
    Partial<Record<keyof AddCaseFormState, string>>
  >({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [clientListRefreshKey, setClientListRefreshKey] = useState(0);
  const [showAddJudgeSheet, setShowAddJudgeSheet] = useState(false);
  const partyTerms = useMemo(
    () => getPartyTerminology(form.courtTier, form.caseSubType),
    [form.courtTier, form.caseSubType],
  );

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
        setForm(caseRowToFormState(cached));
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
      setForm(caseRowToFormState(row));
      if (session?.user?.id) {
        await upsertCachedCase(session.user.id, row);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, session?.user?.id, isOnline]);

  const update = useCallback((updates: Partial<AddCaseFormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(updates).forEach(
        (k) => delete next[k as keyof AddCaseFormState],
      );
      return next;
    });
    setSaveError(null);
  }, []);

  const validate = useCallback((): boolean => {
    const e: typeof errors = {};
    if (!form.petitionerName.trim())
      e.petitionerName = "Petitioner name is required";
    if (!form.respondentName.trim())
      e.respondentName = "Respondent name is required";
    if (!form.caseType) e.caseType = "Please select a case type";
    if (form.caseType && !form.caseSubType.trim())
      e.caseSubType = "Please select type of case";
    if (!form.courtTier) e.courtTier = "Please select court tier";
    if (!form.judgeName.trim()) e.judgeName = "Judge name is required";
    if (!form.myClientIs) e.myClientIs = "Please select who your client is";
    if (!form.nextHearingDate.trim())
      e.nextHearingDate = "Next hearing date is required";
    setErrors((prev) => ({ ...prev, ...e }));
    return Object.keys(e).length === 0;
  }, [
    form.petitionerName,
    form.respondentName,
    form.caseType,
    form.caseSubType,
    form.courtTier,
    form.judgeName,
    form.myClientIs,
    form.nextHearingDate,
  ]);

  const onSave = useCallback(async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    if (!id || !session?.user?.id || !effectiveOwnerId || !isSupabaseConfigured) {
      setSaveError("Cannot save. Sign in or check configuration.");
      return;
    }

    const caseTitle = getDerivedCaseTitle(
      form.petitionerName,
      form.respondentName,
    );
    const previousHearingDate = caseData?.next_hearing_date ?? null;

    const row = {
      case_title: caseTitle || null,
      case_number: form.caseNumber.trim() || null,
      case_type: form.caseType || null,
      case_sub_type: form.caseSubType.trim() || null,
      petitioner_name: form.petitionerName.trim() || "",
      respondent_name: form.respondentName.trim() || "",
      court_tier: form.courtTier || null,
      court_name: form.courtName.trim() || null,
      court_room: form.courtRoom.trim() || null,
      judge_name: form.judgeName.trim() || null,
      my_client_is: form.myClientIs || null,
      linked_client_id: form.linkedClientId ?? null,
      linked_client_name: form.linkedClientName.trim() || null,
      date_of_filing: form.dateOfFiling.trim() || null,
      next_hearing_date: form.nextHearingDate.trim() || null,
      current_status: form.caseStatus || null,
      next_status: form.nextStatus || null,
      notes: form.notes.trim() || null,
    };

    setSaving(true);
    setSaveError(null);
    if (!isOnline) {
      const patch = {
        ...row,
        updated_at: new Date().toISOString(),
      };
      await addPendingCaseUpdate(session.user.id, id, patch);
      await patchCachedCase(session.user.id, id, patch);
      setSaving(false);
      router.replace(`/case/${id}`);
      return;
    }
    const { error } = await supabase
      .from("cases")
      .update(row)
      .eq("id", id)
      .eq("user_id", effectiveOwnerId);
    setSaving(false);

    if (error) {
      setSaveError(error.message || "Failed to update case.");
      return;
    }
    const hearingResult = await addCaseHearingEntry({
      caseId: id,
      userId: effectiveOwnerId,
      hearingDate: previousHearingDate ?? row.next_hearing_date,
      currentStatus: row.current_status,
      nextStatus: row.next_status,
      nextHearingDate: row.next_hearing_date,
      proceeding: row.current_status,
      judgeName: row.judge_name,
    });
    if (!hearingResult.ok) {
      setSaveError(hearingResult.message);
      return;
    }
    await patchCachedCase(session.user.id, id, {
      ...row,
      updated_at: new Date().toISOString(),
    });
    router.replace(`/case/${id}`);
  }, [
    id,
    session?.user?.id,
    effectiveOwnerId,
    form,
    validate,
    router,
    isOnline,
    caseData?.next_hearing_date,
  ]);

  if (loading || (!caseData && !error)) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !caseData) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScreenHeader title="Edit case" />
        <View style={styles.centered}>
          <ThemedText style={styles.errorText}>
            {error || "Case not found"}
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (accessGuard.blocked) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader title="Edit case" />
      
      
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        extraScrollHeight={24}
      >
        <Animated.View entering={FadeInUp.duration(400).springify().damping(20)}>
          <ThemedText style={styles.sectionTitle}>Parties & type</ThemedText>
          <FormFieldWithHint
            label="First Party Name"
            required
            value={form.petitionerName}
            onChangeText={(v) => update({ petitionerName: v })}
            placeholder="Enter First and Last Name"
            hint="Add First Party's full name"
            error={errors.petitionerName}
            autoCapitalize="words"
          />
          <FormFieldWithHint
            label="Second Party Name"
            required
            value={form.respondentName}
            onChangeText={(v) => update({ respondentName: v })}
            placeholder="Enter First and Last Name"
            hint="Add Second Party's full name"
            error={errors.respondentName}
            autoCapitalize="words"
          />
          <FormFieldWithHint
            label="Case Number"
            value={form.caseNumber}
            onChangeText={(v) => update({ caseNumber: v })}
            placeholder="12345/2025"
            hint="Enter Case Number"
          />
          <FormField label="Case Type" required>
            <ChipGroup
              options={[...CASE_TYPES]}
              value={form.caseType}
              onChange={(v) =>
                update({ caseType: v as CaseType, caseSubType: "" })
              }
            />
            {errors.caseType ? (
              <ThemedText style={styles.fieldError}>{errors.caseType}</ThemedText>
            ) : null}
          </FormField>
          {form.caseType ? (
            <FormField label="Type of case" required>
              <ChipGroup
                options={getCaseSubTypesForType(form.caseType)}
                value={form.caseSubType}
                onChange={(v) => update({ caseSubType: v })}
              />
              {errors.caseSubType ? (
                <ThemedText style={styles.fieldError}>
                  {errors.caseSubType}
                </ThemedText>
              ) : null}
            </FormField>
          ) : null}

          <ThemedText style={styles.sectionTitle}>Court</ThemedText>
          <CourtTierPicker
            label="Court Tier"
            required
            value={form.courtTier}
            onChange={(tier) =>
              update({
                courtTier: tier,
                courtName: "",
                judgeName: "",
                courtRoom: "",
              })
            }
            hint="Select from saved tiers, or add a new one."
            error={errors.courtTier || null}
          />
          <JudgeNameSelector
            label="Judge Name"
            required
            value={form.judgeName}
            courtTier={form.courtTier}
            onChange={(v) => update({ judgeName: v })}
            onSelectJudge={({ courtRoomAddress }) => {
              update({ courtRoom: courtRoomAddress?.trim() || "" });
            }}
            onPressAddJudge={() => setShowAddJudgeSheet(true)}
            placeholder="Select judge"
            hint="Judges are filtered by selected court tier."
            error={errors.judgeName}
          />
          <FormFieldWithHint
            label="Court room location"
            value={form.courtRoom}
            onChangeText={(v) => update({ courtRoom: v })}
            placeholder="e.g. Building A, 2nd Floor"
            hint="Auto-filled from selected judge when available, and always editable."
          />
          <AddJudgeBottomSheet
            visible={showAddJudgeSheet}
            defaultCourtTier={form.courtTier}
            onClose={() => setShowAddJudgeSheet(false)}
            onSaved={(judge) => {
              update({
                judgeName: judge.name,
                courtTier: judge.courtTier,
                courtRoom: judge.courtRoomAddress?.trim() || "",
              });
              setShowAddJudgeSheet(false);
            }}
          />

          <ThemedText style={styles.sectionTitle}>Client</ThemedText>
          <FormField label="My Client is" required>
            {errors.myClientIs ? (
              <ThemedText style={styles.fieldError}>
                {errors.myClientIs}
              </ThemedText>
            ) : null}
            <RadioOption
              label={partyTerms.firstParty}
              selected={form.myClientIs === "petitioner"}
              onSelect={() => update({ myClientIs: "petitioner" })}
            />
            <RadioOption
              label={partyTerms.secondParty}
              selected={form.myClientIs === "respondent"}
              onSelect={() => update({ myClientIs: "respondent" })}
            />
          </FormField>
          <LinkExistingClientField
            label="Link Existing Client"
            value={form.linkedClientName}
            refreshKey={clientListRefreshKey}
            onChange={(name) =>
              update({
                linkedClientName: name ?? "",
                clientOption: name ? "link" : form.clientOption,
              })
            }
            placeholder="Select from your saved clients"
            hint="Only clients you added in Manage clients are shown here"
          />
          <FormField label="OR Add New Client">
            <Bounceable
              style={styles.addClientBtn}
              onPress={() => {
                update({ clientOption: "new" });
                setShowAddClientModal(true);
              }}
            >
              <Text style={styles.addClientText}>+ Add New Client</Text>
            </Bounceable>
          </FormField>
          <AddNewClientModal
            visible={showAddClientModal}
            initialName={
              form.myClientIs === "petitioner"
                ? form.petitionerName
                : form.myClientIs === "respondent"
                  ? form.respondentName
                  : ""
            }
            onClose={() => setShowAddClientModal(false)}
            onSaved={(clientId) => {
              update({
                linkedClientId: clientId,
                linkedClientName: "",
                clientOption: "new",
              });
              setClientListRefreshKey((k) => k + 1);
              setShowAddClientModal(false);
            }}
          />

          <ThemedText style={styles.sectionTitle}>Dates & status</ThemedText>
          <DateField
            label="Date of Filing"
            value={form.dateOfFiling}
            onChange={(v) => update({ dateOfFiling: v })}
            placeholder="e.g. 08/09/2025"
            hint="Enter date of filing"
          />
          <FormFieldWithHint
            label="Current status"
            value={form.caseStatus}
            onChangeText={(v) => update({ caseStatus: v })}
            placeholder="e.g. Listed, Heard, Adjourned"
            hint="Status of the case"
            multiline
            numberOfLines={4}
            inputStyle={styles.statusInput}
          />
          <DateField
            label="Next Hearing Date"
            required
            value={form.nextHearingDate}
            onChange={(v) => update({ nextHearingDate: v })}
            placeholder="e.g. 08/09/2025"
            hint="Enter next hearing date"
            error={errors.nextHearingDate}
          />
          <FormFieldWithHint
            label="Next status"
            value={form.nextStatus}
            onChangeText={(v) => update({ nextStatus: v })}
            placeholder="e.g. Arguments, Judgment"
            hint="What is coming up next"
            multiline
            numberOfLines={4}
            inputStyle={styles.statusInput}
          />
          <FormFieldWithHint
            label="Notes (Optional)"
            value={form.notes}
            onChangeText={(v) => update({ notes: v })}
            placeholder="Brief description..."
            hint="Additional notes"
            multiline
            numberOfLines={4}
          />

          {saveError ? (
            <ThemedText style={styles.saveError}>{saveError}</ThemedText>
          ) : null}
          <View style={styles.buttons}>
            <Bounceable
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => router.back()}
              disabled={saving}
            >
              <ThemedText style={styles.btnSecondaryText}>Cancel</ThemedText>
            </Bounceable>
            <Bounceable
              style={[styles.btn, styles.btnPrimary]}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={onPrimary} />
              ) : (
                <ThemedText style={styles.btnPrimaryText}>
                  Save changes
                </ThemedText>
              )}
            </Bounceable>
          </View>
        </Animated.View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
