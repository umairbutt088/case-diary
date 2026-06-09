import Constants from "expo-constants";

export const APP_DISPLAY_NAME = "Case Diary for Lawyers";

const ANDROID_PACKAGE =
  Constants.expoConfig?.android?.package ?? "com.umairbutt.legaldiary";

const extra = Constants.expoConfig?.extra as
  | {
      androidPlayStoreUrl?: string;
      iosAppStoreUrl?: string;
    }
  | undefined;

export const ANDROID_PLAY_STORE_URL =
  extra?.androidPlayStoreUrl ??
  `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/** Set iosAppStoreUrl in app.json when the iOS App Store listing is live. */
export const IOS_APP_STORE_URL = extra?.iosAppStoreUrl ?? "";

export function hasIosStoreListing(): boolean {
  return IOS_APP_STORE_URL.trim().length > 0;
}

/** QR code and copy link — Google Play until a universal link is needed. */
export function getPrimaryInstallUrl(): string {
  return ANDROID_PLAY_STORE_URL;
}

export function getInstallShareMessage(url: string = getPrimaryInstallUrl()): string {
  const lines = [`Install ${APP_DISPLAY_NAME}:`, url];
  if (hasIosStoreListing()) {
    lines.push("", "iPhone (App Store):", IOS_APP_STORE_URL);
  }
  return lines.join("\n");
}
