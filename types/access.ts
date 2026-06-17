export const ACCESS_PERMISSIONS = [
  "view_cases",
  "add_cases",
  "edit_cases",
  "delete_cases",
  "dispose_cases",
  "view_clients",
  "view_case_fees",
  "manage_documents",
] as const;

export type AccessPermission = (typeof ACCESS_PERMISSIONS)[number];

export type AccessRole = "user" | "partner" | "admin" | "subordinate";

export type AccessPermissions = Record<AccessPermission, boolean>;

export const FULL_ACCESS_PERMISSIONS: AccessPermissions = {
  view_cases: true,
  add_cases: true,
  edit_cases: true,
  delete_cases: true,
  dispose_cases: true,
  view_clients: true,
  view_case_fees: true,
  manage_documents: true,
};

export const SUBORDINATE_FALLBACK_PERMISSIONS: AccessPermissions = {
  view_cases: false,
  add_cases: false,
  edit_cases: false,
  delete_cases: false,
  dispose_cases: false,
  view_clients: false,
  view_case_fees: false,
  manage_documents: false,
};
