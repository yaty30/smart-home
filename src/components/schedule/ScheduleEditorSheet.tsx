import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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

import { useScheduleDraft } from "../../hooks/useScheduleDraft";
import { useSheetAnimation } from "../../hooks/useSheetAnimation";
import { useSheetDismiss } from "../../hooks/useSheetDismiss";
import { type Theme, useTheme } from "../../theme/theme";
import type { AcSchedule } from "../../types/acSchedule";
import { AppButton } from "../AppButton";
import {
  ScheduleFanSpeedSection,
  ScheduleHorizontalAirflowSection,
  ScheduleVerticalAirflowSection,
} from "./ScheduleAirflowSections";
import { ScheduleModeSection } from "./ScheduleModeSection";
import { ScheduleRepeatSection } from "./ScheduleRepeatSection";
import { ScheduleTemperatureSection } from "./ScheduleTemperatureSection";
import { ScheduleTimeSection } from "./ScheduleTimeSection";
import { createSheetChromeStyles } from "./sheetChromeStyles";

type ScheduleEditorSheetProps = {
  visible: boolean;
  initial: AcSchedule;
  saving: boolean;
  onClose: () => void;
  onSave: (schedule: AcSchedule) => void;
};

export function ScheduleEditorSheet({
  visible,
  initial,
  saving,
  onClose,
  onSave,
}: ScheduleEditorSheetProps) {
  const theme = useTheme();
  const chrome = useMemo(() => createSheetChromeStyles(theme), [theme]);
  const s = useMemo(() => createStyles(theme), [theme]);
  const [isAdjustingTemperature, setIsAdjustingTemperature] = useState(false);

  const { translateY, close: closeSheet } = useSheetAnimation(visible, onClose);
  const {
    draft,
    isDirty,
    activeTimePicker,
    temperatureRange,
    hasAnyTime,
    handleTimeChange,
    handleSelectStartTime,
    handleSelectEndTime,
    handleClearStartTime,
    handleClearEndTime,
    handleToggleQuiet,
    handleTogglePowerful,
    handleToggleDay,
    handleSelectDayGroup,
    handleSelectRepeatFrequency,
    handleSelectMode,
    handleChangeTemperature,
    handleChangeFanSpeed,
    handleChangeVerticalAirflow,
    handleChangeHorizontalAirflow,
  } = useScheduleDraft(initial, visible);

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

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
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

              <View
                style={chrome.contentOuter}
                {...(isAdjustingTemperature ? {} : contentPan.panHandlers)}
              >
                <ScrollView
                  style={chrome.scroll}
                  contentContainerStyle={chrome.scrollContent}
                  keyboardShouldPersistTaps="handled"
                  onScroll={({ nativeEvent }) => {
                    scrollAtTop.current = nativeEvent.contentOffset.y <= 0;
                  }}
                  scrollEnabled={!isAdjustingTemperature}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={s.editorTitle}>AC Schedule</Text>

                  <ScheduleTimeSection
                    activeTimePicker={activeTimePicker}
                    startTime={draft.startTime}
                    endTime={draft.endTime}
                    onSelectStartTime={handleSelectStartTime}
                    onSelectEndTime={handleSelectEndTime}
                    onClearStartTime={handleClearStartTime}
                    onClearEndTime={handleClearEndTime}
                    onTimeChange={handleTimeChange}
                  />

                  <View style={{ gap: theme.spacing.lg }}>
                    <ScheduleRepeatSection
                      days={draft.days}
                      repeatFrequency={draft.repeatFrequency ?? "one-time"}
                      onSelectRepeatFrequency={handleSelectRepeatFrequency}
                      onToggleDay={handleToggleDay}
                      onSelectDayGroup={handleSelectDayGroup}
                    />

                    <ScheduleModeSection
                      mode={draft.mode}
                      onSelectMode={handleSelectMode}
                    />

                    <ScheduleTemperatureSection
                      temperature={draft.temperature}
                      minTemperature={temperatureRange.min}
                      maxTemperature={temperatureRange.max}
                      quiet={Boolean(draft.quiet)}
                      powerful={Boolean(draft.powerful)}
                      onChangeTemperature={handleChangeTemperature}
                      onToggleQuiet={handleToggleQuiet}
                      onTogglePowerful={handleTogglePowerful}
                      onInteractionStart={() =>
                        setIsAdjustingTemperature(true)
                      }
                      onInteractionEnd={() =>
                        setIsAdjustingTemperature(false)
                      }
                    />

                    <ScheduleFanSpeedSection
                      fanSpeed={draft.fanSpeed}
                      onChangeFanSpeed={handleChangeFanSpeed}
                    />

                    <ScheduleVerticalAirflowSection
                      airflow={draft.verticalAirflow}
                      onChangeAirflow={handleChangeVerticalAirflow}
                    />

                    <ScheduleHorizontalAirflowSection
                      airflow={draft.horizontalAirflow}
                      onChangeAirflow={handleChangeHorizontalAirflow}
                    />
                  </View>
                </ScrollView>
              </View>

              <View style={chrome.footer}>
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    editorTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "600",
    },
  });
