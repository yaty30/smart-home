import {
  LinearGradient as ExpoLinearGradient,
  type LinearGradientProps,
} from "expo-linear-gradient";
import type { PropsWithChildren } from "react";
import type { ComponentType } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { theme } from "../theme/theme";

type SectionProps = PropsWithChildren<{
  style?: ViewStyle | ViewStyle[];
}>;

const GradientView =
  ExpoLinearGradient as unknown as ComponentType<LinearGradientProps>;

export function Section({ children, style }: SectionProps) {
  return (
    <View style={styles.sectionFrame}>
      <GradientView
        colors={theme.gradients.panel}
        end={{ x: 0.86, y: 1 }}
        start={{ x: 0.14, y: 0 }}
        style={[styles.section, style]}
      >
        {children}
      </GradientView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionFrame: {
    backgroundColor: theme.paperBackground,
    borderColor: theme.border,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: theme.accentDeep,
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 22,
  },
  section: {
    gap: theme.spacing.md,
    padding: 18,
  },
});
