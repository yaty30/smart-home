import {
  Moon,
  Power,
  PowerOff,
  Wifi,
  WifiHigh,
  WifiLow,
  WifiZero,
  Zap,
} from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { type Theme, useTheme } from "../../theme/theme";
import { ArcTemperatureGauge } from "../ArcTemperatureGauge";
import { Section } from "../Section";

type AcTemperatureCardProps = {
  subtitle: string;
  connectionStatus: "connecting" | "connected" | "disconnected";
  connectionLatencyMs: number | null;
  temperature: number;
  minTemperature: number;
  maxTemperature: number;
  gaugeSize: number;
  power: boolean;
  quiet: boolean;
  powerful: boolean;
  canControlDevice: boolean;
  quietControlEnabled: boolean;
  powerfulControlEnabled: boolean;
  onChangeTemperature: (temperature: number) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  onToggleQuiet: () => void;
  onTogglePowerful: () => void;
  onTogglePower: () => void;
};

export function AcTemperatureCard({
  subtitle,
  connectionStatus,
  connectionLatencyMs,
  temperature,
  minTemperature,
  maxTemperature,
  gaugeSize,
  power,
  quiet,
  powerful,
  canControlDevice,
  quietControlEnabled,
  powerfulControlEnabled,
  onChangeTemperature,
  onInteractionStart,
  onInteractionEnd,
  onToggleQuiet,
  onTogglePowerful,
  onTogglePower,
}: AcTemperatureCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const connectionPill = useMemo(() => {
    if (connectionStatus === "disconnected") {
      return {
        Icon: WifiZero,
        backgroundColor: theme.powerAccentMuted,
        borderColor: theme.powerButton.borderDanger,
        color: theme.powerAccent,
        label: "Offline",
      };
    }

    if (connectionStatus === "connecting") {
      return {
        Icon: WifiLow,
        backgroundColor: theme.powerAccentMuted,
        borderColor: theme.powerButton.borderDanger,
        color: theme.powerAccent,
        label: "Connecting",
      };
    }

    if (connectionLatencyMs === null) {
      return {
        Icon: WifiZero,
        backgroundColor: theme.powerAccentMuted,
        borderColor: theme.powerButton.borderDanger,
        color: theme.powerAccent,
        label: "No ping",
      };
    }

    const latency = connectionLatencyMs;
    const label = `${latency} ms`;

    if (latency > 1000) {
      return {
        Icon: WifiLow,
        backgroundColor: theme.powerAccentMuted,
        borderColor: theme.powerButton.borderDanger,
        color: theme.powerAccent,
        label,
      };
    }

    if (latency > 350) {
      return {
        Icon: WifiHigh,
        backgroundColor: theme.powerfulAccentMuted,
        borderColor: theme.powerfulAccent,
        color: theme.powerfulAccent,
        label,
      };
    }

    return {
      Icon: Wifi,
      backgroundColor: theme.statusColors.onlineMuted,
      borderColor: theme.statusColors.onlineBorder,
      color: theme.statusColors.online,
      label,
    };
  }, [connectionLatencyMs, connectionStatus, theme]);
  const ConnectionIcon = connectionPill.Icon;

  return (
    <Section>
      <View style={styles.temperatureHeader}>
        <View style={styles.temperatureTitleGroup}>
          {/* commentted out for future fix. */}
          {/* <View
            accessibilityLabel={`Connection latency ${connectionPill.label}`}
            style={[
              styles.connectionPill,
              {
                backgroundColor: connectionPill.backgroundColor,
                borderColor: connectionPill.borderColor,
              },
            ]}
          >
            <ConnectionIcon
              color={connectionPill.color}
              size={16}
              strokeWidth={2.5}
            />
            <Text
              style={[styles.connectionPillText, { color: connectionPill.color }]}
            >
              {connectionPill.label}
            </Text>
          </View> */}
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.temperatureActions}>
          <TouchableOpacity
            activeOpacity={0.75}
            accessibilityLabel="Toggle quiet mode"
            accessibilityRole="switch"
            accessibilityState={{
              checked: quiet,
              disabled: !quietControlEnabled,
            }}
            disabled={!quietControlEnabled}
            onPress={onToggleQuiet}
            style={[
              styles.quietButton,
              quiet ? styles.quietButtonOn : styles.quietButtonOff,
              !quietControlEnabled && styles.powerCornerButtonDisabled,
            ]}
          >
            <Moon
              color={quiet ? theme.quietAccent : theme.text}
              size={20}
              strokeWidth={2.4}
            />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            accessibilityLabel="Toggle powerful mode"
            accessibilityRole="switch"
            accessibilityState={{
              checked: powerful,
              disabled: !powerfulControlEnabled,
            }}
            disabled={!powerfulControlEnabled}
            onPress={onTogglePowerful}
            style={[
              styles.quietButton,
              powerful ? styles.powerfulButtonOn : styles.quietButtonOff,
              !powerfulControlEnabled && styles.powerCornerButtonDisabled,
            ]}
          >
            <Zap
              color={powerful ? theme.powerfulAccent : theme.text}
              size={20}
              strokeWidth={2.4}
            />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.75}
            accessibilityLabel="Toggle air conditioner power"
            accessibilityRole="switch"
            accessibilityState={{
              checked: power,
              disabled: !canControlDevice,
            }}
            disabled={!canControlDevice}
            onPress={onTogglePower}
            style={[
              styles.powerCornerButton,
              power ? styles.powerCornerButtonOn : styles.powerCornerButtonOff,
              !canControlDevice && styles.powerCornerButtonDisabled,
            ]}
          >
            {power ? (
              <PowerOff color={theme.powerAccent} size={20} strokeWidth={2.4} />
            ) : (
              <Power color={theme.accent} size={20} strokeWidth={2.4} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ArcTemperatureGauge
        isDisabled={!canControlDevice}
        isPowered={power}
        maxTemperature={maxTemperature}
        minTemperature={minTemperature}
        onChangeTemperature={onChangeTemperature}
        onInteractionEnd={onInteractionEnd}
        onInteractionStart={onInteractionStart}
        size={gaugeSize}
        temperature={temperature}
      />
    </Section>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    temperatureHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: theme.spacing.md,
      justifyContent: "space-between",
    },
    temperatureTitleGroup: {
      flex: 1,
      gap: theme.spacing.xs,
      minWidth: 0,
    },
    connectionPill: {
      alignItems: "center",
      alignSelf: "flex-start",
      borderRadius: theme.radiusRound,
      borderWidth: 1,
      flexDirection: "row",
      gap: theme.spacing.sm,
      minHeight: 32,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
    },
    connectionPillText: {
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
    },
    temperatureActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    cardSubtitle: {
      color: theme.textSecondary,
      fontSize: 15,
      fontWeight: "500",
      letterSpacing: 0,
      lineHeight: 21,
    },
    quietButton: {
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 1,
      height: 46,
      justifyContent: "center",
      width: 46,
    },
    quietButtonOn: {
      backgroundColor: theme.quietAccentMuted,
      borderColor: theme.quietAccent,
    },
    quietButtonOff: {
      backgroundColor: theme.controlBackground,
      borderColor: theme.border,
    },
    powerfulButtonOn: {
      backgroundColor: theme.powerfulAccentMuted,
      borderColor: theme.powerfulAccent,
    },
    powerCornerButton: {
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 1,
      height: 46,
      justifyContent: "center",
      width: 46,
    },
    powerCornerButtonOn: {
      backgroundColor: theme.powerAccentMuted,
      borderColor: theme.powerButton.borderOn,
    },
    powerCornerButtonOff: {
      backgroundColor: theme.surfaceWarm,
      borderColor: theme.borderActive,
    },
    powerCornerButtonDisabled: {
      opacity: 0.44,
    },
  });
