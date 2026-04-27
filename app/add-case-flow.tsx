import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
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
import { StepIndicator } from "@/components/add-case/step-indicator";
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
import { useIsOnline } from "@/hooks/use-is-online";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { addCaseHearingEntry } from "@/lib/case-hearings";
import { addPendingCase, type PendingCaseRow } from "@/lib/offline-queue";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const STEPS = 4;

function createAddCaseFlowStyles(C: AppColors, onPrimary: string) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    nextButton: {
      backgroundColor: C.themeBlack,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 8,
      marginBottom: 24,
    },
    nextButtonText: {
      color: onPrimary,
      fontSize: 16,
      fontWeight: "600",
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
    manageRefBtn: {
      marginTop: 8,
      marginBottom: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.borderGray,
      backgroundColor: C.pureWhite,
      paddingVertical: 11,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    manageRefBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: C.black,
    },
    clientOptionRow: {
      borderRadius: 10,
      borderWidth: 2,
      borderColor: "transparent",
    },
    clientOptionRowSelected: {
      borderColor: C.themeBlack,
    },
    statusRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    statusInput: {
      minHeight: 100,
    },
    saveError: {
      color: C.themeRed,
      fontSize: 14,
      marginBottom: 12,
    },
    fieldError: {
      color: C.themeRed,
      fontSize: 14,
      marginTop: 4,
      marginBottom: 4,
    },
    buttons: {
      flexDirection: "row",
      gap: 12,
      marginTop: 24,
      marginBottom: 24,
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
  });
}

