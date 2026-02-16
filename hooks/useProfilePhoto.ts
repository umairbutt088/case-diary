import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { isCloudinaryConfigured, uploadImage } from "@/lib/cloudinary";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function useProfilePhoto(
  userId: string | undefined,
  onProfileUpdate?: () => void
) {
  const [uploading, setUploading] = useState(false);

  const pickImage = useCallback(async () => {
    if (!userId) return;

    if (!isCloudinaryConfigured) {
      Alert.alert(
        "Not configured",
        "Profile photo upload is not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and upload preset in your environment."
      );
      return;
    }

    if (
      !ImagePicker ||
      typeof ImagePicker.getMediaLibraryPermissionsAsync !== "function"
    ) {
      Alert.alert(
        "Not available",
        "Image picker is not available here. Use Expo Go on a device or simulator, or rebuild the app."
      );
      return;
    }

    const { status: existing } =
      await ImagePicker.getMediaLibraryPermissionsAsync();
    if (existing !== "granted") {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "We need access to your photo library to set a profile picture."
        );
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const mimeType = asset.mimeType ?? "image/jpeg";

    setUploading(true);
    try {
      const imageUrl = await uploadImage(uri, mimeType);

      if (!isSupabaseConfigured) {
        Alert.alert("Error", "Cannot save profile: Supabase is not configured.");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: imageUrl })
        .eq("id", userId);

      if (error) {
        Alert.alert("Update failed", error.message ?? "Could not update profile.");
        return;
      }

      onProfileUpdate?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed.";
      Alert.alert("Upload failed", message);
    } finally {
      setUploading(false);
    }
  }, [userId, onProfileUpdate]);

  return { pickImage, uploading };
}
