import { Bot, QrCode } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
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
import { useSheetDismiss } from "../hooks/useSheetDismiss";
import {
  ROOM_ICONS,
  DEFAULT_ROOM_ICON,
  type RoomIcon,
} from "../domain/roomIcon";
import { type Theme, useTheme } from "../theme/theme";
import { AppButton } from "./AppButton";

type AddRoomSheetProps = {
  visible: boolean;
  onClose: () => void;
  onScanController: (name: string, icon: RoomIcon) => void;
};

export function AddRoomSheet({
  visible,
  onClose,
  onScanController,
}: AddRoomSheetProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [roomName, setRoomName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<RoomIcon>(DEFAULT_ROOM_ICON);
  // Always starts at 0 — entrance is handled by Modal's animationType="slide".
  // useNativeDriver: false throughout so JS-side hit testing stays accurate.
  const translateY = useRef(new Animated.Value(800)).current;
  const isDismissing = useRef(false);

  const canAddRoom = roomName.trim().length > 0;

  useEffect(() => {
    if (visible) {
      isDismissing.current = false;
      translateY.setValue(800);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: false,
        bounciness: 4,
        speed: 14,
      }).start();
    }
  }, [visible, translateY]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    setRoomName("");
    setSelectedIcon(DEFAULT_ROOM_ICON);
    onClose();
  }, [onClose]);

  const handleSubmit = () => {
    const trimmedName = roomName.trim();
    if (!trimmedName) return;
    Keyboard.dismiss();
    onScanController(trimmedName, selectedIcon);
    setRoomName("");
    setSelectedIcon(DEFAULT_ROOM_ICON);
  };

  // Stable ref so PanResponder (created once) always calls the latest handleClose.
  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  }, [handleClose]);

  const dismiss = useCallback(() => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    Animated.timing(translateY, {
      toValue: 900,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      handleCloseRef.current();
    });
  }, [translateY]);

  const dismissRef = useRef(dismiss);
  useEffect(() => {
    dismissRef.current = dismiss;
  }, [dismiss]);

  const { scrollAtTop, handlePan, contentPan } = useSheetDismiss(
    translateY,
    dismissRef,
    isDismissing,
  );

  const iconOptions = useMemo(() => ROOM_ICONS, []);

  return (
    // animationType="slide" lets iOS handle the entrance natively.
    // The sheet starts at translateY=0, so hit testing is immediately correct.
    <Modal
      animationType="none"
      onRequestClose={dismiss}
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        {/* Backdrop — tap to close */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          activeOpacity={1}
        />

        {/* box-none: container doesn't absorb touches, only its children do */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
          style={styles.keyboardAvoiding}
        >
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY }] }]}
          >
            <SafeAreaView style={styles.safeArea}>
              {/* Handle area — sole owner of handlePan; no Pressable in this subtree */}
              <View style={styles.handleArea} {...handlePan.panHandlers}>
                <View style={styles.handle} />
              </View>

              {/* Content area — contentPan only activates on downward swipe at scroll top */}
              <View style={styles.scrollContainer} {...contentPan.panHandlers}>
                <ScrollView
                  contentContainerStyle={styles.content}
                  keyboardShouldPersistTaps="handled"
                  onScroll={(e) => {
                    scrollAtTop.current = e.nativeEvent.contentOffset.y <= 0;
                  }}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={false}
                  style={styles.formScroll}
                >
                  <Text style={styles.title}>Add Room</Text>

                  <Text style={styles.sectionLabel}>Room Name</Text>
                  <TextInput
                    autoCapitalize="words"
                    autoCorrect={false}
                    onChangeText={setRoomName}
                    onSubmitEditing={handleSubmit}
                    placeholder="Living Room"
                    placeholderTextColor={theme.textMuted}
                    returnKeyType="done"
                    style={styles.input}
                    value={roomName}
                  />

                  <Text style={[styles.sectionLabel, styles.iconSectionLabel]}>
                    Choose Icon
                  </Text>
                  <View style={styles.iconGrid}>
                    {iconOptions.map(({ id, label, icon: Icon }) => {
                      const isSelected = selectedIcon === id;
                      return (
                        <TouchableOpacity
                          key={id}
                          activeOpacity={0.74}
                          accessibilityLabel={`Select ${label} icon`}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          onPress={() => {
                            Keyboard.dismiss();
                            setSelectedIcon(id);
                          }}
                          style={[
                            styles.iconOption,
                            isSelected && styles.iconOptionSelected,
                          ]}
                        >
                          <Icon
                            color={
                              isSelected ? theme.accent : theme.textSecondary
                            }
                            size={26}
                            strokeWidth={2.25}
                          />
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.iconLabel,
                              isSelected && styles.iconLabelSelected,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.footer}>
                <AppButton
                  disabled={!canAddRoom}
                  label="Add Controller"
                  leftIcon={
                    <Bot
                      color={theme.accentStrong}
                      size={22}
                      strokeWidth={2.6}
                    />
                  }
                  onPress={handleSubmit}
                  vibe="strong"
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
    root: {
      flex: 1,
    },
    keyboardAvoiding: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: theme.paperBackground,
      borderColor: theme.border,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      maxHeight: "86%",
    },
    safeArea: {
      maxHeight: "100%",
    },
    handleArea: {
      alignItems: "center",
      height: 28,
      justifyContent: "center",
    },
    handle: {
      backgroundColor: theme.textMuted,
      borderRadius: 2,
      height: 4,
      width: 42,
    },
    scrollContainer: {
      flexShrink: 1,
    },
    formScroll: {
      flexShrink: 1,
    },
    content: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.lg,
    },
    title: {
      color: theme.text,
      fontSize: 24,
      fontWeight: "800",
      letterSpacing: 0,
      marginBottom: theme.spacing.xl,
    },
    sectionLabel: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
      marginBottom: theme.spacing.sm,
      textTransform: "uppercase",
    },
    input: {
      backgroundColor: theme.surfaceLow,
      borderColor: theme.border,
      borderRadius: 14,
      borderWidth: 1,
      color: theme.text,
      fontSize: 16,
      fontWeight: "700",
      height: 54,
      paddingHorizontal: theme.spacing.lg,
    },
    iconSectionLabel: {
      marginTop: theme.spacing.xl,
    },
    iconGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    iconOption: {
      alignItems: "center",
      backgroundColor: theme.surfaceLow,
      borderColor: theme.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: theme.spacing.xs,
      height: 78,
      justifyContent: "center",
      width: "23%",
    },
    iconOptionSelected: {
      backgroundColor: theme.accentMuted,
      borderColor: theme.borderActive,
    },
    iconLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0,
      maxWidth: "86%",
      textAlign: "center",
    },
    iconLabelSelected: {
      color: theme.accent,
    },
    footer: {
      borderTopColor: theme.border,
      borderTopWidth: 1,
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
    },
  });
