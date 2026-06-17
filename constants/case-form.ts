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

export const CASE_TYPE_OTHER = "Other";

const CUSTOM_CASE_SUB_TYPES = ["Appeal", "Writ", "Other"] as const;

export function buildCaseTypeOptions(
  customTypes: string[],
  selectedType = "",
): string[] {
  const defaults = new Set(CASE_TYPES.map((type) => type.toLowerCase()));
  const seen = new Set<string>();
  const extras: string[] = [];

  for (const type of [...customTypes, selectedType]) {
    const trimmed = type.trim();
    if (!trimmed || trimmed === CASE_TYPE_OTHER) continue;
    const key = trimmed.toLowerCase();
    if (defaults.has(key) || seen.has(key)) continue;
    seen.add(key);
    extras.push(trimmed);
  }

  return [...CASE_TYPES, ...extras, CASE_TYPE_OTHER];
}

export function buildCaseSubTypeOptions(
  baseSubTypes: string[],
  customSubTypes: string[],
  selectedSubType = "",
): string[] {
  const withoutOther = baseSubTypes.filter((type) => type !== CASE_TYPE_OTHER);
  const defaults = new Set(withoutOther.map((type) => type.toLowerCase()));
  const seen = new Set<string>();
  const extras: string[] = [];

  for (const type of [...customSubTypes, selectedSubType]) {
    const trimmed = type.trim();
    if (!trimmed || trimmed === CASE_TYPE_OTHER) continue;
    const key = trimmed.toLowerCase();
    if (defaults.has(key) || seen.has(key)) continue;
    seen.add(key);
    extras.push(trimmed);
  }

  return [...withoutOther, ...extras, CASE_TYPE_OTHER];
}

/**
 * Case sub-types / categories shown after user selects a case type.
 */
export const CASE_SUB_TYPES: Record<CaseType, readonly string[]> = {
  Civil: [
    "Appeal",
    "Writ",
    "Suit",
    "Execution",
    "Injunction",
    "Specific Performance",
    "Declaration",
    "Other",
  ],
  Criminal: [
    "Appeal",
    "Writ",
    "Bail (Pre-arrest)",
    "Bail (Post-arrest)",
    "Revision",
    "Quashment",
    "Trial",
    "Other",
  ],
  Family: [
    "Appeal",
    "Writ",
    "Divorce",
    "Custody",
    "Maintenance",
    "Guardianship",
    "Other",
  ],
  Revenue: ["Appeal", "Writ", "Assessment", "Revision", "Other"],
  Tax: ["Appeal", "Writ", "Assessment", "Refund", "Revision", "Other"],
  Service: [
    "Appeal",
    "Writ",
    "Service Matter",
    "Pension",
    "Dismissal/Removal",
    "Other",
  ],
};

export function getCaseSubTypesForType(caseType: string): string[] {
  if (!caseType) return [];
  if (caseType in CASE_SUB_TYPES) {
    return [...CASE_SUB_TYPES[caseType as CaseType]];
  }
  return [...CUSTOM_CASE_SUB_TYPES];
}

/**
 * Court tiers: lower courts (civil, criminal), district, tribunals, high, supreme.
 */
