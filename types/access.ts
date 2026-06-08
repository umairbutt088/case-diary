export const ACCESS_PERMISSIONS = [
  "view_cases",
  "add_cases",
  "edit_cases",
  "delete_cases",
  "view_clients",
  "manage_documents",
  "manage_settings",
] as const;

export type AccessPermission = (typeof ACCESS_PERMISSIONS)[number];

export type AccessRole = "user" | "partner" | "admin" | "subordinate";

export type AccessPermissions = Record<AccessPermission, boolean>;

export const FULL_ACCESS_PERMISSIONS: AccessPermissions = {
  view_cases: true,
  add_cases: true,
  edit_cases: true,
  delete_cases: true,
  view_clients: true,
  manage_documents: true,
  manage_settings: true,
};

export const SUBORDINATE_FALLBACK_PERMISSIONS: AccessPermissions = {
  view_cases: false,
  add_cases: false,
  edit_cases: false,
  delete_cases: false,
  view_clients: false,
  manage_documents: false,
  manage_settings: false,
};
