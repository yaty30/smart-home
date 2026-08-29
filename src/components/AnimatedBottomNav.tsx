import { useMemo } from "react";
import { Animated, StyleSheet } from "react-native";

import { BottomNav } from "./BottomNav";

type BottomNavItems = React.ComponentProps<typeof BottomNav>["items"];

type AnimatedBottomNavProps = {
  items: BottomNavItems;
  opacity: Animated.Value;
  translateY: Animated.Value;
};

/**
 * Bottom nav wrapper driven by `useBottomNavAnimation`: it enters with the
 * screen and also exits during swipe-back.
 */
export function AnimatedBottomNav({
  items,
  opacity,
  translateY,
}: AnimatedBottomNavProps) {
  const styles = useMemo(() => createStyles(), []);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.layer, { opacity, transform: [{ translateY }] }]}
    >
      <BottomNav visible items={items} />
    </Animated.View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    layer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 30,
    },
  });
