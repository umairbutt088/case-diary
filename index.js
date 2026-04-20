// Entry shim: keep the native splash visible until `SplashScreen.hideAsync()` runs in `app/_layout.tsx`.
// Expo Router calls `internalMaybeHideAsync` when navigation is ready; without an early
// `preventAutoHideAsync()`, that dismisses the splash immediately (often imperceptible in dev).
const SplashScreen = require("expo-splash-screen");

void SplashScreen.preventAutoHideAsync().catch(() => {});

require("expo-router/entry");
