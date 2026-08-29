import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { ChevronDown, X } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { type Theme, useTheme } from "../../theme/theme";
import { dateFromTimeString, formatTime12h } from "../../utils/timeFormat";
import { Section } from "../Section";
import { DEFAULT_START_TIME, type TimeField } from "./scheduleConstants";

type ScheduleTimeSectionProps = {
  activeTimePicker: TimeField;
  startTime: string | null;
  endTime: string | null;
  onSelectStartTime: () => void;
  onSelectEndTime: () => void;
  onClearStartTime: () => void;
  onClearEndTime: () => void;
  onTimeChange: (event: DateTimePickerEvent, date?: Date) => void;
};

export function ScheduleTimeSection({
  activeTimePicker,
  startTime,
  endTime,
  onSelectStartTime,
  onSelectEndTime,
  onClearStartTime,
  onClearEndTime,
  onTimeChange,
}: ScheduleTimeSectionProps) {
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);

  return (
    <Section>
      <View style={s.timeRow}>
        <TouchableOpacity
          style={[
            s.timeButton,
            activeTimePicker === "start" && s.timeButtonActive,
          ]}
          onPress={onSelectStartTime}
          activeOpacity={0.7}
        >
          <Text
            style={[
              s.timeLabel,
              activeTimePicker === "start" && s.timeLabelActive,
            ]}
          >
            Turn On
            <Text style={s.timeLabelOptional}> Optional</Text>
          </Text>
          <Text
            style={[
              s.timeValue,
              activeTimePicker === "start" && s.timeValueActive,
              startTime === null && s.timeValueMuted,
            ]}
          >
            {startTime === null ? "No auto on" : formatTime12h(startTime)}
          </Text>
        </TouchableOpacity>

        <ChevronDown
          size={16}
          color={theme.textSecondary}
          style={{ transform: [{ rotate: "-90deg" }] }}
        />

        <TouchableOpacity
          style={[s.timeButton, activeTimePicker === "end" && s.timeButtonActive]}
          onPress={onSelectEndTime}
          activeOpacity={0.7}
        >
          <Text
            style={[
              s.timeLabel,
              activeTimePicker === "end" && s.timeLabelActive,
            ]}
          >
            Turn Off
            <Text style={s.timeLabelOptional}> Optional</Text>
          </Text>
          <Text
            style={[
              s.timeValue,
              activeTimePicker === "end" && s.timeValueActive,
              endTime === null && s.timeValueMuted,
            ]}
          >
            {endTime === null ? "No auto off" : formatTime12h(endTime)}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={s.clearTimeRow}>
        <TouchableOpacity
          activeOpacity={0.72}
          accessibilityLabel="Clear turn on time"
          accessibilityRole="button"
          onPress={onClearStartTime}
          style={s.clearEndButton}
        >
          <X color={theme.textSecondary} size={15} strokeWidth={2.4} />
          <Text style={s.clearEndText}>Clear turn on</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.72}
          accessibilityLabel="Clear turn off time"
          accessibilityRole="button"
          onPress={onClearEndTime}
          style={s.clearEndButton}
        >
          <X color={theme.textSecondary} size={15} strokeWidth={2.4} />
          <Text style={s.clearEndText}>Clear turn off</Text>
        </TouchableOpacity>
      </View>

      <View style={s.timePickerWrapper}>
        <DateTimePicker
          mode="time"
          display="spinner"
          value={dateFromTimeString(
            (activeTimePicker === "start"
              ? (startTime ?? endTime)
              : (endTime ?? startTime)) ?? DEFAULT_START_TIME,
          )}
          onChange={onTimeChange}
          style={s.timePicker}
          textColor={theme.text}
        />
      </View>
    </Section>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    timeRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      justifyContent: "center",
    },
    timeButton: {
      alignItems: "center",
      backgroundColor: theme.surfaceLow,
      borderColor: "transparent",
      borderWidth: 1,
      borderRadius: 12,
      flex: 1,
      paddingVertical: 12,
    },
    timeButtonActive: {
      backgroundColor: theme.accentMuted,
      borderColor: theme.accentSolid,
    },
    timeLabel: {
      color: theme.textSecondary,
      fontSize: 12,
      marginBottom: 4,
    },
    timeLabelActive: {
      color: theme.accentStrong,
    },
    timeLabelOptional: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "500",
    },
    timeValue: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "600",
    },
    timeValueActive: {
      color: theme.accentStrong,
    },
    timeValueMuted: {
      color: theme.textSecondary,
    },
    timePickerWrapper: {
      alignItems: "center",
      marginTop: 8,
    },
    clearTimeRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
    },
    clearEndButton: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    clearEndText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    timePicker: {
      height: 160,
      width: "100%",
    },
  });
