export type SubordinateLinkRow = {
  id: string;
  supervisor_user_id: string;
  subordinate_user_id: string;
  is_active: boolean;
  can_view_cases: boolean;
  can_add_cases: boolean;
  can_edit_cases: boolean;
  can_delete_cases: boolean;
  can_dispose_cases: boolean;
  can_view_clients: boolean;
  can_manage_documents: boolean;
  can_manage_settings: boolean;
  created_at: string;
  updated_at: string;
};

export type SubordinateLinkWithProfile = SubordinateLinkRow & {
  subordinate_profile?: {
    id: string;
    email: string | null;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
};
