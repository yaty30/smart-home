import type { PropsWithChildren } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";

type CollapsibleViewProps = PropsWithChildren<{
  duration?: number;
  style?: ViewStyle | ViewStyle[];
  visible: boolean;
}>;

export function CollapsibleView({
  children,
  duration = 240,
  style,
  visible,
}: CollapsibleViewProps) {
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const animationRun = useRef(0);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    const runId = animationRun.current + 1;
    animationRun.current = runId;

    if (visible) {
      setShouldRender(true);
    }

    const animation = Animated.timing(progress, {
      duration,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      toValue: visible ? 1 : 0,
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (animationRun.current !== runId) {
        return;
      }

      if (finished && !visible) {
        setShouldRender(false);
      }
    });

    return () => animation.stop();
  }, [duration, progress, visible]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;

    if (nextHeight <= 0) {
      return;
    }

    setContentHeight((currentHeight) => {
      if (
        currentHeight !== null &&
        Math.abs(currentHeight - nextHeight) < 1
      ) {
        return currentHeight;
      }

      return nextHeight;
    });
  };

  if (!shouldRender) {
    return null;
  }

  const animatedStyle = {
    maxHeight:
      contentHeight === null
        ? undefined
        : progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, contentHeight],
          }),
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-8, 0],
        }),
      },
    ],
  };

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[styles.container, animatedStyle, style]}
    >
      <View onLayout={handleLayout}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});
