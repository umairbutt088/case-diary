import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { TabBarColors, theme } from "@/constants/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const ADD_BUTTON_SIZE = 56;
const ADD_ICON_SIZE = 28;

export function TabBarAddButton(props: BottomTabBarButtonProps) {
  const router = useRouter();
  const scale = useSharedValue(1);

  const handlePress = () => {
    if (process.env.EXPO_OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push("/add-case-flow");
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value, { damping: 10, stiffness: 200 }) }],
  }));

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        marginTop: -20,
      }}
    >
      <Animated.View style={animatedStyle}>
        <PlatformPressable
          {...props}
          onPress={handlePress}
          onPressIn={(ev) => {
            scale.value = 0.9;
            props.onPressIn?.(ev);
            if (process.env.EXPO_OS === "ios") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }}
          onPressOut={(ev) => {
            scale.value = 1;
            props.onPressOut?.(ev);
          }}
          style={{
            width: ADD_BUTTON_SIZE,
            height: ADD_BUTTON_SIZE,
            borderRadius: ADD_BUTTON_SIZE / 2,
            backgroundColor: TabBarColors.addButtonBg,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 3,
            borderColor: "rgba(255,255,255,0.12)",
          }}
        >
          <MaterialIcons name="add" size={ADD_ICON_SIZE} color={theme.colors.pureWhite} />
        </PlatformPressable>
      </Animated.View>
    </View>
  );
}
