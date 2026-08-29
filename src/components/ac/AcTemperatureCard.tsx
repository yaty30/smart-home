import { AirVent, Moon, Power, PowerOff, Zap } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { type Theme, useTheme } from "../../theme/theme";
import { ArcTemperatureGauge } from "../ArcTemperatureGauge";
import { Section } from "../Section";

type AcTemperatureCardProps = {
  title: string;
  subtitle: string;
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
  title,
  subtitle,
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

  return (
    <Section>
      <View style={styles.temperatureHeader}>
        <View style={styles.temperatureTitleGroup}>
          <View style={styles.temperatureTitleContainer}>
            <AirVent color={theme.text} />
            <Text style={styles.cardTitle}>{title}</Text>
          </View>
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
              power
                ? styles.powerCornerButtonOn
                : styles.powerCornerButtonOff,
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
    temperatureTitleContainer: {
      display: "flex",
      flexDirection: "row",
      gap: 6,
    },
    temperatureActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    cardTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "800",
      letterSpacing: 0,
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
