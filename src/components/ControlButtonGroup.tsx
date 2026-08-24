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
import type { ControlOption } from "../types/airConditioner";

type ControlButtonGroupProps<T extends string> = {
  label: string;
  showLabel?: boolean;
  options: ControlOption<T>[];
  selectedValue: T;
  isPowered: boolean;
  isDisabled?: boolean;
  suppressSelection?: boolean;
  labelAccessory?: ReactNode;
  onChange: (value: T) => void;
};

type ControlOptionButtonProps<T extends string> = {
  active: boolean;
  disabled: boolean;
  isDense: boolean;
  index: number;
  option: ControlOption<T>;
  onPress: (value: T) => void;
};

function ControlOptionButton<T extends string>({
  active,
  disabled,
  index,
  isDense,
  onPress,
  option,
}: ControlOptionButtonProps<T>) {
  const activeProgress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(activeProgress, {
      duration: 100,
      toValue: active ? 1 : 0,
      useNativeDriver: false,
    }).start();
  }, [active, activeProgress]);

  const animatedButtonStyle = {
    backgroundColor: activeProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ["rgba(240, 169, 66, 0)", "#2C2117"],
    }),
    borderColor: activeProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ["rgba(240, 169, 66, 0)", theme.borderActive],
    }),
    shadowOpacity: activeProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.18],
    }),
  };

  return (
    <TouchableOpacity
      activeOpacity={0.76}
      accessibilityLabel={option.accessibilityLabel ?? option?.label ?? ""}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={() => onPress(option.id)}
      style={[styles.buttonShell, isDense && styles.buttonDense]}
    >
      <Animated.View style={[styles.button, animatedButtonStyle]}>
        <View
          style={[
            styles.buttonContent,
            isDense && styles.buttonContentDense,
          ]}
        >
          {option.icon ? (
            <View
              style={[
                styles.iconFrame,
                option.iconRotation !== undefined && styles.iconFrameRotated,
                option.iconRotation !== undefined && {
                  transform: [{ rotate: `${option.iconRotation}deg` }],
                },
              ]}
            >
              <option.icon
                color={
                  active
                    ? theme.accent
                    : !disabled
                      ? theme.textSecondary
                      : theme.textMuted
                }
                iconRotation={option.iconRotation ?? 0}
                size={isDense ? 17 : 19}
                strokeWidth={2.15}
                type={option.iconType ?? index + 1}
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
                isDense && styles.buttonTextDense,
                active && styles.buttonTextActive,
                disabled && styles.buttonTextDisabled,
              ]}
            >
              {option.label}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export function ControlButtonGroup<T extends string>({
  label,
  showLabel = true,
  options,
  selectedValue,
  isPowered,
  isDisabled = false,
  suppressSelection = false,
  labelAccessory,
  onChange,
}: ControlButtonGroupProps<T>) {
  const disabled = !isPowered || isDisabled;
  const enabledProgress = useRef(new Animated.Value(disabled ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(enabledProgress, {
      duration: 220,
      toValue: disabled ? 0 : 1,
      useNativeDriver: true,
    }).start();
  }, [disabled, enabledProgress]);

  const animatedContainerStyle = {
    opacity: enabledProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.52, 1],
    }),
  };

  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      {showLabel ? (
        <View style={styles.title}>
          {labelAccessory}
          <Text style={styles.label}>{label}</Text>
        </View>
      ) : null}
      <View style={styles.group}>
        {options.map((option, index) => {
          const active =
            !suppressSelection && selectedValue === option.id;
          const isDense = options.length > 4;

          return (
            <ControlOptionButton
              active={active}
              disabled={disabled}
              index={index}
              isDense={isDense}
              key={option.id}
              onPress={onChange}
              option={option}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  label: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0,
  },
  group: {
    borderRadius: 20,
    flexDirection: "row",
    gap: 0,
    padding: 6,
  },
  buttonShell: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 2,
  },
  button: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 14,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    minWidth: 0,
    shadowColor: "#000000",
    shadowOffset: {
      height: 4,
      width: 0,
    },
    shadowRadius: 12,
  },
  buttonContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    justifyContent: "center",
    minWidth: 0,
  },
  buttonContentDense: {
    flexDirection: "column",
    gap: 2,
  },
  buttonDense: {
    paddingHorizontal: theme.spacing.xs,
  },
  buttonText: {
    color: theme.textSecondary,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
  },
  buttonTextDense: {
    fontSize: 11,
    lineHeight: 13,
  },
  iconFrame: {
    alignItems: "center",
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  iconFrameRotated: {
    transformOrigin: "center",
  },
  buttonTextActive: {
    color: theme.accent,
  },
  buttonTextDisabled: {
    color: theme.textMuted,
  },
});
