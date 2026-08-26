import { Power, PowerOff, Trash2 } from "lucide-react-native";
import type { ComponentType } from "react";
import {
  type GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { theme } from "../theme/theme";

type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

type CardPowerButtonProps = {
  accessibilityLabel: string;
  isOn: boolean;
  onToggle: (event: GestureResponderEvent) => void;
};

export function CardPowerButton({
  accessibilityLabel,
  isOn,
  onToggle,
}: CardPowerButtonProps) {
  const PowerIcon = isOn ? PowerOff : Power;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: isOn }}
      onPress={onToggle}
      style={[
        styles.powerButton,
        isOn ? styles.powerButtonOn : styles.powerButtonOff,
      ]}
    >
      <PowerIcon
        color={isOn ? theme.powerAccent : theme.accent}
        size={18}
        strokeWidth={2.5}
      />
    </TouchableOpacity>
  );
}

type DeviceGridCardProps = {
  icon: IconComponent;
  name: string;
  subtitle: string;
  powered: boolean;
  statusLabel: string;
  onDelete?: () => void;
  onPress?: () => void;
  onTogglePower: () => void;
};

export function DeviceGridCard({
  icon: Icon,
  name,
  subtitle,
  powered,
  statusLabel,
  onDelete,
  onPress,
  onTogglePower,
}: DeviceGridCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, powered && styles.cardOn]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconFrame, powered && styles.iconFrameOn]}>
          <Icon
            color={powered ? theme.accent : theme.textSecondary}
            size={21}
            strokeWidth={2.2}
          />
        </View>
        <View style={styles.cardActions}>
          <CardPowerButton
            accessibilityLabel={`Toggle ${name}`}
            isOn={powered}
            onToggle={(event) => {
              event.stopPropagation();
              onTogglePower();
            }}
          />
          {onDelete !== undefined ? (
            <TouchableOpacity
              activeOpacity={0.75}
              accessibilityLabel={`Delete ${name}`}
              accessibilityRole="button"
              onPress={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              style={styles.deleteButton}
            >
              <Trash2
                color={theme.powerAccent}
                size={18}
                strokeWidth={2.4}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <Text numberOfLines={1} style={styles.name}>
        {name}
      </Text>
      <Text numberOfLines={1} style={styles.subtitle}>
        {subtitle}
      </Text>

      <View style={styles.statusChip}>
        <Text
          numberOfLines={1}
          style={[styles.statusText, powered && styles.statusTextOn]}
        >
          {statusLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surfaceLow,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    flexGrow: 1,
    padding: theme.spacing.md,
    width: "48.2%",
  },
  cardOn: {
    backgroundColor: theme.surfaceWarm,
    borderColor: theme.borderStrong,
    shadowColor: theme.accent,
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  iconFrame: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 15,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  iconFrameOn: {
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
  },
  cardActions: {
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  powerButton: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  powerButtonOn: {
    backgroundColor: theme.powerAccentMuted,
    borderColor: "rgba(255, 106, 88, 0.58)",
  },
  powerButtonOff: {
    backgroundColor: theme.surfaceWarm,
    borderColor: theme.borderActive,
  },
  deleteButton: {
    alignItems: "center",
    backgroundColor: theme.controlBackground,
    borderColor: "rgba(255, 106, 88, 0.38)",
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  name: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 19,
  },
  subtitle: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
    marginTop: theme.spacing.xs,
  },
  statusChip: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: theme.radiusSmall,
    justifyContent: "center",
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 9,
  },
  statusText: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  statusTextOn: {
    color: theme.accent,
  },
});
