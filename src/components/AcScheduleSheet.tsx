import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import {
  Blend,
  CalendarFold,
  ChevronDown,
  Clock,
  Fan,
  Moon,
  Plus,
  Repeat,
  Thermometer,
  X,
  Zap,
  DraftingCompass,
} from "lucide-react-native";
import { MODE_ICONS, TEMPERATURE_RANGES } from "../constants/acModes";
import { useSheetDismiss } from "../hooks/useSheetDismiss";
import {
  addMinutesToTimeString,
  dateFromTimeString,
  formatTime12h,
  timeStringFromDate,
} from "../utils/timeFormat";
import {
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  horizontalAirflowOptions,
  HorizontalAirflowSelector,
  verticalAirflowOptions,
  VerticalAirflowSelector,
} from "./AirflowSelectors";
import { AppButton } from "./AppButton";
import { ArcTemperatureGauge } from "./ArcTemperatureGauge";
import { FanSpeedControl } from "./FanSpeedControl";
import { Section } from "./Section";
import { SwipeableItem } from "./SwipeableItem";
import { type Theme, useTheme } from "../theme/theme";
import type { AcSchedule, ScheduleRepeatFrequency } from "../types/acSchedule";
import type {
  AirConditionerMode,
  AirflowLevel,
  FanSpeed,
} from "../types/airConditioner";
import { normalizeTemperature } from "../utils/temperatureGauge";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type TimeField = "start" | "end";

const NO_DAYS: boolean[] = [false, false, false, false, false, false, false];
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Day groups, indexed Mon–Sun (0–6) so weekday numbers read 1–7.
type DayGroupId = "all" | "working" | "odd" | "even";

const daysFromIndices = (indices: number[]): boolean[] =>
  NO_DAYS.map((_, i) => indices.includes(i));

const dayGroups: { id: DayGroupId; label: string; days: boolean[] }[] = [
  {
    id: "all",
    label: "All days",
    days: daysFromIndices([0, 1, 2, 3, 4, 5, 6]),
  },
  {
    id: "working",
    label: "Working days",
    days: daysFromIndices([0, 1, 2, 3, 4]),
  },
  { id: "odd", label: "Odd days", days: daysFromIndices([0, 2, 4, 6]) },
  { id: "even", label: "Even days", days: daysFromIndices([1, 3, 5]) },
];

// Exact match only — Mon–Fri plus Sunday matches no group.
const matchDayGroup = (days: boolean[]): DayGroupId | null =>
  dayGroups.find((group) =>
    group.days.every((selected, i) => selected === (days[i] === true)),
  )?.id ?? null;

const DEFAULT_START_TIME = "22:30";

const defaultSchedule: AcSchedule = {
  enabled: true,
  startTime: DEFAULT_START_TIME,
  endTime: null,
  days: [...NO_DAYS],
  mode: "cold",
  temperature: 24,
  fanSpeed: "auto",
  quiet: false,
  powerful: false,
  repeatEnabled: false,
  repeatFrequency: "one-time",
  horizontalAirflow: "auto",
  verticalAirflow: "auto",
};

const repeatOptions: { label: string; value: ScheduleRepeatFrequency }[] = [
  { label: "One time", value: "one-time" },
  { label: "Weekly", value: "weekly" },
  { label: "Bi-weekly", value: "bi-weekly" },
];

const modeStyles = {
  opacity: 0.86,
};

const MODE_OPTION_IDS: Exclude<AirConditionerMode, "fan">[] = [
  "auto",
  "cold",
  "dry",
  "heat",
];

const modeOptions = (
  theme: Theme,
): {
  id: Exclude<AirConditionerMode, "fan">;
  label: string;
  icon: ReactNode;
}[] => {
  const icons = MODE_ICONS(theme);

  return MODE_OPTION_IDS.map((id) => {
    const { color, icon: Icon, label } = icons[id];

    return {
      id,
      label,
      icon: <Icon style={modeStyles} size={18} color={color} />,
    };
  });
};

const repeatLabels: Record<ScheduleRepeatFrequency, string> = {
  "one-time": "One time",
  weekly: "Weekly",
  "bi-weekly": "Bi-weekly",
};

