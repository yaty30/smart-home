import * as Haptics from "expo-haptics";
import {
  AirVent,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  QrCode,
  Tv,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { AppButton } from "../components/AppButton";
import {
  PairingScannerModal,
  usePairingScanner,
} from "../components/PairingScannerModal";
import { useHomeData } from "../context/HomeDataContext";
import type { RootStackScreenProps } from "../navigation/types";
import { theme } from "../theme/theme";
import type { PairedDevice } from "../types/device";
import type { HomeDeviceType } from "../types/home";

const deviceTypeOptions: {
  id: HomeDeviceType | "light" | "tv";
  label: string;
  Icon: typeof AirVent;
  supported: boolean;
}[] = [
  { Icon: AirVent, id: "ac", label: "Air Conditioner", supported: true },
  { Icon: Lightbulb, id: "light", label: "Light", supported: false },
  { Icon: Tv, id: "tv", label: "TV", supported: false },
];

export function NewDeviceSheet({
  navigation,
  route,
}: RootStackScreenProps<"NewDevice">) {
  const { addDevice, findDeviceByHost, scenes } = useHomeData();
  const { closeScanner, isScannerOpen, openScanner, permissionError } =
    usePairingScanner();
  const preselectedSceneId = route.params?.sceneId;
  const [scannedDevice, setScannedDevice] = useState<PairedDevice | null>(null);
  const [deviceName, setDeviceName] = useState("Air Conditioner");
  const [selectedSceneId, setSelectedSceneId] = useState<string>(
    (preselectedSceneId !== undefined &&
    scenes.some((scene) => scene.id === preselectedSceneId)
      ? preselectedSceneId
      : scenes[0]?.id) ?? "",
  );
  const [selectedType] = useState<HomeDeviceType>("ac");
  const hasAutoOpenedScanner = useRef(false);

  useEffect(() => {
    if (!hasAutoOpenedScanner.current) {
      hasAutoOpenedScanner.current = true;
      void openScanner();
    }
  }, [openScanner]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handlePaired = useCallback(
    (device: PairedDevice) => {
      const existingDevice = findDeviceByHost(device.host);

      if (existingDevice !== undefined) {
        return `${existingDevice.name} already uses this controller.`;
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScannedDevice(device);
      return null;
    },
    [findDeviceByHost],
  );

  const handleSave = useCallback(() => {
    const trimmedName = deviceName.trim();

    if (
      scannedDevice === null ||
      trimmedName.length === 0 ||
      selectedSceneId.length === 0
    ) {
      return;
    }

    addDevice({
      host: scannedDevice.host,
      name: trimmedName,
      sceneId: selectedSceneId,
      token: scannedDevice.token,
      type: selectedType,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  }, [
    addDevice,
    deviceName,
    navigation,
    scannedDevice,
    selectedSceneId,
    selectedType,
  ]);

  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>New Device</Text>
        <TouchableOpacity
          activeOpacity={0.76}
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={handleClose}
          style={styles.closeButton}
        >
          <X color={theme.textSecondary} size={20} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {scannedDevice === null ? (
        <View style={styles.scanPrompt}>
          <View style={styles.scanMark}>
            <QrCode color={theme.accentBright} size={30} strokeWidth={2.2} />
          </View>
          <Text style={styles.scanPromptText}>
            Scan the pairing QR code shown by your device to add it to your
            home.
          </Text>

          {permissionError !== null ? (
            <View style={styles.inlineNotice}>
              <AlertCircle
                color={theme.accentBright}
                size={18}
                strokeWidth={2.4}
              />
              <Text style={styles.inlineNoticeText}>{permissionError}</Text>
            </View>
          ) : null}

          <AppButton
            label="Scan QR Code"
            leftIcon={
              <QrCode color={theme.accentStrong} size={22} strokeWidth={2.6} />
            }
            onPress={() => {
              void openScanner();
            }}
            vibe="strong"
          />
        </View>
      ) : (
        <View>
          <View style={styles.pairedNotice}>
            <CheckCircle2 color={theme.accent} size={18} strokeWidth={2.4} />
            <Text style={styles.pairedNoticeText} numberOfLines={1}>
              Controller found at {scannedDevice.host}
            </Text>
          </View>

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            onChangeText={setDeviceName}
            placeholder="e.g. Air Conditioner"
            placeholderTextColor={theme.textMuted}
            returnKeyType="done"
            selectionColor={theme.accent}
            style={styles.textInput}
            value={deviceName}
          />

          <Text style={styles.fieldLabel}>Scene</Text>
          <View style={styles.scenePillList}>
            {scenes.map((scene) => {
              const selected = selectedSceneId === scene.id;

              return (
                <TouchableOpacity
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={scene.id}
                  onPress={() => setSelectedSceneId(scene.id)}
                  style={[
                    styles.scenePill,
                    selected && styles.scenePillSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.scenePillText,
                      selected && styles.scenePillTextSelected,
                    ]}
                  >
                    {scene.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Device Type</Text>
          <View style={styles.typeRow}>
            {deviceTypeOptions.map(({ Icon, id, label, supported }) => {
              const selected = supported && selectedType === id;

              return (
                <View
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !supported, selected }}
                  key={id}
                  style={[
                    styles.typeCard,
                    selected && styles.typeCardSelected,
                    !supported && styles.typeCardDisabled,
                  ]}
                >
                  <Icon
                    color={selected ? theme.accent : theme.textSecondary}
                    size={24}
                    strokeWidth={2.2}
                  />
                  <Text
                    style={[
                      styles.typeCardText,
                      selected && styles.typeCardTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                  {supported ? null : (
                    <Text style={styles.typeCardBadge}>Soon</Text>
                  )}
                </View>
              );
            })}
          </View>

          <AppButton
            disabled={
              deviceName.trim().length === 0 || selectedSceneId.length === 0
            }
            label="Add Device"
            onPress={handleSave}
            style={styles.saveButton}
          />
        </View>
      )}

      <PairingScannerModal
        onClose={closeScanner}
        onPaired={handlePaired}
        visible={isScannerOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxxl,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xl,
    minHeight: 46,
  },
  sheetTitle: {
    color: theme.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: theme.surfaceLow,
    borderColor: theme.border,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  scanPrompt: {
    alignItems: "center",
    gap: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  scanMark: {
    alignItems: "center",
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 70,
    justifyContent: "center",
    width: 70,
  },
  scanPromptText: {
    color: theme.textSecondary,
    fontSize: theme.typography.label,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 21,
    textAlign: "center",
  },
  inlineNotice: {
    alignItems: "center",
    backgroundColor: theme.accentSubtle,
    borderColor: theme.borderStrong,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    width: "100%",
  },
  inlineNoticeText: {
    color: theme.textSecondary,
    flex: 1,
    fontSize: theme.typography.label,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 20,
  },
  pairedNotice: {
    alignItems: "center",
    backgroundColor: theme.accentSubtle,
    borderColor: theme.borderActive,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  pairedNoticeText: {
    color: theme.textSecondary,
    flex: 1,
    fontSize: theme.typography.label,
    fontWeight: "700",
    letterSpacing: 0,
  },
  fieldLabel: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
    marginBottom: theme.spacing.sm,
    textTransform: "uppercase",
  },
  textInput: {
    backgroundColor: theme.surfaceLow,
    borderColor: theme.border,
    borderRadius: 18,
    borderWidth: 1,
    color: theme.text,
    fontSize: theme.typography.body,
    fontWeight: "700",
    marginBottom: theme.spacing.lg,
    minHeight: 54,
    paddingHorizontal: theme.spacing.md,
  },
  scenePillList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  scenePill: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
  },
  scenePillSelected: {
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
  },
  scenePillText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
  },
  scenePillTextSelected: {
    color: theme.accent,
  },
  typeRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  typeCard: {
    alignItems: "center",
    backgroundColor: theme.surfaceLow,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.md,
  },
  typeCardSelected: {
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
  },
  typeCardDisabled: {
    opacity: 0.4,
  },
  typeCardText: {
    color: theme.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
  },
  typeCardTextSelected: {
    color: theme.accent,
  },
  typeCardBadge: {
    color: theme.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  saveButton: {
    alignSelf: "stretch",
  },
});
