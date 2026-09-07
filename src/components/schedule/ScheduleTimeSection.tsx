import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { ChevronDown } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { type Theme, useTheme } from "../../theme/theme";
import type { ScheduleType } from "../../types/acSchedule";
import { dateFromTimeString, formatTime12h } from "../../utils/timeFormat";
import { Section } from "../Section";
import { DEFAULT_START_TIME, type TimeField } from "./scheduleConstants";

type ScheduleTimeSectionProps = {
  activeTimePicker: TimeField;
  scheduleType: ScheduleType;
  startTime: string | null;
  endTime: string | null;
  onSelectStartTime: () => void;
  onSelectEndTime: () => void;
  onTimeChange: (event: DateTimePickerEvent, date?: Date) => void;
};

export function ScheduleTimeSection({
  activeTimePicker,
  scheduleType,
  startTime,
  endTime,
  onSelectStartTime,
  onSelectEndTime,
  onTimeChange,
}: ScheduleTimeSectionProps) {
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const showStart = scheduleType !== "auto_off";
  const showEnd = scheduleType !== "auto_on";
  const showBothTimes = showStart && showEnd;
  const pickerTime =
    activeTimePicker === "start"
      ? (startTime ?? endTime)
      : (endTime ?? startTime);

  return (
    <Section>
      <View style={s.timeRow}>
        {showStart && (
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
              {scheduleType === "schedule_time" ? "Start" : "Turn On"}
            </Text>
            <Text
              style={[
                s.timeValue,
                activeTimePicker === "start" && s.timeValueActive,
                startTime === null && s.timeValueMuted,
              ]}
            >
              {startTime === null ? "Set time" : formatTime12h(startTime)}
            </Text>
          </TouchableOpacity>
        )}

        {showBothTimes && (
          <ChevronDown
            size={16}
            color={theme.textSecondary}
            style={{ transform: [{ rotate: "-90deg" }] }}
          />
        )}

        {showEnd && (
          <TouchableOpacity
            style={[
              s.timeButton,
              activeTimePicker === "end" && s.timeButtonActive,
            ]}
            onPress={onSelectEndTime}
            activeOpacity={0.7}
          >
            <Text
              style={[
                s.timeLabel,
                activeTimePicker === "end" && s.timeLabelActive,
              ]}
            >
              {scheduleType === "schedule_time" ? "End" : "Turn Off"}
            </Text>
            <Text
              style={[
                s.timeValue,
                activeTimePicker === "end" && s.timeValueActive,
                endTime === null && s.timeValueMuted,
              ]}
            >
              {endTime === null ? "Set time" : formatTime12h(endTime)}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.timePickerWrapper}>
        <DateTimePicker
          mode="time"
          display="spinner"
          value={dateFromTimeString(
            pickerTime ?? DEFAULT_START_TIME,
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
    timePicker: {
      height: 160,
      width: "100%",
    },
  });
