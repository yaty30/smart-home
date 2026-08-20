import {
  type BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { AlertCircle, QrCode, Wifi, X } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useDeviceConnection } from "../context/DeviceConnectionContext";
import { theme } from "../theme/theme";
import type { PairedDevice } from "../types/device";

const parsePairedDeviceQRCode = (data: string): PairedDevice | null => {
  try {
    const parsedPayload = JSON.parse(data) as unknown;

    if (typeof parsedPayload !== "object" || parsedPayload === null) {
      return null;
    }

    const candidate = parsedPayload as Partial<PairedDevice>;
    const host = candidate.host?.trim();
    const token = candidate.token?.trim();

    if (!host || !token) {
      return null;
    }

    const parsedHost = new URL(host);
    if (parsedHost.protocol !== "http:" && parsedHost.protocol !== "https:") {
      return null;
    }

    return {
      host,
      token,
    };
  } catch {
    return null;
  }
};

const notifyPairingComplete = async (device: PairedDevice) => {
  const host = device.host.replace(/\/+$/, "");

  try {
    const response = await fetch(`${host}/pair/complete`, {
      headers: {
        Authorization: `Bearer ${device.token}`,
      },
      method: "POST",
    });

    if (!response.ok) {
      console.warn("ESP32 pair completion returned", response.status);
    }
  } catch (error) {
    console.warn(
      "Pairing completed locally, but ESP32 display update failed.",
      error,
    );
  }
};