// Field-by-field so a draft that only differs by object identity is not dirty.
const isSameSchedule = (a: AcSchedule, b: AcSchedule) =>
  a.enabled === b.enabled &&
  a.startTime === b.startTime &&
  a.endTime === b.endTime &&
  a.mode === b.mode &&
  a.temperature === b.temperature &&
  (a.fanSpeed ?? "auto") === (b.fanSpeed ?? "auto") &&
  Boolean(a.quiet) === Boolean(b.quiet) &&
  Boolean(a.powerful) === Boolean(b.powerful) &&
  Boolean(a.repeatEnabled) === Boolean(b.repeatEnabled) &&
  (a.repeatFrequency ?? "one-time") === (b.repeatFrequency ?? "one-time") &&
  a.horizontalAirflow === b.horizontalAirflow &&
  a.verticalAirflow === b.verticalAirflow &&
  NO_DAYS.every((_, i) => (a.days[i] === true) === (b.days[i] === true));

const formatRepeat = (schedule: AcSchedule) =>
  schedule.repeatEnabled
    ? repeatLabels[schedule.repeatFrequency ?? "weekly"]
    : repeatLabels["one-time"];

// ─── ScheduleRow ─────────────────────────────────────────────────────────────

type ScheduleRowProps = {
  schedule: AcSchedule;
  onToggleEnabled: (enabled: boolean) => void;
};

function ScheduleRow({ schedule, onToggleEnabled }: ScheduleRowProps) {
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

        {schedule.startTime !== null && (
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // shared sheet chrome
    modalRoot: {
      flex: 1,
    },
    backdrop: {
      backgroundColor: theme.overlays.modalBackdrop,
    },
    kavFill: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: theme.paperBackground,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      height: "90%",
      maxHeight: "92%",
      shadowColor: theme.shadows.color,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 16,
    },
    safeArea: {
      flex: 1,
    },
    handleArea: {
      alignItems: "center",
      height: 28,
      justifyContent: "center",
    },
    handle: {
      backgroundColor: theme.border,
      borderRadius: 3,
      height: 4,
      width: 40,
    },
    contentOuter: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 24,
      paddingHorizontal: 20,
      gap: theme.spacing.lg,
    },
    footer: {
      borderTopColor: theme.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      padding: 16,
    },

    // list sheet
    listHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
      marginTop: 4,
    },
    sheetTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "600",
    },
    addButton: {
      alignItems: "center",
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    emptyText: {
      color: theme.textSecondary,
      fontSize: 14,
      textAlign: "center",
      paddingVertical: 32,
    },

    // schedule row
    scheduleSwipeItem: {
      borderRadius: 12,
    },
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
    rowTimeTextMuted: {
      color: theme.textSecondary,
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
    rowDetailLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
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

    // editor sheet
    editorTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "600",
    },
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
    repeatButtonRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    repeatButton: {
      alignItems: "center",
      backgroundColor: theme.surfaceLow,
      borderColor: theme.accentMuted,
      borderRadius: theme.radiusRound,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 8,
      paddingVertical: 12,
    },
    repeatButtonSelected: {
      borderColor: theme.accentSolid,
    },
    repeatButtonText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
      textAlign: "center",
    },
    repeatButtonTextSelected: {
      color: theme.accentStrong,
    },
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
    temperatureHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 12,
      justifyContent: "space-between",
    },
    temperatureTitleGroup: {
      flex: 1,
      gap: 4,
      minWidth: 0,
      flexDirection: "row",
    },
    temperatureTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "800",
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

// ─── AcScheduleSheet (list sheet) ────────────────────────────────────────────

export type AcScheduleSheetProps = {
  visible: boolean;
  loading: boolean;
  schedule: AcSchedule | null;
  onClose: () => void;
  onDeleteSchedule: () => Promise<void>;
  onSaveSchedule: (schedule: AcSchedule) => Promise<void>;
  onToggleScheduleEnabled: (enabled: boolean) => Promise<void>;
};

