import * as Haptics from "expo-haptics";
import { House, Settings as SettingsIcon, ShelvingUnit } from "lucide-react-native";
import { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { theme } from "../theme/theme";

export const BOTTOM_NAV_CLEARANCE = 60;
const NAV_ITEM_SIZE = 52;
const NAV_ITEM_GAP = theme.spacing.sm;

export type BottomNavTab = "home" | "rooms" | "settings";

const activeIndexByTab: Record<BottomNavTab, number> = {
  home: 0,
  rooms: 1,
  settings: 2,
};

type BottomNavProps = {
  active?: BottomNavTab;
  compact?: boolean;
  onHomePress?: () => void;
  onRoomsPress?: () => void;
  onSettingsPress?: () => void;
  visible?: boolean;
};

export function BottomNav({
  active = "home",
  compact = false,
  onHomePress,
  onRoomsPress,
  onSettingsPress,
  visible = true,
}: BottomNavProps) {
  const visibleProgress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const activeProgress = useRef(
    new Animated.Value(activeIndexByTab[active]),
  ).current;
  const compactProgress = useRef(new Animated.Value(compact ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(visibleProgress, {
      duration: 120,
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [visible, visibleProgress]);

  useEffect(() => {
    Animated.timing(activeProgress, {
      duration: 220,
      toValue: activeIndexByTab[active],
      useNativeDriver: true,
    }).start();
  }, [active, activeProgress]);

  useEffect(() => {
    Animated.timing(compactProgress, {
      duration: 180,
      toValue: compact ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [compact, compactProgress]);

  const triggerPress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const translateY = visibleProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [BOTTOM_NAV_CLEARANCE, 0],
  });
  const activeTranslateX = Animated.multiply(
    activeProgress,
    NAV_ITEM_SIZE + NAV_ITEM_GAP,
  );
  const scale = compactProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.6],
  });

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[
        styles.wrap,
        {
          opacity: visibleProgress,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <View style={styles.bar}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeIndicator,
            { transform: [{ translateX: activeTranslateX }] },
          ]}
        />
        <TouchableOpacity
          activeOpacity={0.8}
          accessibilityLabel="Home"
          accessibilityRole="button"
          accessibilityState={{ selected: active === "home" }}
          onPress={() => {
            triggerPress();
            onHomePress?.();
          }}
          style={styles.item}
        >
          <House
            color={active === "home" ? theme.textOnAccent : theme.textMuted}
            size={22}
            strokeWidth={2.4}
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          accessibilityLabel="Rooms"
          accessibilityRole="button"
          accessibilityState={{ selected: active === "rooms" }}
          onPress={() => {
            triggerPress();
            onRoomsPress?.();
          }}
          style={styles.item}
        >
          <ShelvingUnit
            color={active === "rooms" ? theme.textOnAccent : theme.textMuted}
            size={22}
            strokeWidth={2.4}
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          accessibilityLabel="Settings"
          accessibilityRole="button"
          accessibilityState={{ selected: active === "settings" }}
          onPress={() => {
            triggerPress();
            onSettingsPress?.();
          }}
          style={styles.item}
        >
          <SettingsIcon
            color={active === "settings" ? theme.textOnAccent : theme.textMuted}
            size={22}
            strokeWidth={2.1}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    bottom: Platform.OS === "ios" ? 28 : 18,
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 20,
  },
  bar: {
    alignItems: "center",
    backgroundColor: theme.navBar,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    elevation: 14,
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.4,
    shadowRadius: 22,
  },
  activeIndicator: {
    alignItems: "center",
    backgroundColor: theme.accentSolid,
    borderRadius: theme.radiusRound,
    height: 52,
    justifyContent: "center",
    left: theme.spacing.md,
    position: "absolute",
    shadowColor: theme.accentSolid,
    shadowOffset: {
      height: 4,
      width: 0,
    },
    shadowOpacity: 0.42,
    shadowRadius: 10,
    top: theme.spacing.sm,
    width: 52,
  },
  item: {
    alignItems: "center",
    height: 52,
    justifyContent: "center",
    width: 52,
    zIndex: 1,
  },
});
