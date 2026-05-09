// Entry shim: keep the native splash visible until `SplashScreen.hideAsync()` runs in `app/_layout.tsx`.
// Expo Router calls `internalMaybeHideAsync` when navigation is ready; without an early
// `preventAutoHideAsync()`, that dismisses the splash immediately (often imperceptible in dev).
const SplashScreen = require("expo-splash-screen");
const { Text, TextInput } = require("react-native");

if (!Text.defaultProps) Text.defaultProps = {};
if (!TextInput.defaultProps) TextInput.defaultProps = {};
Text.defaultProps.allowFontScaling = false;
Text.defaultProps.maxFontSizeMultiplier = 1;
TextInput.defaultProps.allowFontScaling = false;
TextInput.defaultProps.maxFontSizeMultiplier = 1;

void SplashScreen.preventAutoHideAsync().catch(() => {});

require("expo-router/entry");