export function AcScheduleSheet({
  visible,
  loading,
  schedule,
  onClose,
  onDeleteSchedule,
  onSaveSchedule,
  onToggleScheduleEnabled,
}: AcScheduleSheetProps) {
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const translateY = useRef(new Animated.Value(800)).current;
  const handleCloseRef = useRef(onClose);
  const [editorVisible, setEditorVisible] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    handleCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (visible && !editorVisible) {
      // Reset before animating so re-opens always start from the bottom.
      translateY.setValue(800);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        useNativeDriver: false,
      }).start();
    }
  }, [editorVisible, visible, translateY]);

  useEffect(() => {
    if (!visible) {
      setEditorVisible(false);
    }
  }, [visible]);

  const dismiss = useCallback(() => {
    Animated.timing(translateY, {
      toValue: 900,
      duration: 260,
      useNativeDriver: false,
    }).start(() => handleCloseRef.current());
  }, [translateY]);

  const dismissRef = useRef(dismiss);
  useEffect(() => {
    dismissRef.current = dismiss;
  }, [dismiss]);

  const { scrollAtTop, handlePan } = useSheetDismiss(translateY, dismissRef);

  const handleSave = useCallback(
    async (draft: AcSchedule) => {
      setSaving(true);
      try {
        await onSaveSchedule(draft);
        setEditorVisible(false);
      } finally {
        setSaving(false);
      }
    },
    [onSaveSchedule],
  );

  return (
    <>
      <Modal
        visible={visible && !editorVisible}
        transparent
        animationType="none"
        onRequestClose={dismiss}
      >
        <View style={s.modalRoot}>
          <TouchableOpacity
            style={[StyleSheet.absoluteFill, s.backdrop]}
            activeOpacity={1}
            onPress={dismiss}
          />
          <KeyboardAvoidingView
            style={s.kavFill}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            pointerEvents="box-none"
          >
            <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
              <SafeAreaView style={s.safeArea}>
                <View style={s.handleArea} {...handlePan.panHandlers}>
                  <View style={s.handle} />
                </View>

                <View style={s.contentOuter}>
                  <ScrollView
                    style={s.scroll}
                    contentContainerStyle={s.scrollContent}
                    scrollEnabled={scrollEnabled}
                    onScroll={({ nativeEvent }) => {
                      scrollAtTop.current = nativeEvent.contentOffset.y <= 0;
                    }}
                    scrollEventThrottle={16}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={s.listHeader}>
                      <Text style={s.sheetTitle}>Schedule</Text>
                      <TouchableOpacity
                        style={s.addButton}
                        onPress={() => setEditorVisible(true)}
                        activeOpacity={0.7}
                      >
                        <Plus size={20} color={theme.accent} />
                      </TouchableOpacity>
                    </View>

                    {loading && <Text style={s.emptyText}>Loading…</Text>}

                    {!loading && schedule === null && (
                      <Text style={s.emptyText}>
                        No schedule set. Tap + to create one.
                      </Text>
                    )}

                    {!loading && schedule !== null && (
                      <SwipeableItem
                        onDelete={() => {
                          void onDeleteSchedule();
                        }}
                        onPress={() => setEditorVisible(true)}
                        onSwipeEnd={() => setScrollEnabled(true)}
                        onSwipeStart={() => setScrollEnabled(false)}
                        style={s.scheduleSwipeItem}
                        contentBackground={theme.paperBackground}
                      >
                        <ScheduleRow
                          schedule={schedule}
                          onToggleEnabled={onToggleScheduleEnabled}
                        />
                      </SwipeableItem>
                    )}
                  </ScrollView>
                </View>
              </SafeAreaView>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ScheduleEditorSheet
        visible={visible && editorVisible}
        initial={schedule ?? defaultSchedule}
        saving={saving}
        onClose={() => setEditorVisible(false)}
        onSave={handleSave}
      />
    </>
  );
}

// ─── ScheduleEditorSheet ──────────────────────────────────────────────────────

type ScheduleEditorSheetProps = {
  visible: boolean;
  initial: AcSchedule;
  saving: boolean;
  onClose: () => void;
  onSave: (schedule: AcSchedule) => void;
};

