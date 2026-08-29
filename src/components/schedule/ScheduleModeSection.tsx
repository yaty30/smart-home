import { Blend } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { type Theme, useTheme } from "../../theme/theme";
import type { AirConditionerMode } from "../../types/airConditioner";
import { Section } from "../Section";
import { createEditorSectionStyles } from "./editorSectionStyles";
import { modeOptions } from "./scheduleModeOptions";

type ScheduleMode = Exclude<AirConditionerMode, "fan">;

type ScheduleModeSectionProps = {
  mode: ScheduleMode;
  onSelectMode: (mode: ScheduleMode) => void;
};

export function ScheduleModeSection({
  mode,
  onSelectMode,
}: ScheduleModeSectionProps) {
  const theme = useTheme();
  const shared = useMemo(() => createEditorSectionStyles(theme), [theme]);
  const s = useMemo(() => createStyles(theme), [theme]);
  const modeOpts = useMemo(() => modeOptions(theme), [theme]);

  return (
    <Section>
      <View style={shared.sectionTitleGroup}>
        <Blend color={theme.text} size={18} />
        <Text style={shared.sectionTitle}>Mode</Text>
      </View>
      <View style={shared.pillRow}>
        {modeOpts.map((modeOption) => {
          const selected = mode === modeOption.id;

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={modeOption.id}
              onPress={() => onSelectMode(modeOption.id)}
              style={[s.modePill, selected && s.modePillSelected]}
            >
              {modeOption.icon}
              <Text
                style={[s.modePillText, selected && s.modePillTextSelected]}
              >
                {modeOption.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Section>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modePill: {
      alignItems: "center",
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      borderColor: theme.accentMuted,
      borderRadius: theme.radiusRound,
      borderWidth: 1,
      flex: 1,
      flexDirection: "row",
      gap: theme.spacing.xs,
      justifyContent: "center",
      paddingVertical: 12,
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
