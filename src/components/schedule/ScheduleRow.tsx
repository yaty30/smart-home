import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ChevronDown,
  Clock,
  DraftingCompass,
  Fan,
  Moon,
  Repeat,
  Zap,
} from "lucide-react-native";
import {
  cloneElement,
  isValidElement,
  useMemo,
  type ReactElement,
} from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

import { type Theme, useTheme } from "../../theme/theme";
import type { AcSchedule } from "../../types/acSchedule";
import { formatTime12h } from "../../utils/timeFormat";
import {
  horizontalAirflowOptions,
  verticalAirflowOptions,
} from "../AirflowSelectors";
import {
  DAY_LABELS,
  formatRepeat,
  scheduleTypeLabels,
} from "./scheduleConstants";
import { modeOptions } from "./scheduleModeOptions";

type ScheduleRowProps = {
  schedule: AcSchedule;
  onToggleEnabled: (enabled: boolean) => void;
};

export function ScheduleRow({ schedule, onToggleEnabled }: ScheduleRowProps) {
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const modeOpts = useMemo(() => modeOptions(theme), [theme]);
  const verticalAirflowOption = verticalAirflowOptions.find(
    (option) => option.id === schedule.verticalAirflow,
  );
  const horizontalAirflowOption = horizontalAirflowOptions.find(
    (option) => option.id === schedule.horizontalAirflow,
  );
  const VerticalAirflowIcon = verticalAirflowOption?.icon;
  const HorizontalAirflowIcon = horizontalAirflowOption?.icon;

  const modeIcon = modeOpts?.find((m) => m.id === schedule.mode)?.icon ?? null;

  return (
    <View
      style={{
        ...s.row,
        borderColor: schedule.enabled ? theme.accent : theme.accentMuted,
      }}
    >
      <View style={s.rowLeft}>
        <View style={s.rowTimes}>
          <Clock size={14} color={theme.textSecondary} />
          {schedule.startTime !== null && (
            <>
              <Text style={s.rowTimeLabel}>On</Text>
              <Text style={s.rowTimeText}>
                {formatTime12h(schedule.startTime)}
              </Text>
            </>
          )}
          {schedule.startTime !== null && schedule.endTime !== null && (
            <ChevronDown
              size={12}
              color={theme.textSecondary}
              style={{ transform: [{ rotate: "-90deg" }] }}
            />
          )}
          {schedule.endTime !== null && (
            <>
              <Text style={s.rowTimeLabel}>Off</Text>
              <Text style={s.rowTimeText}>
                {formatTime12h(schedule.endTime)}
              </Text>
            </>
          )}
        </View>
        <View style={s.dayPills}>
          {DAY_LABELS.map((label, i) => (
            <View
              key={`day-${i}`}
              style={[s.dayPill, schedule.days[i] === true && s.dayPillActive]}
            >
              <Text
                style={[
                  s.dayPillText,
                  schedule.days[i] === true && s.dayPillTextActive,
                ]}
              >
                {label}
              </Text>
            </View>
          ))}

          <View style={{ ...s.rowDetailPill, marginLeft: theme.spacing.xs }}>
            <Repeat size={16} color={theme.accentGlow} />
            <Text style={s.rowDetailText}>{formatRepeat(schedule)}</Text>
          </View>
        </View>

        <View style={s.rowMeta}>
          <View style={s.rowDetailPill}>
            <Text style={s.rowDetailText}>
              {scheduleTypeLabels[schedule.type]}
            </Text>
          </View>
        </View>

        {schedule.type !== "auto_off" && schedule.startTime !== null && (
          <View style={s.rowDetails}>
            <View style={s.rowDetailPill}>
              {isValidElement(modeIcon)
                ? cloneElement(modeIcon as ReactElement<{ size?: number }>, {
                    size: 14,
                  })
                : null}
              <Text
                style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}
              >
                {schedule.temperature} °C
              </Text>
            </View>
            <View style={s.rowDetailPill}>
              <View style={s.rowDetailInline}>
                <View style={s.rowDetailIconFrame}>
                  <Fan size={16} color={theme.accentGlow} />
                </View>

                {schedule.fanSpeed === undefined ||
                schedule.fanSpeed === "auto" ? (
                  <Text
                    style={{ ...s.rowDetailText, marginLeft: theme.spacing.xs }}
                  >
                    Auto
                  </Text>
                ) : (
                  <View style={s.rowDetailIconFrame}>
                    <MaterialCommunityIcons
                      color={theme.accent}
                      name={`numeric-${schedule.fanSpeed}`}
                      size={20}
                      style={s.rowDetailNumericIcon}
                    />
                  </View>
                )}
              </View>
            </View>
            <View style={s.rowDetailPill}>
              <View
                style={{
                  transform: [{ rotate: "-63.5deg" }, { translateX: 1 }],
                }}
              >
                <DraftingCompass color={theme.accentGlow} size={16} />
              </View>
              {VerticalAirflowIcon ? (
                <View
                  style={{
                    transform: [
                      {
                        rotate: `${verticalAirflowOption?.iconRotation ?? 0}deg`,
                      },
                    ],
                  }}
                >
                  <VerticalAirflowIcon
                    color={theme.accent}
                    size={16}
                    strokeWidth={2.2}
                  />
                </View>
              ) : (
                <Text style={s.rowDetailText}>Auto</Text>
              )}
            </View>

            <View style={s.rowDetailPill}>
              <View style={{ transform: [{ rotate: "0deg" }] }}>
                <DraftingCompass size={16} color={theme.accentGlow} />
              </View>
              {HorizontalAirflowIcon ? (
                <View
                  style={{
                    transform: [
                      {
                        rotate: `${horizontalAirflowOption?.iconRotation ?? 0}deg`,
                      },
                    ],
                  }}
                >
                  <HorizontalAirflowIcon
                    color={theme.accent}
                    size={16}
                    strokeWidth={2.2}
                  />
                </View>
              ) : (
                <Text style={s.rowDetailText}>Auto</Text>
              )}
            </View>

            {schedule.powerful ? (
              <View style={s.rowDetailPill}>
                <Zap size={16} color={theme.powerfulAccent} />
              </View>
            ) : schedule.quiet ? (
              <View style={s.rowDetailPill}>
                <Moon size={16} color={theme.quietAccent} />
              </View>
            ) : null}
          </View>
        )}
      </View>
      <Switch
        value={schedule.enabled}
        onValueChange={onToggleEnabled}
        trackColor={{ false: theme.border, true: theme.accent }}
        thumbColor={theme.paperBackground}
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      alignItems: "center",
      backgroundColor: theme.surfaceLow,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    rowLeft: {
      flex: 1,
      gap: theme.spacing.lg,
      minWidth: 0,
    },
    rowTimes: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    rowTimeText: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "500",
    },
    rowTimeLabel: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },
    dayPills: {
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
    },
    dayPill: {
      alignItems: "center",
      borderRadius: 4,
      height: 22,
      justifyContent: "center",
      width: 22,
    },
    dayPillActive: {
      backgroundColor: theme.accent,
    },
    dayPillText: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "500",
    },
    dayPillTextActive: {
      color: theme.textHighlight,
    },
    rowDetails: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    rowMeta: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    rowDetailPill: {
      alignItems: "center",
      backgroundColor: theme.paperBackground,
      borderColor: theme.border,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 4,
      justifyContent: "center",
      minHeight: 30,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 5,
    },
    rowDetailText: {
      color: theme.text,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 14,
    },
    rowDetailInline: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
    },
    rowDetailIconFrame: {
      alignItems: "center",
      height: 20,
      justifyContent: "center",
      width: 20,
    },
    rowDetailNumericIcon: {
      height: 20,
      lineHeight: 20,
      textAlign: "center",
    },
  });
