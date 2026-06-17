import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Keyboard,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { CopilotStep, useCopilot, walkthroughable } from "react-native-copilot";
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
import { AddOtherCaseTypeModal } from "@/components/add-case/add-other-case-type-modal";
import { CaseFeeFields } from "@/components/add-case/case-fee-fields";
import { SubordinateFeeVisibilitySwitch } from "@/components/subordinate-fee-visibility-switch";
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
  CASE_TYPE_OTHER,
  getDerivedCaseTitle,
  getPartyTerminology,
  initialAddCaseFormState,
  type AddCaseFormState,
} from "@/constants/case-form";
import type { AppColors } from "@/constants/color-palette";
import { useAppTheme } from "@/context/app-theme-context";
import { useAuth } from "@/context/auth-context";
import { useAccessGuard } from "@/hooks/use-access-guard";
import { useCustomCaseTypes } from "@/hooks/use-custom-case-types";
import { useCustomCaseSubTypes } from "@/hooks/use-custom-case-sub-types";
import { useHomeBackNavigation } from "@/hooks/use-home-back-navigation";
import { useIsOnline } from "@/hooks/use-is-online";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { addCaseHearingEntry } from "@/lib/case-hearings";
import { parseFeeInput } from "@/lib/case-fees";
import { addPendingCase, type PendingCaseRow } from "@/lib/offline-queue";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const STEPS = 3;
const WalkthroughableView = walkthroughable(View);

const STEP_TOUR_STORAGE_KEYS: Record<1 | 2 | 3, string> = {
  1: "hasSeenAddCaseStep1TourCopilot",
  2: "hasSeenAddCaseStep2TourCopilot",
  3: "hasSeenAddCaseStep4TourCopilot",
};