export default function AddCaseFlowScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const isOnline = useIsOnline();
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = isDark ? C.black : C.pureWhite;
  const styles = useMemo(
    () => createAddCaseFlowStyles(C, onPrimary),
    [C, onPrimary],
  );
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<AddCaseFormState>(initialAddCaseFormState);
  const [errors, setErrors] = useState<
    Partial<Record<keyof AddCaseFormState, string>>
  >({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isStepAnimating, setIsStepAnimating] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [pendingSuggestedClientName, setPendingSuggestedClientName] = useState("");
  const [clientListRefreshKey, setClientListRefreshKey] = useState(0);
  const [showAddJudgeSheet, setShowAddJudgeSheet] = useState(false);
  const stepTranslateX = useSharedValue(0);
  const stepOpacity = useSharedValue(1);
  const partyTerms = useMemo(
    () => getPartyTerminology(form.courtTier, form.caseSubType),
    [form.courtTier, form.caseSubType],
  );

  const update = useCallback((updates: Partial<AddCaseFormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(updates).forEach(
        (k) => delete next[k as keyof AddCaseFormState],
      );
      return next;
    });
  }, []);

  const getClientNameForRole = useCallback(
    (role: "petitioner" | "respondent"): string => {
      return role === "petitioner"
        ? form.petitionerName.trim()
        : form.respondentName.trim();
    },
    [form.petitionerName, form.respondentName],
  );

  const handleMyClientSelection = useCallback(
    async (role: "petitioner" | "respondent") => {
      update({ myClientIs: role });
      const selectedName = getClientNameForRole(role);
      if (!selectedName || !session?.user?.id || !isSupabaseConfigured || !isOnline) return;

      const { data, error } = await supabase
        .from("clients")
        .select("id,name")
        .eq("user_id", session.user.id)
        .ilike("name", selectedName)
        .limit(1);
      if (error) return;

      const matched = (data?.[0] as { id: string; name: string } | undefined) ?? null;
      if (matched) {
        update({
          linkedClientId: matched.id,
          linkedClientName: matched.name,
          clientOption: "link",
        });
        return;
      }

      Alert.alert(
        "Client not saved",
        `"${selectedName}" is not in your saved clients. Add now?`,
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Add client",
            onPress: () => {
              setPendingSuggestedClientName(selectedName);
              update({ clientOption: "new" });
              setShowAddClientModal(true);
            },
          },
        ],
      );
    },
    [update, getClientNameForRole, session?.user?.id, isOnline],
  );

  const validateStep1 = useCallback((): boolean => {
    const e: typeof errors = {};
    if (!form.petitionerName.trim())
      e.petitionerName = "Petitioner name is required";
    if (!form.respondentName.trim())
      e.respondentName = "Respondent name is required";
    if (!form.caseType) e.caseType = "Please select a case type";
    if (form.caseType && !form.caseSubType.trim())
      e.caseSubType = "Please select type of case";
    setErrors((prev) => ({ ...prev, ...e }));
    return Object.keys(e).length === 0;
  }, [
    form.petitionerName,
    form.respondentName,
    form.caseType,
    form.caseSubType,
  ]);

  const validateStep2 = useCallback((): boolean => {
    const e: typeof errors = {};
    if (!form.courtTier) e.courtTier = "Please select court tier";
    if (!form.judgeName.trim()) e.judgeName = "Judge name is required";
    setErrors((prev) => ({ ...prev, ...e }));
    return Object.keys(e).length === 0;
  }, [form.courtTier, form.judgeName]);

  const validateStep3 = useCallback((): boolean => {
    const e: typeof errors = {};
    if (!form.myClientIs) e.myClientIs = "Please select who your client is";
    setErrors((prev) => ({ ...prev, ...e }));
    return Object.keys(e).length === 0;
  }, [form.myClientIs]);

  const validateStep4 = useCallback((): boolean => {
    const e: typeof errors = {};
    if (!form.nextHearingDate.trim())
      e.nextHearingDate = "Next hearing date is required";
    setErrors((prev) => ({ ...prev, ...e }));
    return Object.keys(e).length === 0;
  }, [form.nextHearingDate]);

  const stepAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: stepTranslateX.value }],
    opacity: stepOpacity.value,
  }));

  const animateToStep = useCallback(
    (nextStep: number, direction: 1 | -1) => {
      if (isStepAnimating || nextStep === step) return;
      setIsStepAnimating(true);

      const outOffset = direction === 1 ? -36 : 36;
      const inOffset = direction === 1 ? 36 : -36;

      stepTranslateX.value = withTiming(
        outOffset,
        {
          duration: 150,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (!finished) {
            runOnJS(setIsStepAnimating)(false);
            return;
          }

          runOnJS(setStep)(nextStep);
          stepTranslateX.value = inOffset;
          stepOpacity.value = 0;

          stepTranslateX.value = withTiming(0, {
            duration: 280,
            easing: Easing.out(Easing.exp),
          });
          stepOpacity.value = withTiming(1, { duration: 220 }, (done) => {
            if (done) runOnJS(setIsStepAnimating)(false);
          });
        },
      );

      stepOpacity.value = withTiming(0, {
        duration: 120,
        easing: Easing.out(Easing.quad),
      });
    },
    [isStepAnimating, step, stepOpacity, stepTranslateX],
  );

  const onNext = useCallback(() => {
    if (isStepAnimating) return;
    Keyboard.dismiss();
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    if (step < STEPS) animateToStep(step + 1, 1);
  }, [animateToStep, isStepAnimating, step, validateStep1, validateStep2, validateStep3]);

  const onBack = useCallback(() => {
    if (isStepAnimating) return;
    if (step > 1) {
      animateToStep(step - 1, -1);
    } else {
      router.back();
    }
  }, [animateToStep, isStepAnimating, step, router]);

  const onSave = useCallback(async () => {
    if (!validateStep4()) return;
    setSaveError(null);

    const userId = session?.user?.id;
    if (!userId) {
      setSaveError("You must be signed in to save a case.");
      return;
    }
    if (!isSupabaseConfigured) {
      setSaveError("Supabase is not configured. Cannot save case.");
      return;
    }

    const caseTitle = getDerivedCaseTitle(
      form.petitionerName,
      form.respondentName,
    );
    const row: PendingCaseRow = {
      user_id: userId,
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

    if (isOnline) {
      const { data, error } = await supabase
        .from("cases")
        .insert(row)
        .select()
        .single();
      setSaving(false);

      if (error) {
        setSaveError(error.message || "Failed to save case.");
        return;
      }

      const savedCase = data as { id: string } | null;
      if (savedCase?.id) {
        const hearingResult = await addCaseHearingEntry({
          caseId: savedCase.id,
          userId,
          hearingDate: row.next_hearing_date,
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
      }
      router.back();
    } else {
      await addPendingCase(row);
      setSaving(false);
      setSaveError(null);
      Alert.alert(
        "Saved offline",
        "Your case was saved locally. It will sync to the cloud when you're back online.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    }
  }, [form, session?.user?.id, validateStep4, router, isOnline]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader title="Add New Case" onBack={onBack} />
      <StepIndicator currentStep={step} />
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={24}
        enableAutomaticScroll={true}
        keyboardOpeningTime={0}
      >
        <Animated.View style={stepAnimatedStyle}>
          {/* Step 1 of 4 */}
          {step === 1 && (
            <View>
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
                <ThemedText style={styles.fieldError}>
                  {errors.caseType}
                </ThemedText>
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
            <Bounceable style={styles.nextButton} onPress={onNext} disabled={isStepAnimating}>
              <ThemedText style={styles.nextButtonText}>Next →</ThemedText>
            </Bounceable>
            </View>
          )}

          {/* Step 2 of 4 */}
          {step === 2 && (
            <View>
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
            <Bounceable
              style={styles.manageRefBtn}
              onPress={() => router.push("/judges")}
            >
              <ThemedText style={styles.manageRefBtnText}>Manage judges list</ThemedText>
            </Bounceable>
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
            <View style={styles.buttons}>
              <Bounceable
                style={[styles.btn, styles.btnSecondary]}
                onPress={onBack}
                disabled={isStepAnimating}
              >
                <ThemedText style={styles.btnSecondaryText}>← Back</ThemedText>
              </Bounceable>
              <Bounceable
                style={[styles.btn, styles.btnPrimary]}
                onPress={onNext}
                disabled={isStepAnimating}
              >
                <ThemedText style={styles.btnPrimaryText}>Next →</ThemedText>
              </Bounceable>
            </View>
            </View>
          )}

          {/* Step 3 of 4 */}
          {step === 3 && (
            <View>
            <FormField label="My Client is" required>
              {errors.myClientIs ? (
                <ThemedText style={styles.fieldError}>
                  {errors.myClientIs}
                </ThemedText>
              ) : null}
              <RadioOption
                label={partyTerms.firstParty}
                selected={form.myClientIs === "petitioner"}
                onSelect={() => void handleMyClientSelection("petitioner")}
              />
              <RadioOption
                label={partyTerms.secondParty}
                selected={form.myClientIs === "respondent"}
                onSelect={() => void handleMyClientSelection("respondent")}
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
            <Bounceable
              style={styles.manageRefBtn}
              onPress={() => router.push("/clients")}
            >
              <ThemedText style={styles.manageRefBtnText}>Manage clients list</ThemedText>
            </Bounceable>
            <FormField label="OR Add New Client">
              <Bounceable
                style={styles.addClientBtn}
                onPress={() => {
                  setPendingSuggestedClientName("");
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
                pendingSuggestedClientName ||
                (form.myClientIs === "petitioner"
                  ? form.petitionerName
                  : form.myClientIs === "respondent"
                    ? form.respondentName
                    : "")
              }
              onClose={() => {
                setPendingSuggestedClientName("");
                setShowAddClientModal(false);
              }}
              onSaved={(clientId) => {
                update({
                  linkedClientId: clientId,
                  linkedClientName: pendingSuggestedClientName,
                  clientOption: "new",
                });
                setClientListRefreshKey((k) => k + 1);
                setPendingSuggestedClientName("");
                setShowAddClientModal(false);
              }}
            />
            <View style={styles.buttons}>
              <Bounceable
                style={[styles.btn, styles.btnSecondary]}
                onPress={onBack}
                disabled={isStepAnimating}
              >
                <ThemedText style={styles.btnSecondaryText}>← Back</ThemedText>
              </Bounceable>
              <Bounceable
                style={[styles.btn, styles.btnPrimary]}
                onPress={onNext}
                disabled={isStepAnimating}
              >
                <ThemedText style={styles.btnPrimaryText}>Next →</ThemedText>
              </Bounceable>
            </View>
            </View>
          )}

          {/* Step 4 of 4 */}
          {step === 4 && (
            <View>
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
              hint="Status of the case as of today or from the last hearing"
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
              placeholder="e.g. Arguments, Judgment, Next hearing"
              hint="What is coming up next in this case"
              multiline
              numberOfLines={4}
              inputStyle={styles.statusInput}
            />
            <FormFieldWithHint
              label="Notes (Optional)"
              value={form.notes}
              onChangeText={(v) => update({ notes: v })}
              placeholder="Brief description..."
              hint="Add any additional notes"
              multiline
              numberOfLines={4}
            />
            {saveError ? (
              <ThemedText style={styles.saveError}>{saveError}</ThemedText>
            ) : null}
            <View style={styles.buttons}>
              <Bounceable
                style={[styles.btn, styles.btnSecondary]}
                onPress={onBack}
                disabled={saving || isStepAnimating}
              >
                <ThemedText style={styles.btnSecondaryText}>← Back</ThemedText>
              </Bounceable>
              <Bounceable
                style={[styles.btn, styles.btnPrimary]}
                onPress={onSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={onPrimary} />
                ) : (
                  <ThemedText style={styles.btnPrimaryText}>Save</ThemedText>
                )}
              </Bounceable>
            </View>
            </View>
          )}
        </Animated.View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
