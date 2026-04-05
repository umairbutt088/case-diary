import { supabase } from "./supabase";
import type { CaseDocumentRow } from "@/types/case-document";
import * as FileSystem from "expo-file-system";

/**
 * Fetch all documents for a specific case.
 */
export async function getCaseDocuments(caseId: string): Promise<CaseDocumentRow[]> {
  const { data, error } = await supabase
    .from("case_documents")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching case documents:", error);
    throw new Error(error.message);
  }

  return data as CaseDocumentRow[];
}

/**
 * Upload a document to Supabase storage and insert a row in case_documents.
 */
export async function uploadCaseDocument(params: {
  caseId: string;
  userId: string;
  fileUri: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}): Promise<CaseDocumentRow> {
  const { caseId, userId, fileUri, fileName, mimeType, fileSize } = params;

  // Supabase Storage expects the file in FormData with an object
  // Since we are in React Native, we can construct FormData like this
  const filePath = `${userId}/${caseId}/${Date.now()}_${fileName}`;
  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  // Upload to bucket
  const { error: uploadError } = await supabase.storage
    .from("case_documents")
    .upload(filePath, formData, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("Error uploading to storage:", uploadError);
    throw new Error(uploadError.message);
  }

  // Insert into database
  const { data: row, error: dbError } = await supabase
    .from("case_documents")
    .insert([
      {
        case_id: caseId,
        user_id: userId,
        file_name: fileName,
        file_path: filePath,
        mime_type: mimeType,
        size_bytes: fileSize,
      },
    ])
    .select("*")
    .single();

  if (dbError) {
    // Attempt rollback: delete the file if DB insert fails
    await supabase.storage.from("case_documents").remove([filePath]);
    console.error("Error inserting document row:", dbError);
    throw new Error(dbError.message);
  }

  return row as CaseDocumentRow;
}

/**
 * Delete a document from both Storage and Database.
 */
export async function deleteCaseDocument(documentId: string, filePath: string) {
  // First delete from DB
  const { error: dbError } = await supabase
    .from("case_documents")
    .delete()
    .eq("id", documentId);

  if (dbError) {
    console.error("Error deleting from DB:", dbError);
    throw new Error(dbError.message);
  }

  // Then delete from storage
  const { error: storageError } = await supabase.storage
    .from("case_documents")
    .remove([filePath]);

  if (storageError) {
    console.error("Error deleting from storage:", storageError);
    // Don't throw here, the DB row is removed, so it's conceptually deleted for the user
  }
}

/**
 * Get a temporary view/download URL for the document.
 */
export async function getDocumentDownloadUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("case_documents")
    .createSignedUrl(filePath, 60 * 60); // 1 hour validity

  if (error || !data) {
    console.error("Error creating signed URL:", error);
    throw new Error(error?.message || "Failed to create signed URL");
  }

  return data.signedUrl;
}
