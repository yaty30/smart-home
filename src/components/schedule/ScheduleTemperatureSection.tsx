import { Moon, Thermometer, Zap } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { type Theme, useTheme } from "../../theme/theme";
import { ArcTemperatureGauge } from "../ArcTemperatureGauge";
import { Section } from "../Section";
import { createEditorSectionStyles } from "./editorSectionStyles";

type ScheduleTemperatureSectionProps = {
  temperature: number;
  minTemperature: number;
  maxTemperature: number;
  quiet: boolean;
  powerful: boolean;
  onChangeTemperature: (temperature: number) => void;
  onToggleQuiet: () => void;
  onTogglePowerful: () => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
};

export function ScheduleTemperatureSection({
  temperature,
  minTemperature,
  maxTemperature,
  quiet,
  powerful,
  onChangeTemperature,
  onToggleQuiet,
  onTogglePowerful,
  onInteractionStart,
  onInteractionEnd,
}: ScheduleTemperatureSectionProps) {
  const theme = useTheme();
  const shared = useMemo(() => createEditorSectionStyles(theme), [theme]);
  const s = useMemo(() => createStyles(theme), [theme]);

  return (
    <Section>
      <View style={s.temperatureHeader}>
        <View
          style={{
            ...shared.sectionTitleGroup,
            flexDirection: "column",
          }}
        >
          <View
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 4,
            }}
          >
            <Thermometer color={theme.text} size={18} />
            <Text style={shared.sectionTitle}>Temperature</Text>
          </View>
          <Text style={s.temperatureSubtitle}>{temperature}°C target</Text>
        </View>
        <View style={s.temperatureActions}>
          <TouchableOpacity
            activeOpacity={0.75}
            accessibilityLabel="Toggle quiet mode"
            accessibilityRole="switch"
            accessibilityState={{ checked: quiet }}
            onPress={onToggleQuiet}
            style={[
              s.featureButton,
              quiet ? s.quietButtonOn : s.featureButtonOff,
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
            accessibilityState={{ checked: powerful }}
            onPress={onTogglePowerful}
            style={[
              s.featureButton,
              powerful ? s.powerfulButtonOn : s.featureButtonOff,
            ]}
          >
            <Zap
              color={powerful ? theme.powerfulAccent : theme.text}
              size={20}
              strokeWidth={2.4}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ArcTemperatureGauge
        size={280}
        temperature={temperature}
        isPowered={true}
        minTemperature={minTemperature}
        maxTemperature={maxTemperature}
        onChangeTemperature={onChangeTemperature}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
      />
    </Section>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    temperatureHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 12,
      justifyContent: "space-between",
    },
    temperatureSubtitle: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: "500",
    },
    temperatureActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    featureButton: {
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 1,
      height: 46,
      justifyContent: "center",
      width: 46,
    },
    featureButtonOff: {
      backgroundColor: theme.controlBackground,
      borderColor: theme.border,
    },
    quietButtonOn: {
      backgroundColor: theme.quietAccentMuted,
      borderColor: theme.quietAccent,
    },
    powerfulButtonOn: {
      backgroundColor: theme.powerfulAccentMuted,
      borderColor: theme.powerfulAccent,
    },
  });
