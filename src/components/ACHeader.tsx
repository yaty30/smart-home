import { BlurView } from "expo-blur";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { theme } from "../theme/theme";

type ACHeaderProps = {
  eyebrow?: string;
  isScrolled: boolean;
  onBackPress?: () => void;
  rightAccessory?: ReactNode;
  title?: string;
};

export function ACHeader({
  eyebrow,
  isScrolled,
  onBackPress,
  rightAccessory,
  title = "Air Conditioner",
}: ACHeaderProps) {
  const glassOpacity = useRef(new Animated.Value(isScrolled ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(glassOpacity, {
      duration: 100,
      toValue: isScrolled ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [glassOpacity, isScrolled]);

  return (
    <View style={[styles.headerWrap, isScrolled && styles.headerWrapScrolled]}>
      <View style={styles.container}>
        <Animated.View
          pointerEvents="none"
          style={[styles.glassLayer, { opacity: glassOpacity }]}
        >
          <BlurView
            experimentalBlurMethod="dimezisBlurView"
            intensity={28}
            style={StyleSheet.absoluteFill}
            tint="systemChromeMaterialDark"
          />
          <View style={styles.glassTint} />
          <View style={styles.topSeal} />
        </Animated.View>

        <TouchableOpacity
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBackPress}
          style={styles.backButton}
        >
          <ChevronLeft color={theme.accent} size={26} strokeWidth={2.35} />
          {/* <Text style={styles.backText}>Back</Text> */}
        </TouchableOpacity>

        <View style={styles.titleGroup}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.rightSlot}>{rightAccessory}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    backgroundColor: "transparent",
    paddingTop: 2,
    width: "100%",
    zIndex: 10,
  },
  headerWrapScrolled: {
    elevation: 10,
    shadowColor: "#000000",
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  container: {
    alignItems: "center",
    backgroundColor: "transparent",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 60,
    overflow: "hidden",
    paddingHorizontal: theme.spacing.lg,
    width: "100%",
  },
  glassLayer: {
    ...StyleSheet.absoluteFillObject,
    borderBottomColor: theme.border,
    borderBottomWidth: 1,
    overflow: "hidden",
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(33, 22, 15, 0.12)",
  },
  topSeal: {
    backgroundColor: theme.accentSubtle,
    height: 2,
    left: 1,
    position: "absolute",
    right: 1,
    top: 0,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "transparent",
    flexDirection: "row",
    gap: theme.spacing.xs,
    height: 40,
    justifyContent: "flex-start",
    minWidth: 62,
    paddingHorizontal: 0,
    zIndex: 1,
  },
  backText: {
    color: theme.accent,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0,
  },
  rightSlot: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 62,
    zIndex: 1,
  },
  titleGroup: {
    alignItems: "center",
    bottom: 0,
    gap: 1,
    justifyContent: "center",
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    right: 0,
    top: 0,
  },
  title: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0,
    textShadowColor: "rgba(0, 0, 0, 0.32)",
    textShadowOffset: {
      height: 1,
      width: 0,
    },
    textShadowRadius: 6,
  },
  eyebrow: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
