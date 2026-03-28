import { Tabs } from "expo-router";
import React, { useMemo } from "react";

import { HapticTab } from "@/components/haptic-tab";
import { TabBarAddButton } from "@/components/tab-bar-add-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { TabBarColors } from "@/constants/theme";
import { useAppTheme } from "@/context/app-theme-context";
import { useThemePalette } from "@/hooks/use-theme-palette";

export default function TabLayout() {
  const { isDark } = useAppTheme();
  const C = useThemePalette();

  const screenOptions = useMemo(() => {
    if (isDark) {
      return {
        tabBarActiveTintColor: C.zodiacColour,
        tabBarInactiveTintColor: C.gray50,
        tabBarStyle: {
          backgroundColor: C.pureWhite,
          borderTopColor: C.borderGray,
        },
        headerShown: false as const,
        tabBarLabelStyle: { fontSize: 12 },
        tabBarShowLabel: true as const,
      };
    }
    return {
      tabBarActiveTintColor: TabBarColors.activeTint,
      tabBarInactiveTintColor: TabBarColors.inactiveTint,
      tabBarStyle: {
        backgroundColor: TabBarColors.background,
        borderTopColor: TabBarColors.background,
      },
      headerShown: false as const,
      tabBarLabelStyle: { fontSize: 12 },
      tabBarShowLabel: true as const,
    };
  }, [isDark, C]);

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarButton: HapticTab,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarButton: HapticTab,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="calendar" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add-case"
        options={{
          title: "",
          tabBarButton: TabBarAddButton,
          tabBarIcon: () => null,
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: "All Cases",
          tabBarButton: HapticTab,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="list.bullet" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarButton: HapticTab,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="person.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
