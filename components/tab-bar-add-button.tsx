import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { theme, TabBarColors } from "@/constants/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const ADD_BUTTON_SIZE = 56;
const ADD_ICON_SIZE = 28;

export function TabBarAddButton(props: BottomTabBarButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    if (process.env.EXPO_OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/add-case-flow");
  };

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        marginTop: -20,
      }}
    >
      <PlatformPressable
        {...props}
        onPress={handlePress}
        onPressIn={(ev) => props.onPressIn?.(ev)}
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
    </View>
  );
}
