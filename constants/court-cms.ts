/**
 * Pakistan court search entry points by level: trial/registries, High Courts, Supreme Court.
 */

export type PakistanCourtPortal = {
  id: string;
  label: string;
  description: string;
  url: string;
};

export type CourtPortalSection = {
  title: string;
  items: readonly PakistanCourtPortal[];
};

export const COURT_PORTAL_SECTIONS: readonly CourtPortalSection[] = [
  {
    title: "Trial courts & provincial registries",
    items: [
      {
        id: "punjab_dsj",
        label: "Punjab",
        description: "Department of Stamps & Justice (DSJ) — district / registry search",
        url: "https://dsj.punjab.gov.pk/",
      },
      {
        id: "sindh_district",
        label: "Sindh (district courts)",
        description: "District Courts Sindh — case search",
        url: "https://cases.districtcourtssindh.gos.pk/",
      },
      {
        id: "kpk_district",
        label: "Khyber Pakhtunkhwa (district)",
        description: "District courts — Peshawar HC district portal",
        url: "https://cfmisdcportal.peshawarhighcourt.gov.pk/",
      },
      {
        id: "gilgit_baltistan",
        label: "Gilgit-Baltistan",
        description: "GB Chief Court — case search",
        url: "https://gbcc.gov.pk/CaseSearchPage.aspx",
      },
      {
        id: "ajk",
        label: "Azad Jammu & Kashmir",
        description: "District Courts AJ&K — case search",
        url: "https://ajkdistrictcourts.gok.pk/case-search",
      },
    ],
  },
  {
    title: "High Courts",
    items: [
      {
        id: "lhc",
        label: "Lahore High Court",
        description: "Case management & cause lists",
        url: "https://lhc.gov.pk/case_management",
      },
      {
        id: "shc",
        label: "Sindh High Court",
        description: "SHC case search",
        url: "https://cases.shc.gov.pk/",
      },
      {
        id: "phc",
        label: "Peshawar High Court",
        description: "Case search (CFMIS)",
        url: "https://phccfmis.peshawarhighcourt.gov.pk/case-search",
      },
      {
        id: "ihc",
        label: "Islamabad High Court",
        description: "MIS case search",
        url: "https://mis.ihc.gov.pk/frmCseSrch.aspx",
      },
      {
        id: "bhc",
        label: "High Court of Balochistan",
        description: "Case tracking & cause lists",
        url: "https://portal.bhc.gov.pk/",
      },
    ],
  },
  {
    title: "Supreme Court of Pakistan",
    items: [
      {
        id: "scp",
        label: "Supreme Court of Pakistan",
        description: "Online case status — search on the Supreme Court website",
        url: "https://www.supremecourt.gov.pk/online-case-status/",
      },
    ],
  },
];

export function getAllCourtPortalsFlat(): PakistanCourtPortal[] {
  return COURT_PORTAL_SECTIONS.flatMap((s) => [...s.items]);
}

/** Flat list for legacy imports — prefer `COURT_PORTAL_SECTIONS` in UI. */
export const PAKISTAN_COURT_PORTALS = getAllCourtPortalsFlat();

export function getPakistanCourtPortalById(
  id: string | null | undefined,
): PakistanCourtPortal | undefined {
  if (!id) return undefined;
  for (const section of COURT_PORTAL_SECTIONS) {
    const found = section.items.find((p) => p.id === id);
    if (found) return found;
  }
  return undefined;
}
