import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { type Theme, useTheme } from "../theme/theme";
import type { FanSpeed } from "../types/airConditioner";
import { Fan } from "lucide-react-native";

type FanSpeedOption = "auto" | FanSpeed;

const fanOptions: FanSpeedOption[] = ["auto", 1, 2, 3, 4, 5];

type FanSpeedControlProps = {
  speed: FanSpeed;
  isAuto: boolean;
  isPowered: boolean;
  isDisabled?: boolean;
  onChangeSpeed: (speed: FanSpeed) => void;
  onChangeAuto: (isAuto: boolean) => void;
};

type FanSpeedOptionButtonProps = {
  active: boolean;
  disabled: boolean;
  label: string;
  option: FanSpeedOption;
  onSelect: (option: FanSpeedOption) => void;
};

function FanSpeedOptionButton({
  active,
  disabled,
  label,
  onSelect,
  option,
}: FanSpeedOptionButtonProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
      outputRange: ["rgba(240, 169, 66, 0)", theme.surfaceWarmPressed],
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
      accessibilityLabel={
        option === "auto"
          ? "Set fan speed to auto"
          : `Set fan speed level ${option}`
      }
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={() => onSelect(option)}
      style={styles.buttonShell}
    >
      <Animated.View style={[styles.button, animatedButtonStyle]}>
        {option === "auto" ? (
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            numberOfLines={1}
            style={[
              styles.buttonText,
              active && styles.buttonTextActive,
              disabled && styles.buttonTextDisabled,
            ]}
          >
            {label}
          </Text>
        ) : (
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            color={
              active
                ? theme.accent
                : disabled
                  ? theme.textMuted
                  : theme.textSecondary
            }
            name={`numeric-${option}`}
            size={24}
          />
        </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

export function FanSpeedControl({
  speed,
  isAuto,
  isDisabled = false,
  isPowered,
  onChangeSpeed,
  onChangeAuto,
}: FanSpeedControlProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const disabled = !isPowered || isDisabled;
  const selectedValue: FanSpeedOption = isAuto ? "auto" : speed;
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

  const handleSelect = (option: FanSpeedOption) => {
    if (option === "auto") {
      onChangeAuto(true);
      return;
    }

    onChangeSpeed(option);
  };

  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      <View style={styles.title}>
        <Fan color={theme.text} size={18} />
        <Text style={styles.label}>Fan Speed</Text>
      </View>
      <View style={styles.group}>
        {fanOptions.map((option) => {
          const active = selectedValue === option;
          const label = option === "auto" ? "Auto" : String(option);

          return (
            <FanSpeedOptionButton
              active={active}
              disabled={disabled}
              key={label}
              label={label}
              onSelect={handleSelect}
              option={option}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
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
    flexDirection: "row",
    gap: 0,
    padding: 6,
  },
  buttonShell: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: theme.spacing.xs,
  },
  button: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    width: 'auto',
    justifyContent: "center",
    minWidth: 0,
    shadowColor: "#000000",
    shadowOffset: {
      height: 4,
      width: 0,
    },
    shadowRadius: 12,
  },
  buttonText: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
  },
  buttonTextActive: {
    color: theme.accent,
  },
  buttonTextDisabled: {
    color: theme.textMuted,
  },
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
