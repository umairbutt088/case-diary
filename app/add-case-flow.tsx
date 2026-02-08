import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ChipGroup } from "@/components/add-case/chip-group";
import { FormField } from "@/components/add-case/form-field";
import { FormFieldWithHint } from "@/components/add-case/form-field-with-hint";
import { RadioOption } from "@/components/add-case/radio-option";
import { SelectField } from "@/components/add-case/select-field";
import { StepIndicator } from "@/components/add-case/step-indicator";
import { ThemedText } from "@/components/themed-text";
import {
  CASE_STATUSES,
  CASE_TYPES,
  COURT_TIERS,
  getCourtNamesForTier,
  getDerivedCaseTitle,
  initialAddCaseFormState,
  type AddCaseFormState,
  type CaseStatus,
  type CaseType,
  type CourtTier,
} from "@/constants/case-form";
import { theme } from "@/constants/theme";

const STEPS = 4;

export default function AddCaseFlowScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<AddCaseFormState>(initialAddCaseFormState);
  const [errors, setErrors] = useState<
    Partial<Record<keyof AddCaseFormState, string>>
  >({});

  const update = useCallback((updates: Partial<AddCaseFormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(updates).forEach(
        (k) => delete next[k as keyof AddCaseFormState]
      );
      return next;
    });
  }, []);

  const courtOptions = useMemo(
    () => getCourtNamesForTier(form.courtTier),
    [form.courtTier]
  );

  const validateStep1 = useCallback((): boolean => {
    const e: typeof errors = {};
    if (!form.petitionerName.trim())
      e.petitionerName = "Petitioner name is required";
    if (!form.respondentName.trim())
      e.respondentName = "Respondent name is required";
    if (!form.caseType) e.caseType = "Please select a case type";
    setErrors((prev) => ({ ...prev, ...e }));
    return Object.keys(e).length === 0;
  }, [form.petitionerName, form.respondentName, form.caseType]);

  const validateStep2 = useCallback((): boolean => {
    const e: typeof errors = {};
    if (!form.courtTier) e.courtTier = "Please select court tier";
    if (!form.courtName.trim()) e.courtName = "Court name is required";
    setErrors((prev) => ({ ...prev, ...e }));
    return Object.keys(e).length === 0;
  }, [form.courtTier, form.courtName]);

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

  const onNext = useCallback(() => {
    Keyboard.dismiss();
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    if (step < STEPS) setStep((s) => s + 1);
  }, [step, validateStep1, validateStep2, validateStep3]);

  const onBack = useCallback(() => {
    if (step > 1) setStep((s) => s - 1);
    else router.back();
  }, [step, router]);

  const onSave = useCallback(() => {
    if (!validateStep4()) return;
    const caseTitle = getDerivedCaseTitle(
      form.petitionerName,
      form.respondentName
    );
    console.log("Add case payload:", { ...form, caseTitle });
    router.back();
  }, [form, validateStep4, router]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <StepIndicator currentStep={step} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Step 1 of 4: Petitioner, Respondent (case title derived), Case Number, Case Type */}
          {step === 1 && (
            <>
              <FormFieldWithHint
                label="Petitioner Name"
                required
                value={form.petitionerName}
                onChangeText={(v) => update({ petitionerName: v })}
                placeholder="Enter First and Last Name"
                hint="Add Petitioner's / Plaintiff's full name"
                error={errors.petitionerName}
              />
              <FormFieldWithHint
                label="Respondent Name"
                required
                value={form.respondentName}
                onChangeText={(v) => update({ respondentName: v })}
                placeholder="Enter First and Last Name"
                hint="Add Respondent's / Defendant's full name"
                error={errors.respondentName}
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
                  onChange={(v) => update({ caseType: v as CaseType })}
                />
                {errors.caseType ? (
                  <ThemedText style={styles.fieldError}>
                    {errors.caseType}
                  </ThemedText>
                ) : null}
              </FormField>
              <Pressable style={styles.nextButton} onPress={onNext}>
                <ThemedText style={styles.nextButtonText}>Next →</ThemedText>
              </Pressable>
            </>
          )}

          {/* Step 2 of 4 */}
          {step === 2 && (
            <>
              <FormField label="Court Tier" required>
                {errors.courtTier ? (
                  <ThemedText style={styles.fieldError}>
                    {errors.courtTier}
                  </ThemedText>
                ) : null}
                {COURT_TIERS.map(({ value, label }) => (
                  <RadioOption
                    key={value}
                    label={label}
                    selected={form.courtTier === value}
                    onSelect={() =>
                      update({ courtTier: value as CourtTier, courtName: "" })
                    }
                  />
                ))}
              </FormField>
              <SelectField
                label="Court Name"
                required
                value={form.courtName}
                options={courtOptions}
                onChange={(v) => update({ courtName: v })}
                placeholder={
                  form.courtTier
                    ? "Lahore High Court ▾"
                    : "Select court tier first"
                }
                disabled={!form.courtTier || courtOptions.length === 0}
                hint="Select the court where the case is filed"
                error={errors.courtName}
              />
              <FormFieldWithHint
                label="Court Room/Board #"
                value={form.courtRoom}
                onChangeText={(v) => update({ courtRoom: v })}
                placeholder="Courtroom 5"
                hint="Enter court room or board number"
              />
              <FormFieldWithHint
                label="Judge Name"
                value={form.judgeName}
                onChangeText={(v) => update({ judgeName: v })}
                placeholder="Justice A. Rahman"
                hint="Enter presiding judge name"
              />
              <View style={styles.buttons}>
                <Pressable
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={onBack}
                >
                  <ThemedText style={styles.btnSecondaryText}>
                    ← Back
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={onNext}
                >
                  <ThemedText style={styles.btnPrimaryText}>Next →</ThemedText>
                </Pressable>
              </View>
            </>
          )}

          {/* Step 3 of 4: My Client, Link/Create Client */}
          {step === 3 && (
            <>
              <FormField label="My Client is" required>
                {errors.myClientIs ? (
                  <ThemedText style={styles.fieldError}>
                    {errors.myClientIs}
                  </ThemedText>
                ) : null}
                <RadioOption
                  label="Petitioner"
                  selected={form.myClientIs === "petitioner"}
                  onSelect={() => update({ myClientIs: "petitioner" })}
                />
                <RadioOption
                  label="Respondent"
                  selected={form.myClientIs === "respondent"}
                  onSelect={() => update({ myClientIs: "respondent" })}
                />
              </FormField>
              <FormField label="Link Existing Client">
                <View
                  style={[
                    styles.clientOptionRow,
                    form.clientOption === "link" &&
                      styles.clientOptionRowSelected,
                  ]}
                >
                  <FormFieldWithHint
                    label=""
                    value={form.linkedClientSearch}
                    onChangeText={(v) =>
                      update({ linkedClientSearch: v, clientOption: "link" })
                    }
                    placeholder="Search client... 🔍"
                    hint="Search and link an existing client"
                    onFocus={() => update({ clientOption: "link" })}
                  />
                </View>
              </FormField>
              <FormField label="OR Create New Client">
                <Pressable
                  style={[
                    styles.addClientBtn,
                    form.clientOption === "new" && styles.addClientBtnSelected,
                  ]}
                  onPress={() => update({ clientOption: "new" })}
                >
                  <ThemedText
                    style={[
                      styles.addClientText,
                      form.clientOption === "new" &&
                        styles.addClientTextSelected,
                    ]}
                  >
                    + Add New Client
                  </ThemedText>
                </Pressable>
              </FormField>
              <View style={styles.buttons}>
                <Pressable
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={onBack}
                >
                  <ThemedText style={styles.btnSecondaryText}>
                    ← Back
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={onNext}
                >
                  <ThemedText style={styles.btnPrimaryText}>Next →</ThemedText>
                </Pressable>
              </View>
            </>
          )}

          {/* Step 4 of 4 */}
          {step === 4 && (
            <>
              <FormFieldWithHint
                label="Date of Filing"
                value={form.dateOfFiling}
                onChangeText={(v) => update({ dateOfFiling: v })}
                placeholder="15 Nov 2025"
                hint="Enter date of filing"
              />
              <FormFieldWithHint
                label="Next Hearing Date"
                required
                value={form.nextHearingDate}
                onChangeText={(v) => update({ nextHearingDate: v })}
                placeholder="20 Nov 2025"
                hint="Enter next hearing date"
                error={errors.nextHearingDate}
              />
              <FormField label="Case Status">
                <View style={styles.statusRow}>
                  {CASE_STATUSES.map(({ value, label }) => (
                    <RadioOption
                      key={value}
                      label={label}
                      selected={form.caseStatus === value}
                      onSelect={() =>
                        update({ caseStatus: value as CaseStatus })
                      }
                    />
                  ))}
                </View>
              </FormField>
              <FormFieldWithHint
                label="Notes (Optional)"
                value={form.notes}
                onChangeText={(v) => update({ notes: v })}
                placeholder="Brief description..."
                hint="Add any additional notes"
                multiline
                numberOfLines={4}
              />
              <View style={styles.buttons}>
                <Pressable
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={onBack}
                >
                  <ThemedText style={styles.btnSecondaryText}>
                    ← Back
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={onSave}
                >
                  <ThemedText style={styles.btnPrimaryText}>Save</ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  nextButton: {
    backgroundColor: theme.colors.themeBlack,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  nextButtonText: {
    color: theme.colors.pureWhite,
    fontSize: 16,
    fontWeight: "600",
  },
  addClientBtn: {
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  addClientBtnSelected: {
    borderColor: theme.colors.themeBlack,
    backgroundColor: theme.colors.themeBlack,
  },
  addClientText: {
    fontSize: 16,
    color: theme.colors.gray50,
  },
  addClientTextSelected: {
    color: theme.colors.pureWhite,
    fontWeight: "600",
  },
  clientOptionRow: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  clientOptionRowSelected: {
    borderColor: theme.colors.themeBlack,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  fieldError: {
    color: theme.colors.themeRed,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 4,
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
    backgroundColor: theme.colors.btnGray,
  },
  btnSecondaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.GrayBtnTitle,
  },
  btnPrimary: {
    backgroundColor: theme.colors.themeBlack,
  },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.pureWhite,
  },
});
