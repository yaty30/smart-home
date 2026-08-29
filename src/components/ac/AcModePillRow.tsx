import type { ReactNode } from "react";
import { useMemo } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity } from "react-native";

import { MODE_ICONS } from "../../constants/acModes";
import { type Theme, useTheme } from "../../theme/theme";
import type { AirConditionerMode } from "../../types/airConditioner";

const MODE_PILL_IDS: AirConditionerMode[] = ["auto", "cold", "dry", "heat"];

const modeIconStyles = {
  opacity: 0.86,
};

type ModePill = { id: AirConditionerMode; label: string; icon: ReactNode };

const modePills = (theme: Theme): ModePill[] => {
  const icons = MODE_ICONS(theme);

  return MODE_PILL_IDS.map((id) => {
    const { color, icon: Icon, label } = icons[id];

    return {
      id,
      label,
      icon: <Icon style={modeIconStyles} size={18} color={color} />,
    };
  });
};

type AcModePillRowProps = {
  mode: AirConditionerMode;
  enabled: boolean;
  dimStyle: { opacity: Animated.AnimatedInterpolation<number> };
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
    <Animated.View style={[styles.modePillRow, dimStyle]}>
      {pills.map((modeOption) => {
        const selected = mode === modeOption.id;

        return (
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ disabled: !enabled, selected }}
            disabled={!enabled}
            key={modeOption.id}
            onPress={() => onSelectMode(modeOption.id)}
            style={[styles.modePill, selected && styles.modePillSelected]}
          >
            {modeOption.icon}
            <Text
              style={[
                styles.modePillText,
                selected && styles.modePillTextSelected,
              ]}
            >
              {modeOption.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modePillRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    modePill: {
      alignItems: "center",
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      borderColor: theme.accentMuted,
      borderRadius: theme.radiusRound,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      paddingVertical: 12,
      flexDirection: "row",
      gap: theme.spacing.xs,
    },
    modePillSelected: {
      borderColor: theme.accentSolid,
    },
    modePillText: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0,
    },
    modePillTextSelected: {
      color: theme.accentStrong,
    },
  });
