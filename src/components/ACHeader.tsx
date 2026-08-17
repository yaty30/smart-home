import { BlurView } from "expo-blur";
import { ArrowLeft, ChevronDown, Settings } from "lucide-react-native";
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
  isScrolled: boolean;
  location: string;
};

export function ACHeader({ isScrolled, location }: ACHeaderProps) {
  const glassOpacity = useRef(new Animated.Value(isScrolled ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(glassOpacity, {
      duration: 180,
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
            intensity={72}
            style={StyleSheet.absoluteFill}
            tint="systemChromeMaterialDark"
          />
          <View style={styles.glassTint} />
          <View style={styles.topSeal} />
        </Animated.View>

        <TouchableOpacity
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.iconButton}
        >
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.35} />
        </TouchableOpacity>

        <View style={styles.titleGroup}>
          <Text style={styles.title}>Air Conditioner</Text>
          <View style={styles.locationRow}>
            <View style={styles.locationDot} />
            <Text style={styles.location}>{location}</Text>
            <ChevronDown
              color={theme.textSecondary}
              size={14}
              strokeWidth={2.5}
            />
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          style={styles.iconButton}
        >
          <Settings color={theme.text} size={21} strokeWidth={2.25} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    backgroundColor: "transparent",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 0,
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
    borderRadius: theme.radiusLarge,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 62,
    overflow: "hidden",
    paddingHorizontal: theme.spacing.sm,
  },
  glassLayer: {
    ...StyleSheet.absoluteFillObject,
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: theme.radiusLarge,
    borderWidth: 1,
    overflow: "hidden",
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 11, 13, 0.18)",
  },
  topSeal: {
    backgroundColor: "rgba(11, 11, 13, 0.34)",
    height: 2,
    left: 1,
    position: "absolute",
    right: 1,
    top: 0,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: {
      height: 6,
      width: 0,
    },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    width: 46,
  },
  titleGroup: {
    alignItems: "center",
    flex: 1,
    gap: 2,
    paddingHorizontal: theme.spacing.lg,
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
  locationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    minHeight: 18,
  },
  locationDot: {
    backgroundColor: theme.accent,
    borderRadius: theme.radiusRound,
    height: 5,
    shadowColor: theme.accent,
    shadowOffset: {
      height: 0,
      width: 0,
    },
    shadowOpacity: 0.65,
    shadowRadius: 8,
    width: 5,
  },
  location: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
  },
});
