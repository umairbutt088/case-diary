/**
 * Case types from your outline only.
 */
export const CASE_TYPES = [
  "Civil",
  "Criminal",
  "Family",
  "Revenue",
  "Tax",
  "Service",
] as const;

export type CaseType = (typeof CASE_TYPES)[number];

/**
 * Court tiers from your outline.
 */
export const COURT_TIERS = [
  { value: "district", label: "District Court" },
  { value: "high", label: "High Court" },
  { value: "supreme", label: "Supreme Court" },
] as const;

export type CourtTier = (typeof COURT_TIERS)[number]["value"];

/** Supreme Court of Pakistan */
export const SUPREME_COURT = "Supreme Court of Pakistan";

/** High courts (one per province/territory). */
export const HIGH_COURTS = [
  "Lahore High Court",
  "Sindh High Court",
  "Peshawar High Court",
  "Islamabad High Court",
  "High Court of Balochistan",
];

/** Common District & Sessions Courts. */
export const COMMON_DISTRICT_COURTS = [
  "District & Sessions Court, Lahore",
  "District & Sessions Court, Karachi",
  "District & Sessions Court, Islamabad",
  "District & Sessions Court, Rawalpindi",
  "District & Sessions Court, Faisalabad",
  "District & Sessions Court, Multan",
  "District & Sessions Court, Peshawar",
  "District & Sessions Court, Quetta",
  "District & Sessions Court, Sialkot",
  "District & Sessions Court, Gujranwala",
];

export function getCourtNamesForTier(tier: CourtTier | ""): string[] {
  if (tier === "supreme") return [SUPREME_COURT];
  if (tier === "high") return HIGH_COURTS;
  if (tier === "district") return COMMON_DISTRICT_COURTS;
  return [];
}

/**
 * Case status from your outline.
 */
export const CASE_STATUSES = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "concluded", label: "Concluded" },
  { value: "adjourned", label: "Adjourned" },
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number]["value"];

/** Whether user is linking an existing client or creating a new one (Step 3). */
export type ClientOption = "link" | "new" | "";

export type AddCaseFormState = {
  caseNumber: string;
  caseType: CaseType | "";
  courtTier: CourtTier | "";
  courtName: string;
  courtRoom: string;
  judgeName: string;
  petitionerName: string;
  respondentName: string;
  myClientIs: "petitioner" | "respondent" | "";
  clientOption: ClientOption;
  linkedClientSearch: string;
  linkedClientId: string | null;
  dateOfFiling: string;
  nextHearingDate: string;
  caseStatus: CaseStatus | "";
  notes: string;
};

export const initialAddCaseFormState: AddCaseFormState = {
  caseNumber: "",
  caseType: "",
  courtTier: "",
  courtName: "",
  courtRoom: "",
  judgeName: "",
  petitionerName: "",
  respondentName: "",
  myClientIs: "",
  clientOption: "",
  linkedClientSearch: "",
  linkedClientId: null,
  dateOfFiling: "",
  nextHearingDate: "",
  caseStatus: "",
  notes: "",
};

/**
 * Derive case title from petitioner and respondent using the first name of each party.
 * e.g. "State of Pakistan" + "Muhammad Ali" → "State vs. Muhammad"
 */
export function getDerivedCaseTitle(
  petitionerName: string,
  respondentName: string
): string {
  const petitionerFirst = petitionerName.trim().split(/\s+/)[0] ?? "";
  const respondentFirst = respondentName.trim().split(/\s+/)[0] ?? "";
  if (!petitionerFirst && !respondentFirst) return "";
  if (!petitionerFirst) return respondentFirst;
  if (!respondentFirst) return petitionerFirst;
  return `${petitionerFirst} vs. ${respondentFirst}`;
}
