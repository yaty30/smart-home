import type { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { theme } from "../theme/theme";
import type { ControlOption } from "../types/airConditioner";

type ControlButtonGroupProps<T extends string> = {
  label: string;
  options: ControlOption<T>[];
  selectedValue: T;
  isPowered: boolean;
  isDisabled?: boolean;
  suppressSelection?: boolean;
  labelAccessory?: ReactNode;
  onChange: (value: T) => void;
};

export function ControlButtonGroup<T extends string>({
  label,
  options,
  selectedValue,
  isPowered,
  isDisabled = false,
  suppressSelection = false,
  labelAccessory,
  onChange,
}: ControlButtonGroupProps<T>) {
  const disabled = !isPowered || isDisabled;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {labelAccessory}
      </View>
      <View style={[styles.group, disabled && styles.groupDisabled]}>
        {options.map((option, index) => {
          const active =
            !disabled && !suppressSelection && selectedValue === option.id;

          return (
            <TouchableOpacity
              activeOpacity={0.76}
              accessibilityLabel={option.accessibilityLabel ?? option.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled }}
              disabled={disabled}
              key={option.id}
              onPress={() => onChange(option.id)}
              style={[styles.button, active && styles.buttonActive]}
            >
              <View style={styles.buttonContent}>
                {option.icon ? (
                  <View style={styles.iconFrame}>
                    <option.icon
                      color={
                        active
                          ? theme.accent
                          : !disabled
                            ? theme.textSecondary
                            : theme.textMuted
                      }
                      iconRotation={option.iconRotation ?? 0}
                      size={21}
                      strokeWidth={2.3}
                      type={index + 1}
                    />
                  </View>
                ) : null}
                {option.label ? (
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.68}
                    style={[
                      styles.buttonText,
                      active && styles.buttonTextActive,
                      disabled && styles.buttonTextDisabled,
                    ]}
                  >
                    {option.label}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: theme.textMuted,
    fontSize: theme.typography.label,
    fontWeight: "600",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  group: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  groupDisabled: {
    opacity: 0.56,
  },
  button: {
    alignItems: "center",
    backgroundColor: theme.paperBackground,
    borderColor: theme.border,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    flex: 1,
    height: 54,
    justifyContent: "center",
    minWidth: 0,
    paddingHorizontal: theme.spacing.sm,
  },
  buttonContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    justifyContent: "center",
    minWidth: 0,
  },
  buttonActive: {
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
    elevation: 4,
    shadowColor: theme.accent,
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.16,
    shadowRadius: 14,
  },
  buttonText: {
    color: theme.textSecondary,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
  },
  iconFrame: {
    alignItems: "center",
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  buttonTextActive: {
    color: theme.accent,
  },
  buttonTextDisabled: {
    color: theme.textMuted,
  },
});
