import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";

interface BounceableProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  activeScale?: number;
  haptic?: Haptics.ImpactFeedbackStyle | boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Bounceable({
  children,
  style,
  activeScale = 0.95,
  haptic = Haptics.ImpactFeedbackStyle.Light,
  onPressIn,
  onPressOut,
  ...props
}: BounceableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value, { damping: 10, stiffness: 200 }) }],
  }));

  const handlePressIn = (event: any) => {
    scale.value = activeScale;
    if (haptic) {
      const style = typeof haptic === "boolean" ? Haptics.ImpactFeedbackStyle.Light : haptic;
      Haptics.impactAsync(style);
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event: any) => {
    scale.value = 1;
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
