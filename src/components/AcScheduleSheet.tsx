import { Plus } from "lucide-react-native";
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
import { defaultSchedule } from "./schedule/scheduleConstants";
import { ScheduleEditorSheet } from "./schedule/ScheduleEditorSheet";
import { ScheduleRow } from "./schedule/ScheduleRow";
import { createSheetChromeStyles } from "./schedule/sheetChromeStyles";
import { SwipeableItem } from "./SwipeableItem";
import { type Theme, useTheme } from "../theme/theme";
import type { AcSchedule } from "../types/acSchedule";

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
  const chrome = useMemo(() => createSheetChromeStyles(theme), [theme]);
  const s = useMemo(() => createStyles(theme), [theme]);
  const [editorVisible, setEditorVisible] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const { translateY, close: dismiss } = useSheetAnimation(
    visible && !editorVisible,
    onClose,
    { resetOnOpen: true },
  );

  useEffect(() => {
    if (!visible) {
      setEditorVisible(false);
    }
  }, [visible]);

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
    scheduleSwipeItem: {
      borderRadius: 12,
    },
  });
