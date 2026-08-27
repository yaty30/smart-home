import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { ChevronDown, Clock, Moon, Plus, Zap } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
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
  HorizontalAirflowSelector,
  VerticalAirflowSelector,
} from "./AirflowSelectors";
import { AppButton } from "./AppButton";
import { ArcTemperatureGauge } from "./ArcTemperatureGauge";
import { ModeSelector } from "./ModeSelector";
import { Section } from "./Section";
import { theme } from "../theme/theme";
import type { AcSchedule, ScheduleAirflow } from "../types/acSchedule";
import type { AirConditionerMode, AirflowLevel } from "../types/airConditioner";
import { normalizeTemperature } from "../utils/temperatureGauge";

type TimeField = "start" | "end";

const NO_DAYS: boolean[] = [false, false, false, false, false, false, false];
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const temperatureRanges: Record<
  Exclude<AirConditionerMode, "fan">,
  { min: number; max: number }
> = {
  auto: { min: 16, max: 30 },
  cold: { min: 16, max: 26 },
  dry: { min: 16, max: 28 },
  heat: { min: 22, max: 30 },
};

const defaultSchedule: AcSchedule = {
  enabled: true,
  startTime: "22:30",
  endTime: "07:30",
  days: [...NO_DAYS],
  mode: "cold",
  temperature: 24,
  quiet: false,
  powerful: false,
  horizontalAirflow: "auto",
  verticalAirflow: "auto",
};

const formatTimePart = (value: number) => String(value).padStart(2, "0");

