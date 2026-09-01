import { Save } from "lucide-react-native";
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

import type { Controller } from "../../domain/controller";
import { useSheetDismiss } from "../../hooks/useSheetDismiss";
import { type Theme, useTheme } from "../../theme/theme";
import { AppButton } from "../AppButton";

type EditControllerSheetProps = {
  controller: Controller | null;
  visible: boolean;
  onClose: () => void;
  onSave: (
    controllerId: string,
    updates: { name: string; ip: string; logo: string | null },
  ) => Promise<void>;
};

const OFFSCREEN = 900;

const normalizeHost = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  try {
    const url = new URL(withScheme);
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
};

export function EditControllerSheet({
  controller,
  visible,
  onClose,
  onSave,
}: EditControllerSheetProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const translateY = useRef(new Animated.Value(OFFSCREEN)).current;
  const isDismissing = useRef(false);
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [logo, setLogo] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [ipError, setIpError] = useState(false);

  useEffect(() => {
    if (!visible || !controller) {
      return;
    }

    isDismissing.current = false;
    setName(controller.name);
    setIp(controller.ip);
    setLogo(controller.logo ?? "");
    setIpError(false);
    translateY.setValue(OFFSCREEN);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: false,
      bounciness: 4,
      speed: 14,
    }).start();
  }, [controller, translateY, visible]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    setIsSaving(false);
    setIpError(false);
    onClose();
  }, [onClose]);

  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  }, [handleClose]);

  const dismiss = useCallback(() => {
    if (isDismissing.current) {
      return;
    }

    isDismissing.current = true;
    Animated.timing(translateY, {
      toValue: OFFSCREEN,
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

  const normalizedIp = normalizeHost(ip);
  const canSave =
    controller !== null &&
    name.trim().length > 0 &&
    normalizedIp !== null &&
    !isSaving;

  const handleSave = useCallback(async () => {
    if (!controller) {
      return;
    }

    const nextIp = normalizeHost(ip);
    if (nextIp === null) {
      setIpError(true);
      return;
    }

    const nextName = name.trim();
    if (!nextName) {
      return;
    }

    setIsSaving(true);
    await onSave(controller.id, {
      name: nextName,
      ip: nextIp,
      logo: logo.trim().length > 0 ? logo.trim() : null,
    });
    dismiss();
  }, [controller, dismiss, ip, logo, name, onSave]);

  return (
    <Modal
      animationType="none"
      onRequestClose={dismiss}
      transparent
      visible={visible && controller !== null}
    >
      <View style={styles.root}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={dismiss}
          style={StyleSheet.absoluteFill}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
          style={styles.keyboardAvoiding}
        >
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            <SafeAreaView style={styles.safeArea}>
              <View style={styles.handleArea} {...handlePan.panHandlers}>
                <View style={styles.handle} />
              </View>

              <View style={styles.scrollContainer} {...contentPan.panHandlers}>
                <ScrollView
                  contentContainerStyle={styles.content}
                  keyboardShouldPersistTaps="handled"
                  onScroll={(event) => {
                    scrollAtTop.current = event.nativeEvent.contentOffset.y <= 0;
                  }}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={false}
                  style={styles.formScroll}
                >
                  <Text style={styles.title}>Edit Controller</Text>

                  <Text style={styles.sectionLabel}>Name</Text>
                  <TextInput
                    autoCapitalize="words"
                    autoCorrect={false}
                    onChangeText={setName}
                    onSubmitEditing={handleSave}
                    placeholder="Living Room Controller"
                    placeholderTextColor={theme.textMuted}
                    returnKeyType="next"
                    style={styles.input}
                    value={name}
                  />

                  <Text style={[styles.sectionLabel, styles.fieldSpacing]}>
                    IP Address
                  </Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    onChangeText={(value) => {
                      setIp(value);
                      setIpError(false);
                    }}
                    onSubmitEditing={handleSave}
                    placeholder="http://192.168.1.50"
                    placeholderTextColor={theme.textMuted}
                    returnKeyType="next"
                    style={[styles.input, ipError && styles.inputInvalid]}
                    value={ip}
                  />
                  {ipError ? (
                    <Text style={styles.errorText}>Enter a valid address.</Text>
                  ) : null}

                  <Text style={[styles.sectionLabel, styles.fieldSpacing]}>
                    Logo URL
                  </Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    onChangeText={setLogo}
                    onSubmitEditing={handleSave}
                    placeholder="https://example.com/logo.png"
                    placeholderTextColor={theme.textMuted}
                    returnKeyType="done"
                    style={styles.input}
                    value={logo}
                  />
                </ScrollView>
              </View>

              <View style={styles.footer}>
                <AppButton
                  disabled={!canSave}
                  label={isSaving ? "Saving" : "Save Changes"}
                  leftIcon={
                    <Save
                      color={theme.accentStrong}
                      size={22}
                      strokeWidth={2.6}
                    />
                  }
                  onPress={handleSave}
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
      paddingBottom: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xl,
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
    fieldSpacing: {
      marginTop: theme.spacing.xl,
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
    inputInvalid: {
      borderColor: theme.powerAccent,
    },
    errorText: {
      color: theme.powerAccent,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0,
      marginTop: theme.spacing.sm,
    },
    footer: {
      borderTopColor: theme.border,
      borderTopWidth: 1,
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
    },
  });
