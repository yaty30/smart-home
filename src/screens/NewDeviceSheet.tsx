import * as Haptics from "expo-haptics";
import {
  AirVent,
  AlertCircle,
  Lightbulb,
  QrCode,
  Tv,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollView,
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
  id: HomeDeviceType;
  label: string;
  Icon: typeof AirVent;
}[] = [
  { Icon: AirVent, id: "ac", label: "Air Conditioner" },
  { Icon: Lightbulb, id: "light", label: "Light" },
  { Icon: Tv, id: "tv", label: "TV" },
];

export function NewDeviceSheet({
  navigation,
}: RootStackScreenProps<"NewDevice">) {
  const { addDevice, scenes } = useHomeData();
  const {
    closeScanner,
    isScannerOpen,
    openScanner,
    permissionError,
  } = usePairingScanner();
  const [scannedDevice, setScannedDevice] = useState<PairedDevice | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [selectedSceneId, setSelectedSceneId] = useState<string>(
    scenes[0]?.id ?? "",
  );
  const [selectedType, setSelectedType] = useState<HomeDeviceType>("ac");
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

  const handlePaired = useCallback((device: PairedDevice) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setScannedDevice(device);
  }, []);

  const handleSave = useCallback(() => {
    const trimmedName = deviceName.trim();

    if (trimmedName.length === 0 || selectedSceneId.length === 0) {
      return;
    }

    addDevice({
      name: trimmedName,
      sceneId: selectedSceneId,
      type: selectedType,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  }, [addDevice, deviceName, navigation, selectedSceneId, selectedType]);

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
              <QrCode
                color={theme.accentStrong}
                size={22}
                strokeWidth={2.6}
              />
            }
            onPress={() => {
              void openScanner();
            }}
            vibe="strong"
          />
        </View>
      ) : (
        <View>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            autoFocus
            onChangeText={setDeviceName}
            placeholder="e.g. Air Conditioner"
            placeholderTextColor={theme.textMuted}
            returnKeyType="done"
            selectionColor={theme.accent}
            style={styles.textInput}
            value={deviceName}
          />

          <Text style={styles.fieldLabel}>Scene</Text>
          <ScrollView
            horizontal
            contentContainerStyle={styles.scenePillList}
            showsHorizontalScrollIndicator={false}
            style={styles.scenePillScroll}
          >
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
          </ScrollView>

          <Text style={styles.fieldLabel}>Device Type</Text>
          <View style={styles.typeRow}>
            {deviceTypeOptions.map(({ Icon, id, label }) => {
              const selected = selectedType === id;

              return (
                <TouchableOpacity
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={id}
                  onPress={() => setSelectedType(id)}
                  style={[styles.typeCard, selected && styles.typeCardSelected]}
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
                </TouchableOpacity>
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
    paddingTop: theme.spacing.lg,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.lg,
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
  scenePillScroll: {
    flexGrow: 0,
    marginBottom: theme.spacing.lg,
  },
  scenePillList: {
    gap: theme.spacing.sm,
  },
  scenePill: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
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
  saveButton: {
    alignSelf: "stretch",
  },
});