const STEP_TOUR_FIRST_STEP_NAME: Record<1 | 2 | 3, string> = {
  1: "add-case-s1-petitioner",
  2: "add-case-s2-court-tier",
  3: "add-case-s3-filing-date",
};

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
    tourButtonWrap: {
      flex: 1,
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
  const { goBack } = useHomeBackNavigation();
  const isFocused = useIsFocused();
  const { effectiveOwnerId, role } = useAuth();
  const isCaseOwner = role !== "subordinate";
  const accessGuard = useAccessGuard("add_cases");
  const { start, visible: copilotVisible, copilotEvents } = useCopilot();
  const scrollRef = useRef<KeyboardAwareScrollView | null>(null);
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
  const [showOtherCaseTypeModal, setShowOtherCaseTypeModal] = useState(false);
  const [showOtherCaseSubTypeModal, setShowOtherCaseSubTypeModal] = useState(false);
  const [blockScrollForCopilot, setBlockScrollForCopilot] = useState(false);
  const { caseTypeOptions, saveCustomCaseType } = useCustomCaseTypes(form.caseType);
  const { caseSubTypeOptions, saveCustomCaseSubType } = useCustomCaseSubTypes(
    form.caseType,
    form.caseSubType,
  );
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

  const handleCaseTypeChange = useCallback(
    (value: string) => {
      if (value === CASE_TYPE_OTHER) {
        setShowOtherCaseTypeModal(true);
        return;
      }
      update({ caseType: value, caseSubType: "" });
    },
    [update],
  );

  const handleOtherCaseTypeSave = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      const exists = caseTypeOptions.some(
        (opt) =>
          opt !== CASE_TYPE_OTHER &&
          opt.toLowerCase() === trimmed.toLowerCase(),
      );
      if (exists) {
        Alert.alert("Case type exists", "Choose it from the list instead.");
        return;
      }
      const saved = await saveCustomCaseType(trimmed);
      if (saved) {
        update({ caseType: saved, caseSubType: "" });
        setShowOtherCaseTypeModal(false);
      }
    },
    [caseTypeOptions, saveCustomCaseType, update],
  );

  const handleCaseSubTypeChange = useCallback(
    (value: string) => {
      if (value === CASE_TYPE_OTHER) {
        setShowOtherCaseSubTypeModal(true);
        return;
      }
      update({ caseSubType: value });
    },
    [update],
  );

  const handleOtherCaseSubTypeSave = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      const exists = caseSubTypeOptions.some(
        (opt) =>
          opt !== CASE_TYPE_OTHER &&
          opt.toLowerCase() === trimmed.toLowerCase(),
      );
      if (exists) {
        Alert.alert("Type exists", "Choose it from the list instead.");
        return;
      }
      const saved = await saveCustomCaseSubType(trimmed);
      if (saved) {
        update({ caseSubType: saved });
        setShowOtherCaseSubTypeModal(false);
      }
    },
    [caseSubTypeOptions, saveCustomCaseSubType, update],
  );

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
      if (!selectedName || !effectiveOwnerId || !isSupabaseConfigured || !isOnline) return;

      const { data, error } = await supabase
        .from("clients")
        .select("id,name")
        .eq("user_id", effectiveOwnerId)
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
    [update, getClientNameForRole, effectiveOwnerId, isOnline],
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
    if (!form.myClientIs) e.myClientIs = "Please select who your client is";
    setErrors((prev) => ({ ...prev, ...e }));
    return Object.keys(e).length === 0;
  }, [form.courtTier, form.judgeName, form.myClientIs]);

  const validateStep3 = useCallback((): boolean => {
    const e: typeof errors = {};
    if (!form.nextHearingDate.trim())
      e.nextHearingDate = "Next hearing date is required";
    const total = parseFeeInput(form.totalFee);
    const received = parseFeeInput(form.feeReceived);
    if (form.totalFee.trim() && total === null)
      e.totalFee = "Enter a valid amount";
    if (form.feeReceived.trim() && received === null)
      e.feeReceived = "Enter a valid amount";
    if (total != null && received != null && received > total)
      e.feeReceived = "Received cannot exceed total fee";
    setErrors((prev) => ({ ...prev, ...e }));
    return Object.keys(e).length === 0;
  }, [form.nextHearingDate, form.totalFee, form.feeReceived]);

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
    if (step < STEPS) animateToStep(step + 1, 1);
  }, [animateToStep, isStepAnimating, step, validateStep1, validateStep2]);

  const onBack = useCallback(() => {
    if (isStepAnimating) return;
    if (step > 1) {
      animateToStep(step - 1, -1);
    } else {
      goBack();
    }
  }, [animateToStep, isStepAnimating, step, goBack]);

  const onSave = useCallback(async () => {
    if (!validateStep3()) return;
    setSaveError(null);

    const userId = effectiveOwnerId;
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
    const totalFee = parseFeeInput(form.totalFee);
    const feeReceived = parseFeeInput(form.feeReceived);

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
      notes: null,
      total_fee: totalFee,
      fee_received: feeReceived,
      subordinates_can_view_fees: form.subordinatesCanViewFees,
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
      goBack();
    } else {
      await addPendingCase(row);
      setSaving(false);
      setSaveError(null);
      Alert.alert(
        "Saved offline",
        "Your case was saved locally. It will sync to the cloud when you're back online.",
        [{ text: "OK", onPress: () => goBack() }]
      );
    }
  }, [form, effectiveOwnerId, validateStep3, goBack, isOnline]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let copilotStartTimeout: ReturnType<typeof setTimeout> | null = null;
      let raf1 = 0;
      let raf2 = 0;
      let interactionTask: { cancel?: () => void } | null = null;
      const currentStep = step as 1 | 2 | 3;

      setBlockScrollForCopilot(true);

      (async () => {
        const hasSeenTour = await AsyncStorage.getItem(
          STEP_TOUR_STORAGE_KEYS[currentStep],
        );
        if (cancelled) return;
        if (hasSeenTour) {
          setBlockScrollForCopilot(false);
          return;
        }

        copilotStartTimeout = setTimeout(() => {
          if (cancelled) return;
          interactionTask = InteractionManager.runAfterInteractions(() => {
            if (cancelled) return;
            raf1 = requestAnimationFrame(() => {
              if (cancelled) return;
              raf2 = requestAnimationFrame(() => {
                if (cancelled) return;
                void start(
                  STEP_TOUR_FIRST_STEP_NAME[currentStep] as any,
                  scrollRef.current as any,
                );
                void AsyncStorage.setItem(
                  STEP_TOUR_STORAGE_KEYS[currentStep],
                  "true",
                );
              });
            });
          });
        }, 500);
      })();

      return () => {
        cancelled = true;
        if (copilotStartTimeout) clearTimeout(copilotStartTimeout);
        interactionTask?.cancel?.();
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }, [step, start]),
  );

  useEffect(() => {
    if (!isFocused) {
      setBlockScrollForCopilot(false);
    }
  }, [isFocused]);

  useEffect(() => {
    const onStart = () => setBlockScrollForCopilot(false);
    const onStop = () => setBlockScrollForCopilot(false);
    copilotEvents.on("start", onStart);
    copilotEvents.on("stop", onStop);
    return () => {
      copilotEvents.off("start", onStart);
      copilotEvents.off("stop", onStop);
    };
  }, [copilotEvents]);

  const scrollLockedForWalkthrough =
    isFocused && (blockScrollForCopilot || copilotVisible);

  if (accessGuard.blocked) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader title="Add New Case" onBack={onBack} />
      <StepIndicator currentStep={step} />
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={!scrollLockedForWalkthrough}
        enableOnAndroid
        extraScrollHeight={24}
        enableAutomaticScroll={true}
        keyboardOpeningTime={0}
        innerRef={(r) => {
          scrollRef.current = r;
        }}
      >
        <Animated.View style={stepAnimatedStyle}>
          {/* Step 1 of 3 */}
          {step === 1 && (
            <View>
            <CopilotStep
              text="Enter the first party full name."
              order={1}
              name="add-case-s1-petitioner"
              active={isFocused && step === 1}
            >
              <WalkthroughableView collapsable={false}>
                <FormFieldWithHint
                  label="First Party Name"
                  required
                  value={form.petitionerName}
                  onChangeText={(v) => update({ petitionerName: v })}
                  placeholder="Enter First and Last Name"
                  error={errors.petitionerName}
                  autoCapitalize="words"
                />
              </WalkthroughableView>
            </CopilotStep>
            <CopilotStep
              text="Enter the second party full name."
              order={2}
              name="add-case-s1-respondent"
              active={isFocused && step === 1}
            >
              <WalkthroughableView collapsable={false}>
                <FormFieldWithHint
                  label="Second Party Name"
                  required
                  value={form.respondentName}
                  onChangeText={(v) => update({ respondentName: v })}
                  placeholder="Enter First and Last Name"
                  error={errors.respondentName}
                  autoCapitalize="words"
                />
              </WalkthroughableView>
            </CopilotStep>
            <CopilotStep
              text="Add a case number if available."
              order={3}
              name="add-case-s1-case-number"
              active={isFocused && step === 1}
            >
              <WalkthroughableView collapsable={false}>
                <FormFieldWithHint
                  label="Case Number"
                  value={form.caseNumber}
                  onChangeText={(v) => update({ caseNumber: v })}
                  placeholder="12345/2025"
                  keyboardType="number-pad"
                />
              </WalkthroughableView>
            </CopilotStep>
            <CopilotStep
              text="Select the case category."
              order={4}
              name="add-case-s1-case-type"
              active={isFocused && step === 1}
            >
              <WalkthroughableView collapsable={false}>
                <FormField label="Case Type" required>
                  <ChipGroup
                    options={caseTypeOptions}
                    value={form.caseType}
                    onChange={handleCaseTypeChange}
                  />
                  {errors.caseType ? (
                    <ThemedText style={styles.fieldError}>
                      {errors.caseType}
                    </ThemedText>
                  ) : null}
                </FormField>
              </WalkthroughableView>
            </CopilotStep>
            <AddOtherCaseTypeModal
              visible={showOtherCaseTypeModal}
              onClose={() => setShowOtherCaseTypeModal(false)}
              onSave={(name) => void handleOtherCaseTypeSave(name)}
            />
            <AddOtherCaseTypeModal
              visible={showOtherCaseSubTypeModal}
              onClose={() => setShowOtherCaseSubTypeModal(false)}
              onSave={(name) => void handleOtherCaseSubTypeSave(name)}
              title="Add type of case"
              fieldLabel="Type of case"
              placeholder="Enter type of case"
              emptyError="Please enter a type of case."
            />
            {form.caseType ? (
              <CopilotStep
                text="Choose the specific type of case."
                order={5}
                name="add-case-s1-case-subtype"
                active={isFocused && step === 1}
              >
                <WalkthroughableView style={styles.tourButtonWrap} collapsable={false}>
                  <FormField label="Type of case" required>
                    <ChipGroup
                      options={caseSubTypeOptions}
                      value={form.caseSubType}
                      onChange={handleCaseSubTypeChange}
                    />
                    {errors.caseSubType ? (
                      <ThemedText style={styles.fieldError}>
                        {errors.caseSubType}
                      </ThemedText>
                    ) : null}
                  </FormField>
                </WalkthroughableView>
              </CopilotStep>
            ) : null}
            <CopilotStep
              text="Tap Next to continue to court details."
              order={6}
              name="add-case-s1-next"
              active={isFocused && step === 1}
            >
              <WalkthroughableView collapsable={false}>
                <Bounceable style={styles.nextButton} onPress={onNext} disabled={isStepAnimating}>
                  <ThemedText style={styles.nextButtonText}>Next →</ThemedText>
                </Bounceable>
              </WalkthroughableView>
            </CopilotStep>
            </View>
          )}

          {/* Step 2 of 3 */}
          {step === 2 && (
            <View>
            <CopilotStep
              text="Select the court tier for this case."
              order={1}
              name="add-case-s2-court-tier"
              active={isFocused && step === 2}
            >
              <WalkthroughableView collapsable={false}>
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
                  error={errors.courtTier || null}
                />
              </WalkthroughableView>
            </CopilotStep>
            <CopilotStep
              text="Choose a judge for the selected court tier."
              order={2}
              name="add-case-s2-judge-name"
              active={isFocused && step === 2}
            >
              <WalkthroughableView collapsable={false}>
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
                  error={errors.judgeName}
                />
              </WalkthroughableView>
            </CopilotStep>
            <CopilotStep
              text="Confirm or edit the court room location."
              order={3}
              name="add-case-s2-court-room"
              active={isFocused && step === 2}
            >
              <WalkthroughableView collapsable={false}>
                <FormFieldWithHint
                  label="Court room location"
                  value={form.courtRoom}
                  onChangeText={(v) => update({ courtRoom: v })}
                  placeholder="e.g. Building A, 2nd Floor"
                />
              </WalkthroughableView>
            </CopilotStep>
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
            <CopilotStep
              text="Choose whether your client is the first or second party."
              order={4}
              name="add-case-s2-my-client-is"
              active={isFocused && step === 2}
            >
              <WalkthroughableView collapsable={false}>
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
              </WalkthroughableView>
            </CopilotStep>
            <CopilotStep
              text="Link this case to an existing saved client."
              order={5}
              name="add-case-s2-link-existing-client"
              active={isFocused && step === 2}
            >
              <WalkthroughableView collapsable={false}>
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
                />
              </WalkthroughableView>
            </CopilotStep>
            <CopilotStep
              text="Or add a brand-new client from here."
              order={6}
              name="add-case-s2-add-new-client"
              active={isFocused && step === 2}
            >
              <WalkthroughableView collapsable={false}>
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
              </WalkthroughableView>
            </CopilotStep>
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
              <CopilotStep
                text="Go back to the previous step."
                order={7}
                name="add-case-s2-back"
                active={isFocused && step === 2}
              >
                <WalkthroughableView style={styles.tourButtonWrap} collapsable={false}>
                  <Bounceable
                    style={[styles.btn, styles.btnSecondary]}
                    onPress={onBack}
                    disabled={isStepAnimating}
                  >
                    <ThemedText style={styles.btnSecondaryText}>← Back</ThemedText>
                  </Bounceable>
                </WalkthroughableView>
              </CopilotStep>
              <CopilotStep
                text="Tap Next to add filing and hearing details."
                order={8}
                name="add-case-s2-next"
                active={isFocused && step === 2}
              >
                <WalkthroughableView style={styles.tourButtonWrap} collapsable={false}>
                  <Bounceable
                    style={[styles.btn, styles.btnPrimary]}
                    onPress={onNext}
                    disabled={isStepAnimating}
                  >
                    <ThemedText style={styles.btnPrimaryText}>Next →</ThemedText>
                  </Bounceable>
                </WalkthroughableView>
              </CopilotStep>
            </View>
            </View>
          )}

          {/* Step 3 of 3 */}
          {step === 3 && (
            <View>
            <CopilotStep
              text="Set the date when the case was filed."
              order={1}
              name="add-case-s3-filing-date"
              active={isFocused && step === 3}
            >
              <WalkthroughableView collapsable={false}>
                <DateField
                  label="Date of Filing"
                  value={form.dateOfFiling}
                  onChange={(v) => update({ dateOfFiling: v })}
                  placeholder="e.g. 08/09/2025"
                />
              </WalkthroughableView>
            </CopilotStep>
            <CopilotStep
              text="Add the current status of the case."
              order={2}
              name="add-case-s3-current-status"
              active={isFocused && step === 3}
            >
              <WalkthroughableView collapsable={false}>
                <FormFieldWithHint
                  label="Current status"
                  value={form.caseStatus}
                  onChangeText={(v) => update({ caseStatus: v })}
                  placeholder="e.g. Listed, Heard, Adjourned"
                  multiline
                  numberOfLines={4}
                  inputStyle={styles.statusInput}
                />
              </WalkthroughableView>
            </CopilotStep>
            <CopilotStep
              text="This next hearing date is required before saving."
              order={3}
              name="add-case-s3-next-hearing-date"
              active={isFocused && step === 3}
            >
              <WalkthroughableView collapsable={false}>
                <DateField
                  label="Next Hearing Date"
                  required
                  value={form.nextHearingDate}
                  onChange={(v) => update({ nextHearingDate: v })}
                  placeholder="e.g. 08/09/2025"
                  error={errors.nextHearingDate}
                />
              </WalkthroughableView>
            </CopilotStep>
            <CopilotStep
              text="Add what is expected in the next status."
              order={4}
              name="add-case-s3-next-status"
              active={isFocused && step === 3}
            >
              <WalkthroughableView collapsable={false}>
                <FormFieldWithHint
                  label="Next status"
                  value={form.nextStatus}
                  onChangeText={(v) => update({ nextStatus: v })}
                  placeholder="e.g. Arguments, Judgment, Next hearing"
                  multiline
                  numberOfLines={4}
                  inputStyle={styles.statusInput}
                />
              </WalkthroughableView>
            </CopilotStep>
            <CopilotStep
              text="Record the agreed case fee and any amount already received."
              order={5}
              name="add-case-s3-fees"
              active={isFocused && step === 3}
            >
              <WalkthroughableView collapsable={false}>
                <CaseFeeFields
                  totalFee={form.totalFee}
                  feeReceived={form.feeReceived}
                  onTotalFeeChange={(v) => update({ totalFee: v })}
                  onFeeReceivedChange={(v) => update({ feeReceived: v })}
                  totalFeeError={errors.totalFee}
                  feeReceivedError={errors.feeReceived}
                />
                {isCaseOwner ? (
                  <SubordinateFeeVisibilitySwitch
                    value={form.subordinatesCanViewFees}
                    onValueChange={(subordinatesCanViewFees) =>
                      update({ subordinatesCanViewFees })
                    }
                    disabled={saving}
                  />
                ) : null}
              </WalkthroughableView>
            </CopilotStep>
            {saveError ? (
              <ThemedText style={styles.saveError}>{saveError}</ThemedText>
            ) : null}
            <View style={styles.buttons}>
              <CopilotStep
                text="Go back to the previous step."
                order={6}
                name="add-case-s3-back"
                active={isFocused && step === 3}
              >
                <WalkthroughableView style={styles.tourButtonWrap} collapsable={false}>
                  <Bounceable
                    style={[styles.btn, styles.btnSecondary]}
                    onPress={onBack}
                    disabled={saving || isStepAnimating}
                  >
                    <ThemedText style={styles.btnSecondaryText}>← Back</ThemedText>
                  </Bounceable>
                </WalkthroughableView>
              </CopilotStep>
              <CopilotStep
                text="Tap Save to create this case."
                order={7}
                name="add-case-s3-save"
                active={isFocused && step === 3}
              >
                <WalkthroughableView style={styles.tourButtonWrap} collapsable={false}>
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
                </WalkthroughableView>
              </CopilotStep>
            </View>
            </View>
          )}
        </Animated.View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
