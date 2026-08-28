import {
  type BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { AlertCircle, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { type Theme, useTheme } from "../theme/theme";
import type { PairedDevice } from "../types/device";
import {
  notifyPairingComplete,
  parsePairedDeviceQRCode,
} from "../utils/devicePairing";

/**
 * Shared camera-permission + scanner-visibility state for screens that
 * pair a device by scanning its QR code.
 */
export function usePairingScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const openScanner = useCallback(async () => {
    setPermissionError(null);

    if (!permission?.granted) {
      const nextPermission = await requestPermission();

      if (!nextPermission.granted) {
        setPermissionError("Camera permission was not granted.");
        return false;
      }
    }

    setIsScannerOpen(true);
    return true;
  }, [permission?.granted, requestPermission]);

  const closeScanner = useCallback(() => {
    setIsScannerOpen(false);
  }, []);

  return {
    closeScanner,
    isScannerOpen,
    openScanner,
    permission,
    permissionError,
  };
}

type PairingScannerModalProps = {
  visible: boolean;
  onClose: () => void;
  onPaired?: (device: PairedDevice) => void;
};

export function PairingScannerModal({
  onClose,
  onPaired,
  visible,
}: PairingScannerModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { pairDevice } = useDeviceConnection();
  const [isPairing, setIsPairing] = useState(false);
  const [canScan, setCanScan] = useState(true);
  const [scannerError, setScannerError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCanScan(true);
      setIsPairing(false);
      setScannerError(null);
    }
  }, [visible]);

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
        void notifyPairingComplete(pairedDevice);
        onPaired?.(pairedDevice);
        onClose();
      } catch {
        setScannerError("Pairing could not be saved. Try scanning again.");
        setCanScan(true);
      } finally {
        setIsPairing(false);
      }
    },
    [canScan, isPairing, onClose, onPaired, pairDevice],
  );

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
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
              onPress={onClose}
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
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
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
    marginHorizontal: theme.spacing.lg
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
