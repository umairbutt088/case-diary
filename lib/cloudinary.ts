/**
 * Cloudinary unsigned image upload for profile avatars.
 * Requires EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET.
 */

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "profiles";
const FOLDER = "legal-diary/profiles";

export const isCloudinaryConfigured = Boolean(CLOUD_NAME && UPLOAD_PRESET);

export interface UploadResult {
  secure_url: string;
  public_id: string;
}

/**
 * Upload an image to Cloudinary using unsigned upload preset.
 * @param fileUri - Local file URI (e.g. from expo-image-picker result)
 * @param mimeType - e.g. "image/jpeg"
 * @returns The secure_url of the uploaded image
 */
export async function uploadImage(
  fileUri: string,
  mimeType: string = "image/jpeg"
): Promise<string> {
  if (!isCloudinaryConfigured) {
    throw new Error("Cloudinary is not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and upload preset.");
  }

  const publicId = `${FOLDER}/profile_${Date.now()}`;

  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    type: mimeType,
    name: "photo.jpg",
  } as unknown as Blob);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("cloud_name", CLOUD_NAME);
  formData.append("public_id", publicId);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
      // Do not set Content-Type; let the runtime set it with boundary for FormData.
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudinary upload failed: ${response.status} ${text}`);
  }

  const result = (await response.json()) as UploadResult;
  return result.secure_url;
}

/**
 * Transform a Cloudinary URL for avatar display (crop fill, face focus, 200x200).
 */
const AVATAR_TRANSFORM = "c_fill,g_face,w_200,h_200";

export function getAvatarDisplayUrl(secureUrl: string | null | undefined): string | null {
  if (!secureUrl?.trim()) return null;
  if (!secureUrl.includes("res.cloudinary.com")) return secureUrl;
  if (secureUrl.includes("/image/upload/")) {
    return secureUrl.replace("/image/upload/", `/image/upload/${AVATAR_TRANSFORM}/`);
  }
  return secureUrl;
}
