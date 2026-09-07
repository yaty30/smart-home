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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { TEMPERATURE_RANGES } from "../../constants/acModes";
import { useSheetAnimation } from "../../hooks/useSheetAnimation";
import { useSheetDismiss } from "../../hooks/useSheetDismiss";
import { type Theme, useTheme } from "../../theme/theme";
import {
  MAX_AC_PRESETS,
  type AcPreset,
  type AcPresetAirflow,
  type AcPresetFanSpeed,
  type AcPresetMode,
} from "../../types/acPreset";
import { normalizeTemperature } from "../../utils/temperatureGauge";
import { AppButton } from "../AppButton";
import {
  ScheduleFanSpeedSection,
  ScheduleHorizontalAirflowSection,
  ScheduleVerticalAirflowSection,
} from "../schedule/ScheduleAirflowSections";
import { ScheduleModeSection } from "../schedule/ScheduleModeSection";
import { ScheduleTemperatureSection } from "../schedule/ScheduleTemperatureSection";
import { createSheetChromeStyles } from "../schedule/sheetChromeStyles";

type AcPresetSheetProps = {
  count: number;
  initial: AcPreset;
  saving: boolean;
  visible: boolean;
  onClose: () => void;
  onSave: (preset: AcPreset) => void;
};

const isSamePreset = (a: AcPreset, b: AcPreset) =>
  a.id === b.id &&
  a.name === b.name &&
  a.mode === b.mode &&
  a.temperature === b.temperature &&
  a.fanSpeed === b.fanSpeed &&
  a.quiet === b.quiet &&
  a.powerful === b.powerful &&
  a.horizontalAirflow === b.horizontalAirflow &&
  a.verticalAirflow === b.verticalAirflow;

export function AcPresetSheet({
  count,
  initial,
  saving,
  visible,
  onClose,
  onSave,
}: AcPresetSheetProps) {
  const theme = useTheme();
  const chrome = useMemo(() => createSheetChromeStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [draft, setDraft] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [isAdjustingTemperature, setIsAdjustingTemperature] = useState(false);

  const { translateY, close: closeSheet } = useSheetAnimation(visible, onClose);
  const closeSheetRef = useRef(closeSheet);

  useEffect(() => {
    closeSheetRef.current = closeSheet;
  }, [closeSheet]);

  useEffect(() => {
    if (!visible) return;
    setDraft(initial);
    setBaseline(initial);
  }, [initial, visible]);

  const isDirty = useMemo(
    () => !isSamePreset(draft, baseline),
    [baseline, draft],
  );
  const canSave = draft.name.trim().length > 0 && count < MAX_AC_PRESETS;
  const temperatureRange = useMemo(
    () => TEMPERATURE_RANGES[draft.mode] ?? TEMPERATURE_RANGES.auto,
    [draft.mode],
  );

  const dismiss = useCallback(() => {
    if (!isDirty) {
      closeSheetRef.current();
      return;
    }

    Alert.alert(
      "Unsaved Preset",
      "This preset has changes that haven't been saved. Discard them?",
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

  const handleSelectMode = useCallback((mode: AcPresetMode) => {
    const nextRange = TEMPERATURE_RANGES[mode] ?? TEMPERATURE_RANGES.auto;

    setDraft((current) => ({
      ...current,
      mode,
      temperature: normalizeTemperature(
        current.temperature,
        nextRange.min,
        nextRange.max,
      ),
    }));
  }, []);

  const handleChangeTemperature = useCallback(
    (temperature: number) => {
      setDraft((current) => ({
        ...current,
        temperature: normalizeTemperature(
          temperature,
          temperatureRange.min,
          temperatureRange.max,
        ),
      }));
    },
    [temperatureRange.max, temperatureRange.min],
  );

  const handleToggleQuiet = useCallback(() => {
    setDraft((current) => {
      const quiet = !current.quiet;
      return { ...current, quiet, powerful: quiet ? false : current.powerful };
    });
  }, []);

  const handleTogglePowerful = useCallback(() => {
    setDraft((current) => {
      const powerful = !current.powerful;
      return { ...current, powerful, quiet: powerful ? false : current.quiet };
    });
  }, []);

  const handleSave = () => {
    onSave({
      ...draft,
      name: draft.name.trim(),
      temperature: normalizeTemperature(
        draft.temperature,
        temperatureRange.min,
        temperatureRange.max,
      ),
    });
  };

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
                  <View style={styles.header}>
                    <Text style={styles.editorTitle}>New Preset</Text>
                    <Text style={styles.count}>
                      {count}/{MAX_AC_PRESETS}
                    </Text>
                  </View>

                  <View style={styles.nameField}>
                    <Text style={styles.nameLabel}>Name</Text>
                    <TextInput
                      autoFocus
                      autoCapitalize="words"
                      maxLength={28}
                      onChangeText={(name) =>
                        setDraft((current) => ({ ...current, name }))
                      }
                      placeholder="Evening Cool"
                      placeholderTextColor={theme.textMuted}
                      returnKeyType="done"
                      style={styles.input}
                      value={draft.name}
                    />
                  </View>

                  <ScheduleModeSection
                    mode={draft.mode}
                    onSelectMode={handleSelectMode}
                  />

                  <ScheduleTemperatureSection
                    temperature={draft.temperature}
                    minTemperature={temperatureRange.min}
                    maxTemperature={temperatureRange.max}
                    quiet={draft.quiet}
                    powerful={draft.powerful}
                    onChangeTemperature={handleChangeTemperature}
                    onToggleQuiet={handleToggleQuiet}
                    onTogglePowerful={handleTogglePowerful}
                    onInteractionStart={() => setIsAdjustingTemperature(true)}
                    onInteractionEnd={() => setIsAdjustingTemperature(false)}
                  />

                  <ScheduleFanSpeedSection
                    fanSpeed={draft.fanSpeed}
                    onChangeFanSpeed={(fanSpeed: AcPresetFanSpeed) =>
                      setDraft((current) => ({ ...current, fanSpeed }))
                    }
                  />

                  <ScheduleVerticalAirflowSection
                    airflow={draft.verticalAirflow}
                    onChangeAirflow={(verticalAirflow: AcPresetAirflow) =>
                      setDraft((current) => ({ ...current, verticalAirflow }))
                    }
                  />

                  <ScheduleHorizontalAirflowSection
                    airflow={draft.horizontalAirflow}
                    onChangeAirflow={(horizontalAirflow: AcPresetAirflow) =>
                      setDraft((current) => ({ ...current, horizontalAirflow }))
                    }
                  />
                </ScrollView>
              </View>

              <View style={chrome.footer}>
                <AppButton
                  disabled={saving || !canSave}
                  label={saving ? "Saving…" : "Save Preset"}
                  onPress={handleSave}
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
    header: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    editorTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "600",
      letterSpacing: 0,
    },
    count: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0,
    },
    nameField: {
      gap: theme.spacing.sm,
    },
    nameLabel: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 0,
    },
    input: {
      backgroundColor: theme.surfaceLow,
      borderColor: theme.border,
      borderRadius: 14,
      borderWidth: 1,
      color: theme.text,
      fontSize: 16,
      fontWeight: "700",
      minHeight: 54,
      paddingHorizontal: 14,
    },
  });
