import { AlertCircle, X } from 'lucide-react-native';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, View, TextInput, Modal, Pressable, ActivityIndicator } from 'react-native';
import { AppButton } from '../components/AppButton';
import { theme } from '../theme/theme';
import type { RootStackScreenProps } from '../navigation/types';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { useControllers } from '../store/controllers';
import { useRooms } from '../store/rooms';
import {
  parsePairingQRCode,
  notifyPairingComplete,
  createControllerFromQRCode,
  type PairingQRCodePayload,
} from '../services/pairingService';

type PairControllerScreenProps = RootStackScreenProps<'PairController'>;

export function PairControllerScreen({ navigation, route }: PairControllerScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isPairing, setIsPairing] = useState(false);
  const [canScan, setCanScan] = useState(true);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [scannedPayload, setScannedPayload] = useState<PairingQRCodePayload | null>(null);
  const { addController, getControllerByControllerId, updateControllerOnlineStatus } = useControllers();
  const { addRoom, getRoomById } = useRooms();
  const requestedCameraPermission = useRef(false);
  const targetRoomId = route.params?.roomId;
  const targetRoom = targetRoomId ? getRoomById(targetRoomId) : undefined;
  const targetRoomName = targetRoom?.name ?? route.params?.roomName;
  const pendingRoomName = targetRoomId ? undefined : route.params?.roomName;
  const pendingRoomIcon = route.params?.roomIcon;

  const ensureCameraPermission = useCallback(async () => {
    setPermissionError(null);

    if (!permission?.granted) {
      const nextPermission = await requestPermission();

      if (!nextPermission.granted) {
        setPermissionError('Camera permission was not granted.');
        return false;
      }
    }

    setCanScan(true);
    setScannerError(null);
    return true;
  }, [permission?.granted, requestPermission]);

  const closeScanner = useCallback(() => {
    setCanScan(true);
    setScannerError(null);
  }, []);

  const handleCloseScanner = useCallback(() => {
    closeScanner();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  }, [closeScanner, navigation]);

  const completePairing = useCallback(
    async (payload: PairingQRCodePayload, roomName: string, roomId: string) => {
      const controller = createControllerFromQRCode(payload, roomName, roomId);
      await addController(controller);

      void notifyPairingComplete(controller);

      const { controllerHealthService } = await import('../services/controllerHealthService');
      await controllerHealthService.checkController(controller, updateControllerOnlineStatus);

      return controller;
    },
    [addController, updateControllerOnlineStatus]
  );

  useEffect(() => {
    if (requestedCameraPermission.current) {
      return;
    }

    requestedCameraPermission.current = true;
    void ensureCameraPermission();
  }, [ensureCameraPermission]);

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

      setScannerError(null);

      if (targetRoomId && targetRoomName) {
        setIsPairing(true);

        try {
          await completePairing(payload, targetRoomName, targetRoomId);
          navigation.replace('RoomDetail', { roomId: targetRoomId });
        } catch (error) {
          console.error('Pairing failed:', error);
          setCanScan(true);
          Alert.alert('Pairing Failed', 'Pairing could not be saved. Try scanning again.');
        } finally {
          setIsPairing(false);
        }
        return;
      }

      if (pendingRoomName) {
        setIsPairing(true);

        try {
          const room = addRoom(pendingRoomName, pendingRoomIcon);
          await completePairing(payload, pendingRoomName, room.id);
          navigation.replace('RoomDetail', { roomId: room.id });
        } catch (error) {
          console.error('Pairing failed:', error);
          setCanScan(true);
          Alert.alert('Pairing Failed', 'Pairing could not be saved. Try scanning again.');
        } finally {
          setIsPairing(false);
        }
        return;
      }

      setScannedPayload(payload);
      setLocationName('');
      setShowLocationInput(true);
    },
    [
      canScan,
      closeScanner,
      completePairing,
      getControllerByControllerId,
      getRoomById,
      isPairing,
      navigation,
      pendingRoomIcon,
      pendingRoomName,
      targetRoomId,
      targetRoomName,
    ]
  );

  const handleLocationSubmit = useCallback(async () => {
    if (!locationName.trim() || !scannedPayload) {
      return;
    }

    setIsPairing(true);

    try {
      const room = addRoom(locationName.trim());
      await completePairing(scannedPayload, locationName.trim(), room.id);

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
  }, [locationName, scannedPayload, addRoom, completePairing, navigation]);

  const permissionMessage =
    permissionError ||
    (permission === null || permission.granted
      ? null
      : 'Camera access is required to scan the ESP32 pairing QR code.');
  const canUseCamera = permission?.granted === true;

  return (
    <SafeAreaView style={styles.safeArea}>
      {canUseCamera ? (
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
                onPress={handleCloseScanner}
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
      ) : (
        <View style={styles.permissionScreen}>
          {permissionMessage === null ? (
            <ActivityIndicator color={theme.accentBright} />
          ) : (
            <>
              <View style={styles.inlineNotice}>
                <AlertCircle color={theme.accentBright} size={18} strokeWidth={2.4} />
                <Text style={styles.inlineNoticeText}>{permissionMessage}</Text>
              </View>
              <View style={styles.permissionActions}>
                <AppButton
                  label="Back"
                  onPress={handleCloseScanner}
                  style={styles.permissionButton}
                  variant="secondary"
                />
                <AppButton
                  label="Try Again"
                  onPress={() => {
                    void ensureCameraPermission();
                  }}
                  style={styles.permissionButton}
                  vibe="strong"
                />
              </View>
            </>
          )}
        </View>
      )}

      <Modal
        animationType="slide"
        onRequestClose={() => {
          setCanScan(true);
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
                    setCanScan(true);
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
  permissionScreen: {
    alignItems: 'center',
    backgroundColor: theme.root,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  permissionActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    width: '100%',
  },
  permissionButton: {
    flex: 1,
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