export function ConnectDeviceScreen() {
  const { pairDevice } = useDeviceConnection();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [canScan, setCanScan] = useState(true);
  const [scannerError, setScannerError] = useState<string | null>(null);

  const permissionMessage = useMemo(() => {
    if (permission === null || permission.granted) {
      return null;
    }

    return "Camera access is required to scan the ESP32 pairing QR code.";
  }, [permission]);

  const openScanner = useCallback(async () => {
    setScannerError(null);
    setCanScan(true);

    if (!permission?.granted) {
      const nextPermission = await requestPermission();

      if (!nextPermission.granted) {
        setScannerError("Camera permission was not granted.");
        return;
      }
    }

    setIsScannerOpen(true);
  }, [permission?.granted, requestPermission]);

  const closeScanner = useCallback(() => {
    setIsScannerOpen(false);
    setScannerError(null);
    setCanScan(true);
    setIsPairing(false);
  }, []);

  const handleBarcodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (!canScan || isPairing) {
        return;
      }

      setCanScan(false);

      const pairedDevice = parsePairedDeviceQRCode(result.data);
      if (pairedDevice === null) {
        setScannerError("This is not a valid Smart Home pairing QR code.");
        return;
      }

      setScannerError(null);
      setIsPairing(true);

      try {
        await pairDevice(pairedDevice);
        setIsScannerOpen(false);
        void notifyPairingComplete(pairedDevice);
      } catch {
        setScannerError("Pairing could not be saved. Try scanning again.");
        setCanScan(true);
      } finally {
        setIsPairing(false);
      }
    },
    [canScan, isPairing, pairDevice],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.deviceMark}>
            <Wifi color={theme.accentBright} size={34} strokeWidth={2.25} />
          </View>

          <View style={styles.copy}>
            <Text style={styles.eyebrow}>Device pairing</Text>
            <Text style={styles.title}>Connect your air conditioner</Text>
            <Text style={styles.body}>
              Scan the QR code shown by your ESP32 controller to pair this app
              with the device.
            </Text>
          </View>

          {permissionMessage !== null ? (
            <View style={styles.inlineNotice}>
              <AlertCircle
                color={theme.accentBright}
                size={18}
                strokeWidth={2.4}
              />
              <Text style={styles.inlineNoticeText}>{permissionMessage}</Text>
            </View>
          ) : null}

          {scannerError !== null && !isScannerOpen ? (
            <View style={styles.inlineNotice}>
              <AlertCircle
                color={theme.accentBright}
                size={18}
                strokeWidth={2.4}
              />
              <Text style={styles.inlineNoticeText}>{scannerError}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan QR code"
            onPress={openScanner}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <QrCode color={theme.root} size={22} strokeWidth={2.6} />
            <Text style={styles.primaryButtonText}>Scan QR Code</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={closeScanner}
        visible={isScannerOpen}
      >
        <View style={styles.scannerScreen}>
          <CameraView
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={canScan ? handleBarcodeScanned : undefined}
            style={StyleSheet.absoluteFill}
          />

          <SafeAreaView style={styles.scannerOverlay}>
            <View style={styles.scannerHeader}>
              <Text style={styles.scannerTitle}>Scan pairing QR</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close scanner"
                onPress={closeScanner}
                style={styles.closeButton}
              >
                <X color={theme.text} size={22} strokeWidth={2.5} />
              </Pressable>
            </View>

            <View style={styles.scanFrame} />

            <View style={styles.scannerFooter}>
              {isPairing ? (
                <View style={styles.scannerMessage}>
                  <ActivityIndicator color={theme.accentBright} />
                  <Text style={styles.scannerMessageText}>Saving device...</Text>
                </View>
              ) : scannerError !== null ? (
                <View style={styles.scannerMessage}>
                  <AlertCircle
                    color={theme.accentBright}
                    size={18}
                    strokeWidth={2.4}
                  />
                  <Text style={styles.scannerMessageText}>{scannerError}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Scan again"
                    onPress={() => {
                      setScannerError(null);
                      setCanScan(true);
                    }}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Scan Again</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.scannerHint}>
                  Align the ESP32 pairing QR code inside the frame.
                </Text>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.root,
    flex: 1,
  },
  screen: {
    alignItems: "center",
    backgroundColor: theme.root,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  content: {
    alignItems: "center",
    gap: theme.spacing.xl,
    maxWidth: 420,
    width: "100%",
  },
  deviceMark: {
    alignItems: "center",
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 82,
    justifyContent: "center",
    shadowColor: theme.accent,
    shadowOffset: {
      height: 12,
      width: 0,
    },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    width: 82,
  },
  copy: {
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  eyebrow: {
    color: theme.accentBright,
    fontSize: theme.typography.label,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: theme.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
  },
  body: {
    color: theme.textSecondary,
    fontSize: theme.typography.body,
    fontWeight: "500",
    letterSpacing: 0,
    lineHeight: 24,
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
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.accentBright,
    borderRadius: theme.radiusRound,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    minHeight: 58,
    paddingHorizontal: theme.spacing.xl,
    shadowColor: theme.accent,
    shadowOffset: {
      height: 12,
      width: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    width: "100%",
  },
  primaryButtonPressed: {
    backgroundColor: theme.accent,
  },
  primaryButtonText: {
    color: theme.root,
    fontSize: theme.typography.body,
    fontWeight: "800",
    letterSpacing: 0,
  },
  scannerScreen: {
    backgroundColor: theme.root,
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
  },
  scannerHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  scannerTitle: {
    color: theme.text,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 0,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "rgba(11, 11, 13, 0.72)",
    borderColor: theme.borderStrong,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  scanFrame: {
    alignSelf: "center",
    aspectRatio: 1,
    borderColor: theme.accentBright,
    borderRadius: theme.radiusMedium,
    borderWidth: 3,
    maxWidth: 310,
    width: "82%",
  },
  scannerFooter: {
    alignItems: "center",
    minHeight: 116,
  },
  scannerHint: {
    backgroundColor: "rgba(11, 11, 13, 0.72)",
    borderColor: theme.borderStrong,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    color: theme.text,
    fontSize: theme.typography.label,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 20,
    overflow: "hidden",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    textAlign: "center",
  },
  scannerMessage: {
    alignItems: "center",
    backgroundColor: "rgba(11, 11, 13, 0.82)",
    borderColor: theme.borderStrong,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    width: "100%",
  },
  scannerMessageText: {
    color: theme.text,
    fontSize: theme.typography.label,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 20,
    textAlign: "center",
  },
  secondaryButton: {
    backgroundColor: theme.paperBackgroundElevated,
    borderColor: theme.borderStrong,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  secondaryButtonText: {
    color: theme.text,
    fontSize: theme.typography.label,
    fontWeight: "800",
    letterSpacing: 0,
  },
});
