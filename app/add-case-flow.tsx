import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";

import { ChipGroup } from "@/components/add-case/chip-group";
import { DateField } from "@/components/add-case/date-field";
import { FormField } from "@/components/add-case/form-field";
import { FormFieldWithHint } from "@/components/add-case/form-field-with-hint";
import { JudgeNameField } from "@/components/add-case/judge-name-field";
import { AddNewClientModal } from "@/components/add-case/add-new-client-modal";
import { LinkExistingClientField } from "@/components/add-case/link-existing-client-field";
import { RadioOption } from "@/components/add-case/radio-option";
import { SearchableSelectField } from "@/components/add-case/searchable-select-field";
import { StepIndicator } from "@/components/add-case/step-indicator";
import { ThemedText } from "@/components/themed-text";
import {
  CASE_TYPES,
  COURT_TIERS,
  getCaseSubTypesForType,
  getCourtNamesForTier,
  getDerivedCaseTitle,
  initialAddCaseFormState,
  type AddCaseFormState,
  type CaseType,
  type CourtTier,
} from "@/constants/case-form";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const STEPS = 4;

export default function AddCaseFlowScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<AddCaseFormState>(initialAddCaseFormState);
  const [errors, setErrors] = useState<
    Partial<Record<keyof AddCaseFormState, string>>
  >({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);

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
    // Court name field commented out for now – uncomment when re-enabling "Which court?"
    // if (!form.courtName.trim()) e.courtName = "Court name is required";
    setErrors((prev) => ({ ...prev, ...e }));
    return Object.keys(e).length === 0;
  }, [form.courtTier]);

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
      form.respondentName
    );

    const row = {
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
    const { error } = await supabase
      .from("cases")
      .insert(row)
      .select()
      .single();
    setSaving(false);

    if (error) {
      setSaveError(error.message || "Failed to save case.");
      return;
    }
    router.back();
  }, [form, session?.user?.id, validateStep4, router]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
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
        {/* Step 1 of 4: Petitioner, Respondent (case title derived), Case Number, Case Type */}
        {step === 1 && (
          <>
            <FormFieldWithHint
              label="First Party Name"
              required
              value={form.petitionerName}
              onChangeText={(v) => update({ petitionerName: v })}
              placeholder="Enter First and Last Name"
              hint="Add First Party's full name"
              error={errors.petitionerName}
            />
            <FormFieldWithHint
              label="Second Party Name"
              required
              value={form.respondentName}
              onChangeText={(v) => update({ respondentName: v })}
              placeholder="Enter First and Last Name"
              hint="Add Second Party's full name"
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
            {/* Which court? – commented out; Step 2 currently uses court tier + judge + location only */}
            {/* <SearchableSelectField
              label="Which court?"
              required
              value={form.courtName}
              options={courtOptions}
              onChange={(v) => update({ courtName: v })}
              placeholder={
                form.courtTier
                  ? "Select or search court..."
                  : "Select court type first"
              }
              searchPlaceholder="Search court name..."
              disabled={!form.courtTier || courtOptions.length === 0}
              hint="Search or scroll to find the court where the case is filed"
              error={errors.courtName}
            /> */}
            <JudgeNameField
              label="Judge Name"
              value={form.judgeName}
              onChange={(v) => update({ judgeName: v })}
              placeholder="Select or add judge name"
              hint="Pick from saved judges or add a new name for future use"
            />
            <FormFieldWithHint
              label="Court room location"
              value={form.courtRoom}
              onChangeText={(v) => update({ courtRoom: v })}
              placeholder="e.g. Building A, 2nd Floor"
              hint="Enter court room location or address"
            />
            <View style={styles.buttons}>
              <Pressable
                style={[styles.btn, styles.btnSecondary]}
                onPress={onBack}
              >
                <ThemedText style={styles.btnSecondaryText}>← Back</ThemedText>
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
            <LinkExistingClientField
              label="Link Existing Client"
              value={form.linkedClientName}
              onChange={(name) =>
                update({
                  linkedClientName: name ?? "",
                  clientOption: name ? "link" : form.clientOption,
                })
              }
              placeholder="Select from your existing cases"
              hint="Parties from your cases — select to link this case to that client"
            />
            <FormField label="OR Add New Client">
              <Pressable
                style={[
                  styles.addClientBtn,
                  form.clientOption === "new" && styles.addClientBtnSelected,
                ]}
                onPress={() => {
                  update({ clientOption: "new" });
                  setShowAddClientModal(true);
                }}
              >
                <ThemedText
                  style={[
                    styles.addClientText,
                    form.clientOption === "new" && styles.addClientTextSelected,
                  ]}
                >
                  + Add New Client
                </ThemedText>
              </Pressable>
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
                setShowAddClientModal(false);
              }}
            />
            <View style={styles.buttons}>
              <Pressable
                style={[styles.btn, styles.btnSecondary]}
                onPress={onBack}
              >
                <ThemedText style={styles.btnSecondaryText}>← Back</ThemedText>
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
              <Pressable
                style={[styles.btn, styles.btnSecondary]}
                onPress={onBack}
                disabled={saving}
              >
                <ThemedText style={styles.btnSecondaryText}>← Back</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnPrimary]}
                onPress={onSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.pureWhite}
                  />
                ) : (
                  <ThemedText style={styles.btnPrimaryText}>Save</ThemedText>
                )}
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
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
  statusInput: {
    minHeight: 100,
  },
  saveError: {
    color: theme.colors.themeRed,
    fontSize: 14,
    marginBottom: 12,
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
