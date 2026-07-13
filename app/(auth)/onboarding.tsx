import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
  type ViewToken,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { AuthButton } from "@/components/ui/auth-button";
import type { AppColors } from "@/constants/color-palette";
import { APP_DISPLAY_NAME } from "@/constants/app-install";
import { useAuth } from "@/context/auth-context";
import { useThemePalette } from "@/hooks/use-theme-palette";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type OnboardingSlide = {
  key: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accent: keyof AppColors;
  title: string;
  body: string;
};

const SLIDES: OnboardingSlide[] = [
  {
    key: "welcome",
    icon: "gavel",
    accent: "textAccent",
    title: "Welcome to Case Diary",
    body: "Your cases, hearings, and notes — organized in one place for daily court work.",
  },
  {
    key: "home",
    icon: "home",
    accent: "btnBlue",
    title: "Know what’s coming today",
    body: "See today’s hearings, filed cases, notes, and shortcuts from your Home screen.",
  },
  {
    key: "calendar",
    icon: "event",
    accent: "themeWarm",
    title: "Never miss a date",
    body: "Browse the calendar for hearings. Nightly reminders at 8 PM share tomorrow’s cause list.",
  },
  {
    key: "cases",
    icon: "folder-open",
    accent: "btnGreen",
    title: "Add a case in minutes",
    body: "Capture parties, court, hearing dates, documents, and fee payments step by step.",
  },
  {
    key: "team",
    icon: "groups",
    accent: "themeGreen",
    title: "Work alone or with your team",
    body: "Invite subordinates with controlled access. Keep disposed and trashed cases recoverable.",
  },
];

function createStyles(C: AppColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: C.background,
    },
    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 8,
      minHeight: 44,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.grey100,
    },
    skipBtn: {
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    skipText: {
      fontSize: 15,
      fontWeight: "600",
    },
    list: {
      flexGrow: 0,
    },
    page: {
      width: SCREEN_WIDTH,
      paddingHorizontal: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    iconWrap: {
      width: 112,
      height: 112,
      borderRadius: 56,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.grey100,
      marginBottom: 36,
      borderWidth: 1.5,
    },
    brand: {
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 12,
      textAlign: "center",
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      textAlign: "center",
      lineHeight: 34,
      marginBottom: 14,
      paddingHorizontal: 8,
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
      textAlign: "center",
      paddingHorizontal: 4,
    },
    footer: {
      paddingHorizontal: 24,
      paddingBottom: 16,
      paddingTop: 8,
      gap: 18,
    },
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: C.borderGray,
    },
    dotHitArea: {
      padding: 6,
      margin: -6,
    },
    dotActive: {
      width: 22,
    },
    actions: {
      gap: 12,
    },
    secondaryBtn: {
      alignItems: "center",
      paddingVertical: 12,
    },
    secondaryText: {
      fontSize: 15,
      fontWeight: "600",
    },
  });
}

export default function OnboardingScreen() {
  const { completeOnboarding } = useAuth();
  const C = useThemePalette();
  const styles = useMemo(() => createStyles(C), [C]);
  const listRef = useRef<FlatList<OnboardingSlide>>(null);
  const [index, setIndex] = useState(0);
  const finishingRef = useRef(false);

  const isLast = index === SLIDES.length - 1;

  const finish = useCallback(
    async (route: "/(auth)/login" | "/(auth)/signup" = "/(auth)/login") => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      try {
        // AuthNavigator owns routing — do not call router.replace here.
        await completeOnboarding(route);
      } finally {
        finishingRef.current = false;
      }
    },
    [completeOnboarding],
  );

  const lightTap = useCallback(() => {
    if (process.env.EXPO_OS === "ios") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const goToIndex = useCallback((target: number) => {
    const clamped = Math.max(0, Math.min(target, SLIDES.length - 1));
    listRef.current?.scrollToIndex({ index: clamped, animated: true });
    setIndex(clamped);
  }, []);

  const goNext = useCallback(() => {
    lightTap();
    if (isLast) {
      void finish("/(auth)/signup");
      return;
    }
    goToIndex(index + 1);
  }, [finish, goToIndex, index, isLast, lightTap]);

  const goBack = useCallback(() => {
    lightTap();
    goToIndex(index - 1);
  }, [goToIndex, index, lightTap]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) setIndex(first.index);
    },
  ).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 60,
  }).current;

  const onMomentumScrollEnd = (
    e: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(Math.max(0, Math.min(next, SLIDES.length - 1)));
  };

  const renderItem = ({ item, index: itemIndex }: { item: OnboardingSlide; index: number }) => {
    const accentColor = C[item.accent] as string;
    const iconWrapStyle = [styles.iconWrap, { borderColor: accentColor }];
    return (
    <View style={styles.page}>
      {itemIndex === index ? (
        <Animated.View entering={FadeInDown.duration(420)} style={iconWrapStyle}>
          <MaterialIcons name={item.icon} size={48} color={accentColor} />
        </Animated.View>
      ) : (
        <View style={iconWrapStyle}>
          <MaterialIcons name={item.icon} size={48} color={accentColor} />
        </View>
      )}
      {itemIndex === 0 ? (
        <ThemedText type="accent" style={styles.brand}>
          {APP_DISPLAY_NAME}
        </ThemedText>
      ) : null}
      <ThemedText type="accent" style={styles.title}>
        {item.title}
      </ThemedText>
      <ThemedText type="secondary" style={styles.body}>
        {item.body}
      </ThemedText>
    </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        {index > 0 ? (
          <Pressable
            style={styles.backBtn}
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Previous slide"
          >
            <MaterialIcons name="chevron-left" size={22} color={C.textSecondary} />
          </Pressable>
        ) : (
          <View />
        )}
        {!isLast ? (
          <Pressable
            style={styles.skipBtn}
            onPress={() => {
              lightTap();
              void finish("/(auth)/login");
            }}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <ThemedText type="link" style={styles.skipText}>
              Skip
            </ThemedText>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <View style={{ flex: 1, justifyContent: "center" }}>
        <FlatList
          ref={listRef}
          style={styles.list}
          data={SLIDES}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, i) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * i,
            index: i,
          })}
        />
      </View>

      <Animated.View entering={FadeInUp.delay(120).duration(400)} style={styles.footer}>
        <View
          style={styles.dots}
          accessibilityRole="adjustable"
          accessibilityLabel="Onboarding progress"
          accessibilityValue={{ min: 1, max: SLIDES.length, now: index + 1 }}
        >
          {SLIDES.map((slide, i) => (
            <Pressable
              key={slide.key}
              hitSlop={6}
              style={styles.dotHitArea}
              onPress={() => {
                lightTap();
                goToIndex(i);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Go to slide ${i + 1}: ${slide.title}`}
            >
              <View
                style={[
                  styles.dot,
                  i === index && [
                    styles.dotActive,
                    { backgroundColor: C[slide.accent] as string },
                  ],
                ]}
              />
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <AuthButton
            label={isLast ? "Create account" : "Continue"}
            onPress={goNext}
          />
          {isLast ? (
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                lightTap();
                void finish("/(auth)/login");
              }}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              <ThemedText type="link" style={styles.secondaryText}>
                Already have an account? Sign in
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