function ScheduleEditorSheet({
  visible,
  initial,
  saving,
  onClose,
  onSave,
}: ScheduleEditorSheetProps) {
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const modeOpts = useMemo(() => modeOptions(theme), [theme]);
  const translateY = useRef(new Animated.Value(800)).current;
  const handleCloseRef = useRef(onClose);
  useEffect(() => {
    handleCloseRef.current = onClose;
  }, [onClose]);

  // open / close animation
  useEffect(() => {
    if (visible) {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        useNativeDriver: false,
      }).start();
    }
  }, [visible, translateY]);

  // Draft state: a copy of the persisted schedule that only the Save button
  // commits. `initial` is re-read on open so a dismissed draft is discarded.
  const [draft, setDraft] = useState<AcSchedule>(initial);
  const [baseline, setBaseline] = useState<AcSchedule>(initial);
  const [activeTimePicker, setActiveTimePicker] = useState<TimeField>("start");
  const [isAdjustingTemperature, setIsAdjustingTemperature] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraft(initial);
    setBaseline(initial);
    setActiveTimePicker(initial.startTime === null ? "end" : "start");
  }, [visible, initial]);

  const isDirty = useMemo(
    () => !isSameSchedule(draft, baseline),
    [draft, baseline],
  );

  const closeSheet = useCallback(() => {
    Animated.timing(translateY, {
      toValue: 900,
      duration: 260,
      useNativeDriver: false,
    }).start(() => handleCloseRef.current());
  }, [translateY]);

  const closeSheetRef = useRef(closeSheet);
  useEffect(() => {
    closeSheetRef.current = closeSheet;
  }, [closeSheet]);

  // Every dismissal path routes through here so an unsaved draft always asks.
  const dismiss = useCallback(() => {
    if (!isDirty) {
      closeSheetRef.current();
      return;
    }

    Alert.alert(
      "Unsaved changes",
      "This schedule has changes that haven't been saved. Discard them?",
      [
        { text: "Keep Editing", style: "cancel" },
        {
          text: "Discard Changes",
          style: "destructive",
          onPress: () => closeSheetRef.current(),
        },
      ],
    );
  }, [isDirty]);

  const dismissRef = useRef(dismiss);
  useEffect(() => {
    dismissRef.current = dismiss;
  }, [dismiss]);

  const { scrollAtTop, handlePan, contentPan } = useSheetDismiss(
    translateY,
    dismissRef,
  );

  const handleTimeChange = useCallback(
    (_: DateTimePickerEvent, date?: Date) => {
      if (!date) return;
      const key = activeTimePicker === "start" ? "startTime" : "endTime";
      setDraft((prev) => ({ ...prev, [key]: timeStringFromDate(date) }));
    },
    [activeTimePicker],
  );

  const handleSelectStartTime = useCallback(() => {
    setActiveTimePicker("start");
    setDraft((prev) => ({
      ...prev,
      startTime:
        prev.startTime ??
        (prev.endTime === null
          ? DEFAULT_START_TIME
          : addMinutesToTimeString(prev.endTime, -60)),
    }));
  }, []);

  const handleSelectEndTime = useCallback(() => {
    setActiveTimePicker("end");
    setDraft((prev) => ({
      ...prev,
      endTime:
        prev.endTime ??
        (prev.startTime === null
          ? DEFAULT_START_TIME
          : addMinutesToTimeString(prev.startTime, 60)),
    }));
  }, []);

  // A schedule needs at least one time, so clearing one requires the other.
  const handleClearStartTime = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    setActiveTimePicker("end");
    setDraft((prev) => ({ ...prev, startTime: null }));
  }, []);

  const handleClearEndTime = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    setActiveTimePicker("start");
    setDraft((prev) => ({ ...prev, endTime: null }));
  }, []);

  const handleToggleQuiet = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    setDraft((prev) => {
      const quiet = !Boolean(prev.quiet);
      return {
        ...prev,
        quiet,
        powerful: quiet ? false : prev.powerful,
      };
    });
  }, []);

  const handleTogglePowerful = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    setDraft((prev) => {
      const powerful = !Boolean(prev.powerful);
      return {
        ...prev,
        powerful,
        quiet: powerful ? false : prev.quiet,
      };
    });
  }, []);

  const toggleDay = useCallback((i: number) => {
    Haptics.selectionAsync().catch(() => undefined);
    setDraft((prev) => {
      const days = [...prev.days];
      days[i] = !days[i];
      return { ...prev, days };
    });
  }, []);

  const handleSelectDayGroup = useCallback((days: boolean[]) => {
    Haptics.selectionAsync().catch(() => undefined);
    setDraft((prev) => ({ ...prev, days: [...days] }));
  }, []);

  // Derived from the weekday toggles, so manual selection keeps this in sync.
  const activeDayGroup = useMemo(() => matchDayGroup(draft.days), [draft.days]);

  const hasAnyTime = draft.startTime !== null || draft.endTime !== null;

  const handleSelectRepeatFrequency = useCallback(
    (repeatFrequency: ScheduleRepeatFrequency) => {
      Haptics.selectionAsync().catch(() => undefined);
      setDraft((prev) => ({
        ...prev,
        repeatEnabled: repeatFrequency !== "one-time",
        repeatFrequency,
      }));
    },
    [],
  );

  const tempRange = useMemo(
    () => TEMPERATURE_RANGES[draft.mode] ?? TEMPERATURE_RANGES.auto,
    [draft.mode],
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={dismiss}
    >
      <View style={s.modalRoot}>
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, s.backdrop]}
          activeOpacity={1}
          onPress={dismiss}
        />
        <KeyboardAvoidingView
          style={s.kavFill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
        >
          <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
            <SafeAreaView style={s.safeArea}>
              {/* drag handle */}
              <View style={s.handleArea} {...handlePan.panHandlers}>
                <View style={s.handle} />
              </View>

              {/* scrollable content */}
              <View
                style={s.contentOuter}
                {...(isAdjustingTemperature ? {} : contentPan.panHandlers)}
              >
                <ScrollView
                  style={s.scroll}
                  contentContainerStyle={s.scrollContent}
                  keyboardShouldPersistTaps="handled"
                  onScroll={({ nativeEvent }) => {
                    scrollAtTop.current = nativeEvent.contentOffset.y <= 0;
                  }}
                  scrollEnabled={!isAdjustingTemperature}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={s.editorTitle}>AC Schedule</Text>

                  {/* ── Time ── */}
                  <Section>
                    <View style={s.timeRow}>
                      <TouchableOpacity
                        style={[
                          s.timeButton,
                          activeTimePicker === "start" && s.timeButtonActive,
                        ]}
                        onPress={handleSelectStartTime}
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
                            draft.startTime === null && s.timeValueMuted,
                          ]}
                        >
                          {draft.startTime === null
                            ? "No auto on"
                            : formatTime12h(draft.startTime)}
                        </Text>
                      </TouchableOpacity>

                      <ChevronDown
                        size={16}
                        color={theme.textSecondary}
                        style={{ transform: [{ rotate: "-90deg" }] }}
                      />

                      <TouchableOpacity
                        style={[
                          s.timeButton,
                          activeTimePicker === "end" && s.timeButtonActive,
                        ]}
                        onPress={handleSelectEndTime}
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
                            draft.endTime === null && s.timeValueMuted,
                          ]}
                        >
                          {draft.endTime === null
                            ? "No auto off"
                            : formatTime12h(draft.endTime)}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={s.clearTimeRow}>
                      <TouchableOpacity
                        activeOpacity={0.72}
                        accessibilityLabel="Clear turn on time"
                        accessibilityRole="button"
                        onPress={handleClearStartTime}
                        style={s.clearEndButton}
                      >
                        <X
                          color={theme.textSecondary}
                          size={15}
                          strokeWidth={2.4}
                        />
                        <Text style={s.clearEndText}>Clear turn on</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.72}
                        accessibilityLabel="Clear turn off time"
                        accessibilityRole="button"
                        onPress={handleClearEndTime}
                        style={s.clearEndButton}
                      >
                        <X
                          color={theme.textSecondary}
                          size={15}
                          strokeWidth={2.4}
                        />
                        <Text style={s.clearEndText}>Clear turn off</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={s.timePickerWrapper}>
                      <DateTimePicker
                        mode="time"
                        display="spinner"
                        value={dateFromTimeString(
                          (activeTimePicker === "start"
                            ? (draft.startTime ?? draft.endTime)
                            : (draft.endTime ?? draft.startTime)) ??
                            DEFAULT_START_TIME,
                        )}
                        onChange={handleTimeChange}
                        style={s.timePicker}
                        textColor={theme.text}
                      />
                    </View>
                  </Section>

                  <View style={{ gap: theme.spacing.lg }}>
                    {/* ── Days ── */}
                    <Section>
                      <View style={s.temperatureTitleGroup}>
                        <Repeat color={theme.text} size={18} />
                        <Text style={s.temperatureTitle}>Repeat</Text>
                      </View>
                      <View style={s.repeatButtonRow}>
                        {repeatOptions.map((option) => {
                          const selected =
                            (draft.repeatFrequency ?? "one-time") ===
                            option.value;

                          return (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              accessibilityRole="button"
                              accessibilityState={{ selected }}
                              key={option.value}
                              onPress={() =>
                                handleSelectRepeatFrequency(option.value)
                              }
                              style={[
                                s.repeatButton,
                                selected && s.repeatButtonSelected,
                              ]}
                            >
                              <Text
                                style={[
                                  s.repeatButtonText,
                                  selected && s.repeatButtonTextSelected,
                                ]}
                              >
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View
                        style={{
                          ...s.temperatureTitleGroup,
                          marginTop: theme.spacing.sm,
                        }}
                      >
                        <CalendarFold color={theme.text} size={18} />
                        <Text style={s.temperatureTitle}>On</Text>
                      </View>
                      <View style={s.daysRow}>
                        {DAY_FULL.map((day, i) => (
                          <TouchableOpacity
                            key={day}
                            style={[
                              s.dayToggle,
                              draft.days[i] === true && s.dayToggleActive,
                            ]}
                            onPress={() => toggleDay(i)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                s.dayToggleText,
                                draft.days[i] === true && s.dayToggleTextActive,
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
                              onPress={() => handleSelectDayGroup(group.days)}
                              style={[
                                s.dayGroupButton,
                                selected && s.dayGroupButtonSelected,
                              ]}
                            >
                              <Text
                                style={[
                                  s.dayGroupText,
                                  selected && s.dayGroupTextSelected,
                                ]}
                              >
                                {group.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </Section>

                    {/* ── Mode ── */}
                    <Section>
                      <View style={s.temperatureTitleGroup}>
                        <Blend color={theme.text} size={18} />
                        <Text style={s.temperatureTitle}>Mode</Text>
                      </View>
                      <View style={s.modePillRow}>
                        {modeOpts.map((modeOption) => {
                          const selected = draft.mode === modeOption.id;

                          return (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              accessibilityRole="button"
                              accessibilityState={{ selected }}
                              key={modeOption.id}
                              onPress={() => {
                                const nextRange =
                                  TEMPERATURE_RANGES[modeOption.id];

                                setDraft((prev) => ({
                                  ...prev,
                                  mode: modeOption.id,
                                  temperature: Math.min(
                                    Math.max(prev.temperature, nextRange.min),
                                    nextRange.max,
                                  ),
                                }));
                              }}
                              style={[
                                s.modePill,
                                selected && s.modePillSelected,
                              ]}
                            >
                              {modeOption.icon}
                              <Text
                                style={[
                                  s.modePillText,
                                  selected && s.modePillTextSelected,
                                ]}
                              >
                                {modeOption.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </Section>

                    {/* ── Temperature ── */}
                    <Section>
                      <View style={s.temperatureHeader}>
                        <View
                          style={{
                            ...s.temperatureTitleGroup,
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
                            <Text style={s.temperatureTitle}>Temperature</Text>
                          </View>
                          <Text style={s.temperatureSubtitle}>
                            {draft.temperature}°C target
                          </Text>
                        </View>
                        <View style={s.temperatureActions}>
                          <TouchableOpacity
                            activeOpacity={0.75}
                            accessibilityLabel="Toggle quiet mode"
                            accessibilityRole="switch"
                            accessibilityState={{
                              checked: Boolean(draft.quiet),
                            }}
                            onPress={handleToggleQuiet}
                            style={[
                              s.featureButton,
                              draft.quiet
                                ? s.quietButtonOn
                                : s.featureButtonOff,
                            ]}
                          >
                            <Moon
                              color={
                                draft.quiet ? theme.quietAccent : theme.text
                              }
                              size={20}
                              strokeWidth={2.4}
                            />
                          </TouchableOpacity>

                          <TouchableOpacity
                            activeOpacity={0.75}
                            accessibilityLabel="Toggle powerful mode"
                            accessibilityRole="switch"
                            accessibilityState={{
                              checked: Boolean(draft.powerful),
                            }}
                            onPress={handleTogglePowerful}
                            style={[
                              s.featureButton,
                              draft.powerful
                                ? s.powerfulButtonOn
                                : s.featureButtonOff,
                            ]}
                          >
                            <Zap
                              color={
                                draft.powerful
                                  ? theme.powerfulAccent
                                  : theme.text
                              }
                              size={20}
                              strokeWidth={2.4}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <ArcTemperatureGauge
                        size={280}
                        temperature={draft.temperature}
                        isPowered={true}
                        minTemperature={tempRange.min}
                        maxTemperature={tempRange.max}
                        onChangeTemperature={(t) =>
                          setDraft((prev) => ({
                            ...prev,
                            temperature: normalizeTemperature(
                              t,
                              tempRange.min,
                              tempRange.max,
                            ),
                          }))
                        }
                        onInteractionStart={() => {
                          setIsAdjustingTemperature(true);
                        }}
                        onInteractionEnd={() =>
                          setIsAdjustingTemperature(false)
                        }
                      />
                    </Section>

                    {/* ── Fan Speed ── */}
                    <Section>
                      <FanSpeedControl
                        isAuto={(draft.fanSpeed ?? "auto") === "auto"}
                        isPowered={true}
                        onChangeAuto={(auto) => {
                          if (!auto) return;
                          setDraft((prev) => ({ ...prev, fanSpeed: "auto" }));
                        }}
                        onChangeSpeed={(speed) => {
                          setDraft((prev) => ({ ...prev, fanSpeed: speed }));
                        }}
                        speed={
                          draft.fanSpeed === undefined ||
                          draft.fanSpeed === "auto"
                            ? (3 as FanSpeed)
                            : draft.fanSpeed
                        }
                      />
                    </Section>

                    {/* ── Airflow ── */}
                    <Section>
                      <VerticalAirflowSelector
                        selectedLevel={
                          draft.verticalAirflow === "auto"
                            ? "one"
                            : (draft.verticalAirflow as AirflowLevel)
                        }
                        isAuto={draft.verticalAirflow === "auto"}
                        isPowered={true}
                        onChangeAuto={(auto) => {
                          setDraft((prev) => ({
                            ...prev,
                            verticalAirflow: auto ? "auto" : "one",
                          }));
                        }}
                        onChangeLevel={(level) => {
                          setDraft((prev) => ({
                            ...prev,
                            verticalAirflow: level as AirflowLevel,
                          }));
                        }}
                      />
                    </Section>

                    <Section>
                      <HorizontalAirflowSelector
                        selectedLevel={
                          draft.horizontalAirflow === "auto"
                            ? "one"
                            : (draft.horizontalAirflow as AirflowLevel)
                        }
                        isAuto={draft.horizontalAirflow === "auto"}
                        isPowered={true}
                        onChangeAuto={(auto) => {
                          setDraft((prev) => ({
                            ...prev,
                            horizontalAirflow: auto ? "auto" : "one",
                          }));
                        }}
                        onChangeLevel={(level) => {
                          setDraft((prev) => ({
                            ...prev,
                            horizontalAirflow: level as AirflowLevel,
                          }));
                        }}
                      />
                    </Section>
                  </View>
                </ScrollView>
              </View>

              {/* footer */}
              <View style={s.footer}>
                <AppButton
                  label={saving ? "Saving…" : "Save Schedule"}
                  onPress={() => onSave(draft)}
                  disabled={saving || !hasAnyTime}
                />
              </View>
            </SafeAreaView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
