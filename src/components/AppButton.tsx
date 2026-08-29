import {
  LinearGradient as ExpoLinearGradient,
  type LinearGradientProps,
} from "expo-linear-gradient";
import { useMemo, type ComponentType, type ReactNode } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";

import { type Theme, useTheme } from "../theme/theme";

type AppButtonVariant = "primary" | "secondary" | "danger" | "destructive";
type AppButtonVibe = "normal" | "strong";

type AppButtonProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  leftIcon?: ReactNode;
  onPress: () => void;
  style?: ViewStyle | ViewStyle[];
  vibe?: AppButtonVibe;
  variant?: AppButtonVariant;
};

const GradientView =
  ExpoLinearGradient as unknown as ComponentType<LinearGradientProps>;

export function AppButton({
  accessibilityLabel,
  disabled = false,
  label,
  leftIcon,
  onPress,
  style,
  vibe = "normal",
  variant = "primary",
}: AppButtonProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const buttonGradients = useMemo<Record<AppButtonVariant, LinearGradientProps["colors"]>>(
    () => ({
      primary: theme.gradients.button,
      secondary: theme.gradients.panel,
      danger: theme.gradients.danger,
      destructive: theme.gradients.danger,
    }),
    [theme],
  );
  const isPrimary = variant === "primary";
  const isStrong = vibe === "strong";

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.buttonFrame,
        styles[`${variant}Frame`],
        isPrimary && isStrong && styles.primaryFrameStrong,
        isPrimary && styles.primaryShadow,
        disabled && styles.disabled,
        style,
      ]}
    >
      <GradientView
        colors={buttonGradients[variant]}
        end={{ x: 0.88, y: 1 }}
        start={{ x: 0.12, y: 0 }}
        style={styles.gradientFill}
      >
        <View style={styles.content}>
          {leftIcon}
          <Text
            style={[
              styles.label,
              styles[`${variant}Label`],
              isPrimary && isStrong && styles.primaryLabelStrong,
            ]}
          >
            {label}
          </Text>
        </View>
      </GradientView>
    </TouchableOpacity>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  buttonFrame: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: 18,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    overflow: "hidden",
  },
  gradientFill: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    width: "100%",
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  primaryFrame: {
    backgroundColor: theme.surfaceWarm,
    borderColor: theme.borderActive,
  },
  primaryFrameStrong: {
    borderColor: theme.accentStrong,
  },
  secondaryFrame: {
    backgroundColor: theme.surfaceLow,
    borderColor: theme.border,
  },
  dangerFrame: {
    backgroundColor: theme.powerAccentMuted,
    borderColor: theme.powerButton.borderDanger,
  },
  destructiveFrame: {
    backgroundColor: theme.powerAccentMuted,
    borderColor: theme.powerButton.borderOn,
  },
  primaryShadow: {
    elevation: 5,
    shadowColor: theme.shadows.color,
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.24,
    shadowRadius: 16,
  },
  disabled: {
    opacity: 0.48,
  },
  label: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0,
  },
  primaryLabel: {
    color: theme.accent,
  },
  primaryLabelStrong: {
    color: theme.accentStrong,
  },
  secondaryLabel: {
    color: theme.text,
  },
  dangerLabel: {
    color: theme.powerAccent,
  },
  destructiveLabel: {
    color: theme.text,
  },
});
