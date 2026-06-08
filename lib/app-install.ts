import * as Clipboard from "expo-clipboard";
import { Alert, Linking, Platform, Share } from "react-native";

import {
  ANDROID_PLAY_STORE_URL,
  getInstallShareMessage,
  getPrimaryInstallUrl,
  hasIosStoreListing,
  IOS_APP_STORE_URL,
} from "@/constants/app-install";

export async function copyInstallLink(): Promise<void> {
  const url = getPrimaryInstallUrl();
  try {
    await Clipboard.setStringAsync(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not copy the link.";
    Alert.alert("Copy failed", message);
    throw error;
  }
}

export async function shareInstallLink(): Promise<void> {
  const message = getInstallShareMessage();
  try {
    const result = await Share.share({ message, title: "Install Case Diary for Lawyers" });
    if (result.action === Share.dismissedAction) {
      return;
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "Could not open the share menu.";
    Alert.alert("Share failed", errMessage);
    throw error;
  }
}

export async function openPlatformStore(): Promise<void> {
  const url =
    Platform.OS === "ios" && hasIosStoreListing()
      ? IOS_APP_STORE_URL
      : ANDROID_PLAY_STORE_URL;

  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Store unavailable", "Could not open the app store link on this device.");
  }
}

export { getPrimaryInstallUrl };
