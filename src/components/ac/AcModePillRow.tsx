import type { ComponentType } from "react";
import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  type ViewStyle,
  View,
} from "react-native";

import { MODE_ICONS } from "../../constants/acModes";
import { type Theme, useTheme } from "../../theme/theme";
import type { AirConditionerMode } from "../../types/airConditioner";
import { Blend } from "lucide-react-native";

const MODE_PILL_IDS: AirConditionerMode[] = ["auto", "cold", "dry", "heat"];

type ModeIcon = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
  style?: ViewStyle;
}>;
type ModePill = {
  color: string;
  id: AirConditionerMode;
  label: string;
  Icon: ModeIcon;
};

const modePills = (theme: Theme): ModePill[] => {
  const icons = MODE_ICONS(theme);

  return MODE_PILL_IDS.map((id) => {
    const { color, icon: Icon, label } = icons[id];

    return {
      Icon,
      color,
      id,
      label,
    };
  });
};

type ModePillButtonProps = {
  active: boolean;
  disabled: boolean;
  option: ModePill;
  onPress: (mode: AirConditionerMode) => void;
};

function ModePillButton({
  active,
  disabled,
  onPress,
  option,
}: ModePillButtonProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const activeProgress = useRef(new Animated.Value(active ? 1 : 0)).current;
  const Icon = option.Icon;

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
      outputRange: [theme.transparent, theme.surfaceWarmPressed],
    }),
    borderColor: activeProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [theme.transparent, theme.borderActive],
    }),
    shadowOpacity: activeProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.18],
    }),
  };

  return (
    <TouchableOpacity
      activeOpacity={0.76}
      accessibilityLabel={`Set mode to ${option.label}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={() => onPress(option.id)}
      style={styles.buttonShell}
    >
      <Animated.View style={[styles.button, animatedButtonStyle]}>
        <View style={styles.buttonContent}>
          <Icon
            color={disabled ? theme.textMuted : option.color}
            size={18}
            strokeWidth={2.15}
          />
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.76}
            numberOfLines={1}
            style={[
              styles.buttonText,
              active && styles.buttonTextActive,
              disabled && styles.buttonTextDisabled,
            ]}
          >
            {option.label}
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

type AcModePillRowProps = {
  mode: AirConditionerMode;
  enabled: boolean;
  dimStyle: { opacity: Animated.AnimatedInterpolation<string | number> };
  onSelectMode: (mode: AirConditionerMode) => void;
};

export function AcModePillRow({
  mode,
  enabled,
  dimStyle,
  onSelectMode,
}: AcModePillRowProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pills = useMemo(() => modePills(theme), [theme]);

  return (
    <Animated.View style={[styles.container, dimStyle]}>
      <View style={styles.title}>
        <Blend
          color={theme.text}
          size={18}
          strokeWidth={2.2}
        />
        <Text style={styles.label}>Mode</Text>
      </View>

      <View style={styles.modeGroup}>
        {pills.map((modeOption) => {
          const selected = mode === modeOption.id;

          return (
            <ModePillButton
              active={selected}
              disabled={!enabled}
              key={modeOption.id}
              onPress={onSelectMode}
              option={modeOption}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
    },
    title: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    label: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 0,
    },
    modeGroup: {
      borderRadius: 20,
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
      borderColor: theme.transparent,
      borderRadius: 14,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      minWidth: 0,
      shadowColor: theme.shadows.color,
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
    buttonText: {
      color: theme.textSecondary,
      flexShrink: 1,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0,
    },
    buttonTextActive: {
      color: theme.accent,
    },
    buttonTextDisabled: {
      color: theme.textMuted,
    },
  });