export const COURT_TIERS = [
  { value: "civil", label: "Civil Court" },
  { value: "criminal", label: "Criminal Court" },
  { value: "family", label: "Family Court" },
  { value: "banking", label: "Banking Court" },
  { value: "district", label: "District Court" },
  { value: "tribunal", label: "Tribunal" },
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

/** Civil (lower) courts. */
export const CIVIL_COURTS = [
  "Civil Judge Court (Class I)",
  "Civil Judge Court (Class II)",
  "Civil Judge Court (Class III)",
  "Senior Civil Judge Court",
  "Court of Small Causes",
  "Civil Judge & Judicial Magistrate Court",
  "Additional District Judge (Civil)",
];

/** Criminal (lower) courts. */
export const CRIMINAL_COURTS = [
  "Judicial Magistrate (First Class)",
  "Judicial Magistrate (Second Class)",
  "Judicial Magistrate (Third Class)",
  "Executive Magistrate",
  "Special Magistrate Court",
  "Additional Sessions Judge Court",
  "Court of Session",
];

/** Family courts. */
export const FAMILY_COURTS = [
  "Family Court, Lahore",
  "Family Court, Karachi",
  "Family Court, Islamabad",
  "Family Court, Rawalpindi",
  "Family Court, Faisalabad",
];

/** Banking courts. */
export const BANKING_COURTS = [
  "Banking Court, Lahore",
  "Banking Court, Karachi",
  "Banking Court, Islamabad",
  "Banking Court, Rawalpindi",
  "Banking Court, Peshawar",
];

/** Tribunals. */
export const TRIBUNALS = [
  "Federal Service Tribunal",
  "Provincial Service Tribunal (Punjab)",
  "Provincial Service Tribunal (Sindh)",
  "Provincial Service Tribunal (KPK)",
  "Provincial Service Tribunal (Balochistan)",
  "Income Tax Appellate Tribunal",
  "Customs Appellate Tribunal",
  "Appellate Tribunal Inland Revenue",
  "National Accountability Bureau (NAB) Court",
  "Anti-Corruption Court",
  "Banking Court",
  "Competition Appellate Tribunal",
  "Environmental Tribunal",
  "Labour Court",
  "Labour Appellate Tribunal",
  "Consumer Protection Tribunal",
  "Special Court (Customs, Taxation & Anti-Smuggling)",
  "Drug Court",
  "Anti-Terrorism Court",
  "Other Tribunal",
];

export function getCourtNamesForTier(tier: CourtTier | ""): string[] {
  if (tier === "supreme") return [SUPREME_COURT];
  if (tier === "high") return HIGH_COURTS;
  if (tier === "district") return COMMON_DISTRICT_COURTS;
  if (tier === "civil") return CIVIL_COURTS;
  if (tier === "criminal") return CRIMINAL_COURTS;
  if (tier === "family") return FAMILY_COURTS;
  if (tier === "banking") return BANKING_COURTS;
  if (tier === "tribunal") return TRIBUNALS;
  return [];
}

/**
 * Current status of the case (as of today or from the last hearing).
 */
export const CURRENT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "listed", label: "Listed (for hearing)" },
  { value: "heard", label: "Heard" },
  { value: "order_reserved", label: "Order reserved" },
  { value: "adjourned", label: "Adjourned" },
  { value: "concluded", label: "Concluded" },
  { value: "other", label: "Other" },
] as const;

export type CurrentCaseStatus =
  (typeof CURRENT_STATUS_OPTIONS)[number]["value"];

/**
 * What is coming up next in the case (next step / next status).
 */
export const NEXT_STATUS_OPTIONS = [
  { value: "next_hearing", label: "Next hearing" },
  { value: "arguments", label: "Arguments" },
  { value: "judgment", label: "Judgment" },
  { value: "order_to_be_passed", label: "Order to be passed" },
  { value: "filing", label: "Filing" },
  { value: "evidence", label: "Evidence" },
  { value: "summoning", label: "Summoning" },
  { value: "other", label: "Other" },
] as const;

export type NextCaseStatus = (typeof NEXT_STATUS_OPTIONS)[number]["value"];

/** @deprecated Use CURRENT_STATUS_OPTIONS and CurrentCaseStatus */
export const CASE_STATUSES = CURRENT_STATUS_OPTIONS;
export type CaseStatus = CurrentCaseStatus;

/** Whether user is linking an existing client or creating a new one (Step 3). */
export type ClientOption = "link" | "new" | "";

export type AddCaseFormState = {
  caseNumber: string;
  caseType: string;
  caseSubType: string;
  courtTier: string;
  courtName: string;
  courtRoom: string;
  judgeName: string;
  petitionerName: string;
  respondentName: string;
  myClientIs: "petitioner" | "respondent" | "";
  clientOption: ClientOption;
  linkedClientSearch: string;
  linkedClientId: string | null;
  linkedClientName: string;
  dateOfFiling: string;
  nextHearingDate: string;
  caseStatus: string;
  nextStatus: string;
  totalFee: string;
  feeReceived: string;
  subordinatesCanViewFees: boolean;
};

export const initialAddCaseFormState: AddCaseFormState = {
  caseNumber: "",
  caseType: "",
  caseSubType: "",
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
  linkedClientName: "",
  dateOfFiling: "",
  nextHearingDate: "",
  caseStatus: "",
  nextStatus: "",
  totalFee: "",
  feeReceived: "",
  subordinatesCanViewFees: true,
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

export type PartyTerminology = {
  firstParty: string;
  secondParty: string;
};

/**
 * Returns party-role labels based on case context.
 * Stored values remain stable (first/second side) while labels adapt by forum/type.
 */
export function getPartyTerminology(
  courtTier: string,
  caseSubType: string,
): PartyTerminology {
  const subType = caseSubType.trim().toLowerCase();
  if (subType.includes("appeal")) {
    return { firstParty: "Appellant", secondParty: "Respondent" };
  }
  if (courtTier === "criminal") {
    return { firstParty: "Complainant", secondParty: "Accused" };
  }
  if (courtTier === "civil" || courtTier === "district" || courtTier === "family") {
    return { firstParty: "Plaintiff", secondParty: "Defendant" };
  }
  return { firstParty: "Petitioner", secondParty: "Respondent" };
}
