import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { TabBarAddButton } from "@/components/tab-bar-add-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { TabBarColors } from "@/constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: TabBarColors.activeTint,
        tabBarInactiveTintColor: TabBarColors.inactiveTint,
        tabBarStyle: {
          backgroundColor: TabBarColors.background,
          borderTopColor: TabBarColors.background,
        },
        headerShown: false,
        tabBarLabelStyle: { fontSize: 12 },
        tabBarShowLabel: true,
      }}
    >
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
          title: "List",
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
