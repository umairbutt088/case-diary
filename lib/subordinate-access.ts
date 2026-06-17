import type { AccessPermissions } from "@/types/access";
import { SUBORDINATE_FALLBACK_PERMISSIONS } from "@/types/access";
import type { SubordinateLinkRow } from "@/types/subordinate-link";

export function permissionsFromSubordinateLink(
  link: SubordinateLinkRow | null,
): AccessPermissions {
  if (!link || !link.is_active) {
    return SUBORDINATE_FALLBACK_PERMISSIONS;
  }

  return {
    view_cases: Boolean(link.can_view_cases),
    add_cases: Boolean(link.can_add_cases),
    edit_cases: Boolean(link.can_edit_cases),
    delete_cases: Boolean(link.can_delete_cases),
    dispose_cases: Boolean(link.can_dispose_cases),
    view_clients: Boolean(link.can_view_clients),
    view_case_fees: Boolean(link.can_view_case_fees),
    manage_documents: Boolean(link.can_manage_documents),
  };
}

export function parseSubordinateLinkRow(
  record: Record<string, unknown> | undefined,
): SubordinateLinkRow | null {
  if (!record || typeof record.id !== "string") return null;

  return {
    id: record.id,
    supervisor_user_id: String(record.supervisor_user_id ?? ""),
    subordinate_user_id: String(record.subordinate_user_id ?? ""),
    is_active: Boolean(record.is_active),
    can_view_cases: Boolean(record.can_view_cases),
    can_add_cases: Boolean(record.can_add_cases),
    can_edit_cases: Boolean(record.can_edit_cases),
    can_delete_cases: Boolean(record.can_delete_cases),
    can_dispose_cases: Boolean(record.can_dispose_cases),
    can_view_clients: Boolean(record.can_view_clients),
    can_view_case_fees: Boolean(record.can_view_case_fees),
    can_manage_documents: Boolean(record.can_manage_documents),
    created_at: String(record.created_at ?? ""),
    updated_at: String(record.updated_at ?? ""),
  };
}