const formatTime12h = (time: string) => {
  const [hoursPart = "0", minutesPart = "0"] = time.split(":");
  const hours = Number(hoursPart);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(hour12).padStart(2, "0")}:${minutesPart.padStart(2, "0")} ${suffix}`;
};

const timeStringFromDate = (date: Date) =>
  `${formatTimePart(date.getHours())}:${formatTimePart(date.getMinutes())}`;

const dateFromTimeString = (time: string) => {
  const [hours = "0", minutes = "0"] = time.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date;
};

// ─── useSheetPan ──────────────────────────────────────────────────────────────
// Reusable gesture logic matching AddRoomSheet: handle area claims every touch,
// content area only activates on downward drag while at scroll top.

function useSheetPan(
  translateY: Animated.Value,
  dismissRef: React.MutableRefObject<() => void>,
) {
  const scrollAtTop = useRef(true);

  const snapBack = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0, useNativeDriver: false, bounciness: 4,
    }).start();
  }, [translateY]);

  // Stable ref so PanResponder (created once) always calls the latest snapBack.
  const snapBackRef = useRef(snapBack);
  useEffect(() => { snapBackRef.current = snapBack; }, [snapBack]);

  const handlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, { dy }) => { translateY.setValue(Math.max(0, dy)); },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 120 || vy > 0.8) { dismissRef.current(); }
        else { snapBackRef.current(); }
      },
      onPanResponderTerminate: () => { snapBackRef.current(); },
    }),
  ).current;

  const contentPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        scrollAtTop.current && dy > 10 && dy > Math.abs(dx),
      onPanResponderMove: (_, { dy }) => { translateY.setValue(Math.max(0, dy)); },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 120 || vy > 0.8) { dismissRef.current(); }
        else { snapBackRef.current(); }
      },
      onPanResponderTerminate: () => { snapBackRef.current(); },
    }),
  ).current;

  return { scrollAtTop, handlePan, contentPan };
}

// ─── ScheduleRow ─────────────────────────────────────────────────────────────

type ScheduleRowProps = {
  schedule: AcSchedule;
  onToggleEnabled: (enabled: boolean) => void;
};

function ScheduleRow({ schedule, onToggleEnabled }: ScheduleRowProps) {
  return (
    <View style={s.row}>
      <View style={s.rowLeft}>
        <View style={s.rowTimes}>
          <Clock size={14} color={theme.textSecondary} />
          <Text style={s.rowTimeText}>{formatTime12h(schedule.startTime)}</Text>
          <ChevronDown
            size={12}
            color={theme.textSecondary}
            style={{ transform: [{ rotate: "-90deg" }] }}
          />
          <Text style={s.rowTimeText}>{formatTime12h(schedule.endTime)}</Text>
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
        </View>
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

const s = StyleSheet.create({
  // shared sheet chrome
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.55)",
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
    shadowColor: "#000",
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
    gap: theme.spacing.lg
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
  row: {
    alignItems: "center",
    backgroundColor: theme.surfaceLow,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowLeft: {
    flex: 1,
    gap: 6,
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
  dayPills: {
    flexDirection: "row",
    gap: 4,
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
    color: "#fff",
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
  timeValue: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "600",
  },
  timeValueActive: {
    color: theme.accentStrong,
  },
  timePickerWrapper: {
    alignItems: "center",
    marginTop: 8,
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
  onSaveSchedule: (schedule: AcSchedule) => Promise<void>;
  onToggleScheduleEnabled: (enabled: boolean) => Promise<void>;
};

export function AcScheduleSheet({
  visible,
  loading,
  schedule,
  onClose,
  onSaveSchedule,
  onToggleScheduleEnabled,
}: AcScheduleSheetProps) {
  const translateY = useRef(new Animated.Value(800)).current;
  const handleCloseRef = useRef(onClose);
  const [editorVisible, setEditorVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { handleCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (visible && !editorVisible) {
      // Reset before animating so re-opens always start from the bottom.
      translateY.setValue(800);
      Animated.timing(translateY, {
        toValue: 0, duration: 320, useNativeDriver: false,
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
      toValue: 900, duration: 260, useNativeDriver: false,
    }).start(() => handleCloseRef.current());
  }, [translateY]);

  const dismissRef = useRef(dismiss);
  useEffect(() => { dismissRef.current = dismiss; }, [dismiss]);

  const { scrollAtTop, handlePan, contentPan } = useSheetPan(translateY, dismissRef);

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

                <View style={s.contentOuter} {...contentPan.panHandlers}>
                  <ScrollView
                    style={s.scroll}
                    contentContainerStyle={s.scrollContent}
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

                    {loading && (
                      <Text style={s.emptyText}>Loading…</Text>
                    )}

                    {!loading && schedule === null && (
                      <Text style={s.emptyText}>No schedule set. Tap + to create one.</Text>
                    )}

                    {!loading && schedule !== null && (
                      <ScheduleRow
                        schedule={schedule}
                        onToggleEnabled={onToggleScheduleEnabled}
                      />
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
  const translateY = useRef(new Animated.Value(800)).current;
  const handleCloseRef = useRef(onClose);
  useEffect(() => { handleCloseRef.current = onClose; }, [onClose]);

  // open / close animation
  useEffect(() => {
    if (visible) {
      Animated.timing(translateY, {
        toValue: 0, duration: 320, useNativeDriver: false,
      }).start();
    }
  }, [visible, translateY]);

  const dismiss = useCallback(() => {
    Animated.timing(translateY, {
      toValue: 900, duration: 260, useNativeDriver: false,
    }).start(() => handleCloseRef.current());
  }, [translateY]);

  const dismissRef = useRef(dismiss);
  useEffect(() => { dismissRef.current = dismiss; }, [dismiss]);

  const { scrollAtTop, handlePan, contentPan } = useSheetPan(translateY, dismissRef);

  // form state
  const [draft, setDraft] = useState<AcSchedule>(initial);
  useEffect(() => { setDraft(initial); }, [initial]);

  const [activeTimePicker, setActiveTimePicker] = useState<TimeField>("start");
  const [isAdjustingTemperature, setIsAdjustingTemperature] = useState(false);

  const handleTimeChange = useCallback(
    (_: DateTimePickerEvent, date?: Date) => {
      if (!date) return;
      const key = activeTimePicker === "start" ? "startTime" : "endTime";
      setDraft((prev) => ({ ...prev, [key]: timeStringFromDate(date) }));
    },
    [activeTimePicker],
  );

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

  const tempRange = useMemo(
    () => temperatureRanges[draft.mode] ?? temperatureRanges.auto,
    [draft.mode],
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
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
                <Text style={s.editorTitle}>New Schedule</Text>

                {/* ── Time ── */}
                <Section>
                  <View style={s.timeRow}>
                    <TouchableOpacity
                      style={[
                        s.timeButton,
                        activeTimePicker === "start" && s.timeButtonActive,
                      ]}
                      onPress={() => setActiveTimePicker("start")}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          s.timeLabel,
                          activeTimePicker === "start" && s.timeLabelActive,
                        ]}
                      >
                        Start
                      </Text>
                      <Text
                        style={[
                          s.timeValue,
                          activeTimePicker === "start" && s.timeValueActive,
                        ]}
                      >
                        {formatTime12h(draft.startTime)}
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
                      onPress={() => setActiveTimePicker("end")}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          s.timeLabel,
                          activeTimePicker === "end" && s.timeLabelActive,
                        ]}
                      >
                        End
                      </Text>
                      <Text
                        style={[
                          s.timeValue,
                          activeTimePicker === "end" && s.timeValueActive,
                        ]}
                      >
                        {formatTime12h(draft.endTime)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={s.timePickerWrapper}>
                    <DateTimePicker
                      mode="time"
                      display="spinner"
                      value={dateFromTimeString(
                        activeTimePicker === "start"
                          ? draft.startTime
                          : draft.endTime,
                      )}
                      onChange={handleTimeChange}
                      style={s.timePicker}
                      textColor={theme.text}
                    />
                  </View>
                </Section>

                <View style={{gap: theme.spacing.lg}}>
                {/* ── Days ── */}
                <Section>
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
                </Section>

                {/* ── Mode ── */}
                <Section>
	                  <ModeSelector
	                    selectedMode={draft.mode}
	                    isPowered={true}
	                    onChangeMode={(mode) => {
	                      setDraft((prev) => ({
                        ...prev,
                        mode: mode as Exclude<AirConditionerMode, "fan">,
                        temperature: Math.min(
                          Math.max(
                            prev.temperature,
                            (temperatureRanges[
                              mode as Exclude<AirConditionerMode, "fan">
                            ] ?? temperatureRanges.auto).min,
                          ),
                          (temperatureRanges[
                            mode as Exclude<AirConditionerMode, "fan">
                          ] ?? temperatureRanges.auto).max,
                        ),
                      }));
                    }}
                  />
                </Section>

                {/* ── Temperature ── */}
                <Section>
                  <View style={s.temperatureHeader}>
                    <View style={s.temperatureTitleGroup}>
                      <Text style={s.temperatureTitle}>Temperature</Text>
                      <Text style={s.temperatureSubtitle}>
                        {draft.temperature}°C target
                      </Text>
                    </View>
                    <View style={s.temperatureActions}>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        accessibilityLabel="Toggle quiet mode"
                        accessibilityRole="switch"
                        accessibilityState={{ checked: Boolean(draft.quiet) }}
                        onPress={handleToggleQuiet}
                        style={[
                          s.featureButton,
                          draft.quiet ? s.quietButtonOn : s.featureButtonOff,
                        ]}
                      >
                        <Moon
                          color={draft.quiet ? theme.quietAccent : theme.text}
                          size={20}
                          strokeWidth={2.4}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.75}
                        accessibilityLabel="Toggle powerful mode"
                        accessibilityRole="switch"
                        accessibilityState={{ checked: Boolean(draft.powerful) }}
                        onPress={handleTogglePowerful}
                        style={[
                          s.featureButton,
                          draft.powerful ? s.powerfulButtonOn : s.featureButtonOff,
                        ]}
                      >
                        <Zap
                          color={draft.powerful ? theme.powerfulAccent : theme.text}
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
                          t, tempRange.min, tempRange.max,
                        ),
                      }))
	                    }
	                    onInteractionStart={() => {
	                      setIsAdjustingTemperature(true);
	                    }}
                    onInteractionEnd={() => setIsAdjustingTemperature(false)}
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
                disabled={saving}
              />
            </View>
            </SafeAreaView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
