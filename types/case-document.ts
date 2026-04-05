/**
 * CaseDocument row as returned from Supabase public.case_documents
 */
export type CaseDocumentRow = {
  id: string;
  case_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};
