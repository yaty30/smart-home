import { CalendarFold, Repeat } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { type Theme, useTheme } from "../../theme/theme";
import type { ScheduleRepeatFrequency } from "../../types/acSchedule";
import { Section } from "../Section";
import { createEditorSectionStyles } from "./editorSectionStyles";
import {
  DAY_FULL,
  dayGroups,
  matchDayGroup,
  repeatOptions,
} from "./scheduleConstants";

type ScheduleRepeatSectionProps = {
  days: boolean[];
  repeatFrequency: ScheduleRepeatFrequency;
  onSelectRepeatFrequency: (frequency: ScheduleRepeatFrequency) => void;
  onToggleDay: (index: number) => void;
  onSelectDayGroup: (days: boolean[]) => void;
};

export function ScheduleRepeatSection({
  days,
  repeatFrequency,
  onSelectRepeatFrequency,
  onToggleDay,
  onSelectDayGroup,
}: ScheduleRepeatSectionProps) {
  const theme = useTheme();
  const shared = useMemo(() => createEditorSectionStyles(theme), [theme]);
  const s = useMemo(() => createStyles(theme), [theme]);

  // Derived from the weekday toggles, so manual selection keeps this in sync.
  const activeDayGroup = useMemo(() => matchDayGroup(days), [days]);

  return (
    <Section>
      <View style={shared.sectionTitleGroup}>
        <Repeat color={theme.text} size={18} />
        <Text style={shared.sectionTitle}>Repeat</Text>
      </View>
      <View style={shared.pillRow}>
        {repeatOptions.map((option) => {
          const selected = repeatFrequency === option.value;

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => onSelectRepeatFrequency(option.value)}
              style={[shared.pill, selected && shared.pillSelected]}
            >
              <Text
                style={[shared.pillText, selected && shared.pillTextSelected]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View
        style={{
          ...shared.sectionTitleGroup,
          marginTop: theme.spacing.sm,
        }}
      >
        <CalendarFold color={theme.text} size={18} />
        <Text style={shared.sectionTitle}>On</Text>
      </View>
      <View style={s.daysRow}>
        {DAY_FULL.map((day, i) => (
          <TouchableOpacity
            key={day}
            style={[s.dayToggle, days[i] === true && s.dayToggleActive]}
            onPress={() => onToggleDay(i)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                s.dayToggleText,
                days[i] === true && s.dayToggleTextActive,
              ]}
            >
              {day}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.dayGroupRow}>
        {dayGroups.map((group) => {
          const selected = activeDayGroup === group.id;

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={group.id}
              onPress={() => onSelectDayGroup(group.days)}
              style={[s.dayGroupButton, selected && s.dayGroupButtonSelected]}
            >
              <Text
                style={[s.dayGroupText, selected && s.dayGroupTextSelected]}
              >
                {group.label}
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
    daysRow: {
      flexDirection: "row",
      gap: 6,
      flexWrap: "wrap",
    },
    dayToggle: {
      alignItems: "center",
      backgroundColor: theme.surfaceLow,
      borderRadius: 8,
      flex: 1,
      minWidth: 40,
      paddingVertical: 8,
    },
    dayToggleActive: {
      backgroundColor: theme.accent,
    },
    dayToggleText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "500",
    },
    dayToggleTextActive: {
      color: "#fff",
    },
    dayGroupRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    dayGroupButton: {
      alignItems: "center",
      backgroundColor: theme.surfaceLow,
      borderColor: theme.accentMuted,
      borderRadius: theme.radiusRound,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 40,
      paddingHorizontal: 6,
      paddingVertical: 8,
    },
    dayGroupButtonSelected: {
      borderColor: theme.accentSolid,
    },
    dayGroupText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "800",
      textAlign: "center",
    },
    dayGroupTextSelected: {
      color: theme.accentStrong,
    },
  });
