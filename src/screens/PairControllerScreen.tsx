import { AlertCircle, QrCode, Wifi } from 'lucide-react-native';
import { useState, useCallback } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TextInput, Modal, Pressable, ActivityIndicator } from 'react-native';
import { AppButton } from '../components/AppButton';
import { theme } from '../theme/theme';
import type { RootStackScreenProps } from '../navigation/types';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { X } from 'lucide-react-native';
import { useControllers } from '../store/controllers';
import { useRooms } from '../store/rooms';
import {
  parsePairingQRCode,
  notifyPairingComplete,
  createControllerFromQRCode,
} from '../services/pairingService';

type PairControllerScreenProps = RootStackScreenProps<'PairController'>;

export function PairControllerScreen({ navigation }: PairControllerScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isPairing, setIsPairing] = useState(false);
  const [canScan, setCanScan] = useState(true);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [scannedPayload, setScannedPayload] = useState<any>(null);
  const { addController, getControllerByControllerId, updateControllerOnlineStatus } = useControllers();
  const { addRoom, getRoomById } = useRooms();

  const openScanner = useCallback(async () => {
    setPermissionError(null);

    if (!permission?.granted) {
      const nextPermission = await requestPermission();

      if (!nextPermission.granted) {
        setPermissionError('Camera permission was not granted.');
        return false;
      }
    }

    setIsScannerOpen(true);
    setCanScan(true);
    setScannerError(null);
    return true;
  }, [permission?.granted, requestPermission]);

  const closeScanner = useCallback(() => {
    setIsScannerOpen(false);
    setCanScan(true);
    setScannerError(null);
  }, []);

  const handleBarcodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (!canScan || isPairing) {
        return;
      }

      setCanScan(false);

      const payload = parsePairingQRCode(result.data);
      if (payload === null) {
        setScannerError('This is not a valid controller pairing QR code.');
        return;
      }

      const existingController = getControllerByControllerId(payload.controllerId);
      if (existingController) {
        closeScanner();

        // Navigate to the room if controller is already paired
        if (existingController.roomId) {
          const room = getRoomById(existingController.roomId);
          if (room) {
            navigation.navigate('RoomDetail', { roomId: existingController.roomId });
            return;
          }
        }

        // Fallback to main if no room
        navigation.navigate('Main');
        return;
      }

      setScannedPayload(payload);
      closeScanner();
      setShowLocationInput(true);
    },
    [canScan, isPairing, getControllerByControllerId, getRoomById, closeScanner]
  );

  const handleLocationSubmit = useCallback(async () => {
    if (!locationName.trim() || !scannedPayload) {
      return;
    }

    setIsPairing(true);

    try {
      const room = addRoom(locationName.trim());
      const controller = createControllerFromQRCode(scannedPayload, locationName.trim(), room.id);
      await addController(controller);

      void notifyPairingComplete(controller);

      // Check controller health immediately after adding
      const { controllerHealthService } = await import('../services/controllerHealthService');
      await controllerHealthService.checkController(controller, updateControllerOnlineStatus);

      setShowLocationInput(false);
      setLocationName('');
      setScannedPayload(null);

      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Main');
      }
    } catch (error) {
      console.error('Pairing failed:', error);
      setScannerError('Pairing could not be saved. Try scanning again.');
      setShowLocationInput(false);
      setLocationName('');
      setScannedPayload(null);
    } finally {
      setIsPairing(false);
    }
  }, [locationName, scannedPayload, addRoom, addController, navigation]);

  const permissionMessage = permissionError ||
    (permission === null || permission.granted ? null : 'Camera access is required to scan the ESP32 pairing QR code.');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.deviceMark}>
            <Wifi color={theme.accentBright} size={34} strokeWidth={2.25} />
          </View>

          <View style={styles.copy}>
            <Text style={styles.eyebrow}>Controller pairing</Text>
            <Text style={styles.title}>Connect your ESP32</Text>
            <Text style={styles.body}>
              Scan the QR code shown by your ESP32 controller to pair it with the app.
            </Text>
          </View>

          {permissionMessage !== null ? (
            <View style={styles.inlineNotice}>
              <AlertCircle color={theme.accentBright} size={18} strokeWidth={2.4} />
              <Text style={styles.inlineNoticeText}>{permissionMessage}</Text>
            </View>
          ) : null}

          <AppButton
            label="Scan QR Code"
            leftIcon={<QrCode size={22} strokeWidth={2.6} color={theme.accentStrong} />}
            onPress={() => {
              void openScanner();
            }}
            vibe="strong"
          />
        </View>
      </View>

      <Modal animationType="slide" onRequestClose={closeScanner} visible={isScannerOpen}>
        <View style={styles.scannerScreen}>
          <CameraView
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
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
              {scannerError !== null ? (
                <View style={styles.scannerMessage}>
                  <AlertCircle color={theme.accentBright} size={18} strokeWidth={2.4} />
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

      <Modal
        animationType="slide"
        onRequestClose={() => {
          setShowLocationInput(false);
          setLocationName('');
          setScannedPayload(null);
        }}
        transparent={true}
        visible={showLocationInput}
      >
        <View style={styles.locationModalBackdrop}>
          <View style={styles.locationModal}>
            <Text style={styles.locationTitle}>Where is this controller?</Text>
            <Text style={styles.locationSubtitle}>
              Enter the room or location name
            </Text>

            <TextInput
              autoFocus
              placeholder="Living Room"
              placeholderTextColor={theme.textMuted}
              style={styles.locationInput}
              value={locationName}
              onChangeText={setLocationName}
              editable={!isPairing}
            />

            {isPairing ? (
              <View style={styles.pairingIndicator}>
                <ActivityIndicator color={theme.accentBright} />
                <Text style={styles.pairingText}>Creating room...</Text>
              </View>
            ) : (
              <View style={styles.locationActions}>
                <AppButton
                  label="Cancel"
                  variant="secondary"
                  onPress={() => {
                    setShowLocationInput(false);
                    setLocationName('');
                    setScannedPayload(null);
                  }}
                  style={styles.locationButton}
                />
                <AppButton
                  label="Pair"
                  onPress={handleLocationSubmit}
                  disabled={!locationName.trim()}
                  vibe="strong"
                  style={styles.locationButton}
                />
              </View>
            )}
          </View>
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
    alignItems: 'center',
    backgroundColor: theme.root,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  content: {
    alignItems: 'center',
    gap: theme.spacing.xl,
    maxWidth: 420,
    width: '100%',
  },
  deviceMark: {
    alignItems: 'center',
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 82,
    justifyContent: 'center',
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
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  eyebrow: {
    color: theme.accentBright,
    fontSize: theme.typography.label,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
  },
  body: {
    color: theme.textSecondary,
    fontSize: theme.typography.body,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 24,
    textAlign: 'center',
  },
  inlineNotice: {
    alignItems: 'center',
    backgroundColor: theme.accentSubtle,
    borderColor: theme.borderStrong,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    width: '100%',
  },
  inlineNoticeText: {
    color: theme.textSecondary,
    flex: 1,
    fontSize: theme.typography.label,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 20,
  },
  scannerScreen: {
    backgroundColor: theme.root,
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
  },
  scannerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: theme.spacing.lg,
  },
  scannerTitle: {
    color: theme.text,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 0,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(11, 11, 13, 0.72)',
    borderColor: theme.borderStrong,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  scanFrame: {
    alignSelf: 'center',
    aspectRatio: 1,
    borderColor: theme.accentBright,
    borderRadius: theme.radiusMedium,
    borderWidth: 3,
    maxWidth: 310,
    width: '82%',
  },
  scannerFooter: {
    alignItems: 'center',
    minHeight: 116,
  },
  scannerHint: {
    backgroundColor: 'rgba(11, 11, 13, 0.72)',
    borderColor: theme.borderStrong,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    color: theme.text,
    fontSize: theme.typography.label,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
    overflow: 'hidden',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    textAlign: 'center',
  },
  scannerMessage: {
    alignItems: 'center',
    backgroundColor: 'rgba(11, 11, 13, 0.82)',
    borderColor: theme.borderStrong,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    width: '100%',
  },
  scannerMessageText: {
    color: theme.text,
    fontSize: theme.typography.label,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
    textAlign: 'center',
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
    fontWeight: '800',
    letterSpacing: 0,
  },
  locationModalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  locationModal: {
    backgroundColor: theme.paperBackground,
    borderColor: theme.border,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    gap: theme.spacing.lg,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  locationTitle: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
  },
  locationSubtitle: {
    color: theme.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'center',
  },
  locationInput: {
    backgroundColor: theme.controlBackground,
    borderColor: theme.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  locationActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  locationButton: {
    flex: 1,
  },
  pairingIndicator: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
  },
  pairingText: {
    color: theme.textSecondary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
  },
});
