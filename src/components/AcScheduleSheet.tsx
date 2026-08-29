import {
  CalendarClock,
  ChevronRight,
  Power,
  PowerOff,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useSheetAnimation } from "../hooks/useSheetAnimation";
import { useSheetDismiss } from "../hooks/useSheetDismiss";
import {
  createScheduleForType,
  defaultSchedule,
  scheduleTypeLabels,
} from "./schedule/scheduleConstants";
import { ScheduleEditorSheet } from "./schedule/ScheduleEditorSheet";
import { ScheduleRow } from "./schedule/ScheduleRow";
import { createSheetChromeStyles } from "./schedule/sheetChromeStyles";
import { SwipeableItem } from "./SwipeableItem";
import { type Theme, useTheme } from "../theme/theme";
import {
  MAX_AC_SCHEDULES,
  type AcSchedule,
  type ScheduleType,
} from "../types/acSchedule";

export type AcScheduleSheetProps = {
  visible: boolean;
  loading: boolean;
  schedules: AcSchedule[];
  onClose: () => void;
  onDeleteSchedule: (id: string) => Promise<void>;
  onSaveSchedule: (schedule: AcSchedule) => Promise<void>;
  onToggleScheduleEnabled: (id: string, enabled: boolean) => Promise<void>;
};

export function AcScheduleSheet({
  visible,
  loading,
  schedules,
  onClose,
  onDeleteSchedule,
  onSaveSchedule,
  onToggleScheduleEnabled,
}: AcScheduleSheetProps) {
  const theme = useTheme();
  const chrome = useMemo(() => createSheetChromeStyles(theme), [theme]);
  const s = useMemo(() => createStyles(theme), [theme]);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorInitial, setEditorInitial] = useState<AcSchedule>(defaultSchedule);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const canAddSchedule = schedules.length < MAX_AC_SCHEDULES;

  const scheduleTypeOptions = useMemo(
    () =>
      [
        {
          type: "schedule_time" as const,
          icon: CalendarClock,
          description: "Turn the AC on and off within a scheduled time period.",
        },
        {
          type: "auto_on" as const,
          icon: Power,
          description: "Automatically turn the AC on at a specific time.",
        },
        {
          type: "auto_off" as const,
          icon: PowerOff,
          description: "Automatically turn the AC off at a specific time.",
        },
      ] satisfies {
        type: ScheduleType;
        icon: LucideIcon;
        description: string;
      }[],
    [],
  );

  const { translateY, close: dismiss } = useSheetAnimation(
    visible && !editorVisible,
    onClose,
    { resetOnOpen: true },
  );

  useEffect(() => {
    if (!visible) {
      setEditorVisible(false);
      setEditorInitial(defaultSchedule);
    }
  }, [visible]);

  const openEditor = useCallback((initial: AcSchedule) => {
    setEditorInitial(initial);
    setEditorVisible(true);
  }, []);

  const handleSelectScheduleType = useCallback(
    (type: ScheduleType) => {
      if (!canAddSchedule) return;
      openEditor(
        createScheduleForType(type, {
          ...defaultSchedule,
          enabled: true,
        }),
      );
    },
    [canAddSchedule, openEditor],
  );

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
        <View style={chrome.modalRoot}>
          <TouchableOpacity
            style={[StyleSheet.absoluteFill, chrome.backdrop]}
            activeOpacity={1}
            onPress={dismiss}
          />
          <KeyboardAvoidingView
            style={chrome.kavFill}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[chrome.sheet, { transform: [{ translateY }] }]}
            >
              <SafeAreaView style={chrome.safeArea}>
                <View style={chrome.handleArea} {...handlePan.panHandlers}>
                  <View style={chrome.handle} />
                </View>

                <View style={chrome.contentOuter}>
                  <ScrollView
                    style={chrome.scroll}
                    contentContainerStyle={chrome.scrollContent}
                    scrollEnabled={scrollEnabled}
                    onScroll={({ nativeEvent }) => {
                      scrollAtTop.current = nativeEvent.contentOffset.y <= 0;
                    }}
                    scrollEventThrottle={16}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={s.listHeader}>
                      <Text style={s.sheetTitle}>New Schedule</Text>
                      <Text style={s.scheduleCount}>
                        {schedules.length}/{MAX_AC_SCHEDULES}
                      </Text>
                    </View>

                    <View style={s.typeOptionList}>
                      {scheduleTypeOptions.map((option) => {
                        const Icon = option.icon;

                        return (
                          <TouchableOpacity
                            key={option.type}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            disabled={!canAddSchedule}
                            onPress={() => handleSelectScheduleType(option.type)}
                            style={[
                              s.typeOption,
                              !canAddSchedule && s.typeOptionDisabled,
                            ]}
                          >
                            <View style={s.typeOptionIcon}>
                              <Icon
                                color={theme.accentStrong}
                                size={22}
                                strokeWidth={2.2}
                              />
                            </View>
                            <View style={s.typeOptionTextGroup}>
                              <Text style={s.typeOptionTitle}>
                                {scheduleTypeLabels[option.type]}
                              </Text>
                              <Text style={s.typeOptionDescription}>
                                {option.description}
                              </Text>
                            </View>
                            <ChevronRight
                              color={theme.textMuted}
                              size={18}
                              strokeWidth={2}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {!loading && !canAddSchedule && (
                      <Text style={s.emptyText}>
                        Maximum of {MAX_AC_SCHEDULES} schedules reached.
                      </Text>
                    )}

                    {loading && <Text style={s.emptyText}>Loading…</Text>}

                    {!loading && schedules.length > 0 && (
                      <View style={s.currentScheduleSection}>
                        <Text style={s.sectionLabel}>Schedules</Text>
                        <View style={s.scheduleList}>
                          {schedules.map((schedule) => (
                            <SwipeableItem
                              key={schedule.id}
                              onDelete={() => {
                                void onDeleteSchedule(schedule.id);
                              }}
                              onPress={() => openEditor(schedule)}
                              onSwipeEnd={() => setScrollEnabled(true)}
                              onSwipeStart={() => setScrollEnabled(false)}
                              style={s.scheduleSwipeItem}
                              contentBackground={theme.paperBackground}
                            >
                              <ScheduleRow
                                schedule={schedule}
                                onToggleEnabled={(enabled) =>
                                  onToggleScheduleEnabled(schedule.id, enabled)
                                }
                              />
                            </SwipeableItem>
                          ))}
                        </View>
                      </View>
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
        initial={editorInitial}
        saving={saving}
        onClose={() => setEditorVisible(false)}
        onSave={handleSave}
      />
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
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
    scheduleCount: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "700",
    },
    sectionLabel: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 10,
    },
    typeOptionList: {
      gap: 10,
    },
    typeOption: {
      alignItems: "center",
      backgroundColor: theme.surfaceLow,
      borderColor: theme.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      minHeight: 76,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    typeOptionDisabled: {
      opacity: 0.42,
    },
    typeOptionIcon: {
      alignItems: "center",
      backgroundColor: theme.accentSubtle,
      borderColor: theme.accentMuted,
      borderRadius: 12,
      borderWidth: 1,
      height: 42,
      justifyContent: "center",
      width: 42,
    },
    typeOptionTextGroup: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    typeOptionTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "700",
    },
    typeOptionDescription: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "500",
      lineHeight: 16,
    },
    emptyText: {
      color: theme.textSecondary,
      fontSize: 14,
      textAlign: "center",
      paddingVertical: 32,
    },
    scheduleSwipeItem: {
      borderRadius: 12,
    },
    scheduleList: {
      gap: 10,
    },
    currentScheduleSection: {
      marginTop: 20,
    },
  });
