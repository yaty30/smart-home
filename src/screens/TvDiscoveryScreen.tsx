import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Tv, WifiOff, AlertCircle, CheckCircle2, ChevronLeft } from 'lucide-react-native';
import { useTheme, type Theme } from '../theme/theme';
import type { RootStackScreenProps } from '../navigation/types';
import type { DiscoveredTv, TvPairingState } from '../domain/tv';
import { tvService } from '../services/tvService';
import { AppButton } from '../components/AppButton';
import { createDevice, type DeviceBrand } from '../domain/device';
import { useDevices } from '../store/devices';
import { useControllers } from '../store/controllers';
import { AppHeader, HeaderIconButton } from '../components/AppHeader';

type TvDiscoveryScreenProps = RootStackScreenProps<'TvDiscovery'>;

type ScreenState =
  | 'idle'
  | 'discovering'
  | 'results'
  | 'no_results'
  | 'error'
  | 'pairing'
  | 'pairing_pin'
  | 'pairing_waiting'
  | 'pairing_success'
  | 'pairing_failed';

export function TvDiscoveryScreen({ navigation, route }: TvDiscoveryScreenProps) {
  const { roomId, controllerId } = route.params;
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { addDevice, getDevicesByController } = useDevices();
  const { getControllerById } = useControllers();
  const discoveryPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discoveryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const controller = getControllerById(controllerId);

  const [state, setState] = useState<ScreenState>('idle');
  const [discoveredTvs, setDiscoveredTvs] = useState<DiscoveredTv[]>([]);
  const [selectedTv, setSelectedTv] = useState<DiscoveredTv | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [pinCode, setPinCode] = useState('');
  const [submittingPin, setSubmittingPin] = useState(false);

  const stopDiscoveryPolling = useCallback(() => {
    if (discoveryPollRef.current !== null) {
      clearInterval(discoveryPollRef.current);
      discoveryPollRef.current = null;
    }

    if (discoveryTimeoutRef.current !== null) {
      clearTimeout(discoveryTimeoutRef.current);
      discoveryTimeoutRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    stopDiscoveryPolling();
    tvService.cleanup();
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, stopDiscoveryPolling]);

  const startDiscovery = useCallback(async () => {
    if (!controller) {
      setState('error');
      setErrorMessage('Controller not found');
      return;
    }

    stopDiscoveryPolling();
    setState('discovering');
    setDiscoveredTvs([]);
    setErrorMessage('');

    try {
      await tvService.startDiscovery(controller);

      const pollDiscoveryStatus = async () => {
        try {
          const status = await tvService.getDiscoveryStatus(controller);
          console.log(
            `[TvDiscovery] scanning=${status.scanning} devices=${status.devices.length}`,
          );

          if (status.devices.length > 0) {
            setDiscoveredTvs(status.devices);
            setState('results');
          } else if (!status.scanning) {
            setState('no_results');
          }

          if (!status.scanning) {
            stopDiscoveryPolling();
          }
        } catch (error) {
          console.warn('Discovery status poll failed:', error);
        }
      };

      await pollDiscoveryStatus();
      discoveryPollRef.current = setInterval(() => {
        void pollDiscoveryStatus();
      }, 1000);

      // Timeout after 10 seconds
      discoveryTimeoutRef.current = setTimeout(() => {
        stopDiscoveryPolling();
        void tvService.getDiscoveryStatus(controller).then((status) => {
          console.log(
            `[TvDiscovery] timeout scanning=${status.scanning} devices=${status.devices.length}`,
          );
          if (status.devices.length > 0) {
            setDiscoveredTvs(status.devices);
            setState('results');
          } else {
            setState('no_results');
          }
        });
      }, 10000);
    } catch (error) {
      stopDiscoveryPolling();
      setState('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Discovery failed'
      );
    }
  }, [controller, stopDiscoveryPolling]);

  const startPairing = useCallback(
    async (tv: DiscoveredTv) => {
      if (!controller) {
        setState('error');
        setErrorMessage('Controller not found');
        return;
      }

      // Check for duplicate
      const existingDevices = getDevicesByController(controllerId);
      const duplicate = existingDevices.find(
        (d) => d.type === 'tv' && d.controllerDeviceId === tv.id
      );

      if (duplicate) {
        setState('pairing_failed');
        setErrorMessage('This TV is already paired');
        return;
      }

      setSelectedTv(tv);
      setPinCode('');
      setState('pairing');

      try {
        try {
          await tvService.startPairing(controller, tv.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (!message.includes('already paired')) {
            throw error;
          }

          console.log('[TvDiscovery] Removing stale ESP32 TV pairing');
          await tvService.unpairTv(controller, tv.id);
          await tvService.startPairing(controller, tv.id);
        }

        setState('pairing_waiting');

        // Poll pairing status
        tvService.startPairingStatusPolling(
          controller,
          (pairingState: TvPairingState) => {
            if (pairingState === 'waiting_for_pin') {
              setState('pairing_pin');
            } else if (pairingState === 'waiting_for_approval') {
              setState('pairing_waiting');
            } else if (pairingState === 'paired') {
              setState('pairing_success');
              tvService.stopPairingStatusPolling();

              // Complete pairing and create device
              tvService
                .completePairing(controller, tv.name)
                .then(async () => {
                  const device = createDevice(
                    tv.name,
                    roomId,
                    controllerId,
                    'tv',
                    tv.brand.toLowerCase() as DeviceBrand,
                    'network',
                    tv.id
                  );

                  device.capabilities = {
                    power: true,
                  };
                  device.state = { syncStatus: 'synced' };

                  await addDevice(device);

                  // Navigate to device control after short delay
                  setTimeout(() => {
                    navigation.replace('DeviceControl', { deviceId: device.id });
                  }, 1500);
                })
                .catch((error) => {
                  console.error('Pairing completion failed:', error);
                  setState('pairing_failed');
                  setErrorMessage(
                    error instanceof Error
                      ? error.message
                      : 'Failed to complete pairing'
                  );
                });
            } else if (pairingState === 'failed') {
              setState('pairing_failed');
              setErrorMessage('Pairing was declined or timed out');
              tvService.stopPairingStatusPolling();
            }
          }
        );
      } catch (error) {
        setState('pairing_failed');
        setErrorMessage(
          error instanceof Error ? error.message : 'Pairing failed'
        );
      }
    },
    [controller, controllerId, roomId, addDevice, navigation, getDevicesByController]
  );

  const submitPin = useCallback(async () => {
    if (!controller || !selectedTv) {
      return;
    }

    const trimmedPin = pinCode.trim();
    if (!trimmedPin) {
      return;
    }

    setSubmittingPin(true);
    setErrorMessage('');

    try {
      await tvService.submitPairingPin(controller, trimmedPin);
      setState('pairing_waiting');
    } catch (error) {
      setState('pairing_failed');
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to submit pairing code',
      );
    } finally {
      setSubmittingPin(false);
    }
  }, [controller, pinCode, selectedTv]);

  useEffect(() => {
    void startDiscovery();

    return () => {
      stopDiscoveryPolling();
      tvService.cleanup();
    };
  }, [startDiscovery, stopDiscoveryPolling]);

  const renderContent = () => {
    switch (state) {
      case 'idle':
      case 'discovering':
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={styles.statusText}>Searching for TVs...</Text>
            <Text style={styles.statusSubtext}>
              Make sure your TV is powered on and connected to the same network
            </Text>
          </View>
        );

      case 'no_results':
        return (
          <View style={styles.centerContent}>
            <WifiOff size={48} color={theme.textSecondary} />
            <Text style={styles.statusText}>No TVs found</Text>
            <Text style={styles.statusSubtext}>
              Make sure your TV is on the same network and supports network
              control
            </Text>
            <AppButton label="Scan Again" onPress={startDiscovery} />
          </View>
        );

      case 'error':
        return (
          <View style={styles.centerContent}>
            <AlertCircle size={48} color={theme.textSecondary} />
            <Text style={styles.statusText}>Discovery Failed</Text>
            <Text style={styles.statusSubtext}>{errorMessage}</Text>
            <AppButton label="Try Again" onPress={startDiscovery} />
          </View>
        );

      case 'results':
        return (
          <ScrollView style={styles.resultsList}>
            <Text style={styles.resultsHeader}>
              Found {discoveredTvs.length} TV{discoveredTvs.length !== 1 ? 's' : ''}
            </Text>
            {discoveredTvs.map((tv) => (
              <TouchableOpacity
                key={tv.id}
                style={styles.tvCard}
                onPress={() => startPairing(tv)}
                activeOpacity={0.7}
              >
                <Tv size={32} color={theme.accent} />
                <View style={styles.tvInfo}>
                  <Text style={styles.tvName}>{tv.name}</Text>
                  <Text style={styles.tvDetails}>
                    {tv.brand}
                    {tv.model ? ` · ${tv.model}` : ''}
                  </Text>
                  <Text style={styles.tvIp}>{tv.ip}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <AppButton
              label="Scan Again"
              onPress={startDiscovery}
              variant="secondary"
            />
          </ScrollView>
        );

      case 'pairing':
      case 'pairing_waiting':
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={styles.statusText}>
              {state === 'pairing' ? 'Connecting...' : 'Waiting for approval'}
            </Text>
            {state === 'pairing_waiting' && selectedTv && (
              <>
                <Text style={styles.statusSubtext}>
                  Accept the connection request on your {selectedTv.brand} TV
                </Text>
                <View style={styles.tvPreview}>
                  <Text style={styles.tvPreviewName}>{selectedTv.name}</Text>
                  <Text style={styles.tvPreviewIp}>{selectedTv.ip}</Text>
                </View>
              </>
            )}
          </View>
        );

      case 'pairing_pin':
        return (
          <View style={styles.centerContent}>
            <Tv size={48} color={theme.accent} />
            <Text style={styles.statusText}>Enter TV Code</Text>
            <Text style={styles.statusSubtext}>
              Type the code shown on your {selectedTv?.brand ?? 'LG'} TV
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              maxLength={8}
              onChangeText={setPinCode}
              onSubmitEditing={submitPin}
              placeholder="000000"
              placeholderTextColor={theme.textMuted}
              returnKeyType="done"
              style={styles.pinInput}
              value={pinCode}
            />
            <AppButton
              disabled={pinCode.trim().length === 0 || submittingPin}
              label={submittingPin ? 'Submitting' : 'Connect'}
              onPress={submitPin}
            />
          </View>
        );

      case 'pairing_success':
        return (
          <View style={styles.centerContent}>
            <CheckCircle2 size={64} color={theme.accent} />
            <Text style={styles.statusText}>TV Paired!</Text>
            <Text style={styles.statusSubtext}>
              Your TV has been successfully connected
            </Text>
          </View>
        );

      case 'pairing_failed':
        return (
          <View style={styles.centerContent}>
            <AlertCircle size={48} color={theme.textSecondary} />
            <Text style={styles.statusText}>Pairing Failed</Text>
            <Text style={styles.statusSubtext}>{errorMessage}</Text>
            <AppButton label="Back to Results" onPress={() => setState('results')} />
          </View>
        );

      default:
        return null;
    }
  };

  if (!controller) {
    return (
      <View style={styles.container}>
        <AppHeader
          leftAction={
            <HeaderIconButton accessibilityLabel="Back" onPress={handleCancel}>
              <ChevronLeft color={theme.accent} size={26} strokeWidth={2.35} />
            </HeaderIconButton>
          }
          title="Add TV"
        />
        <View style={styles.centerContent}>
          <Text style={styles.statusText}>Controller not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        leftAction={
          state !== 'pairing_success' ? (
            <HeaderIconButton accessibilityLabel="Back" onPress={handleCancel}>
              <ChevronLeft color={theme.accent} size={26} strokeWidth={2.35} />
            </HeaderIconButton>
          ) : undefined
        }
        title="Add TV"
      />
      {renderContent()}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.paperBackground,
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    statusText: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginTop: 16,
      textAlign: 'center',
    },
    statusSubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
      maxWidth: 300,
      marginBottom: 24,
    },
    resultsList: {
      flex: 1,
      padding: 24,
    },
    resultsHeader: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 16,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    tvCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surfaceLow,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tvInfo: {
      flex: 1,
      marginLeft: 16,
    },
    tvName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    tvDetails: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    tvIp: {
      fontSize: 12,
      color: theme.textSecondary,
      fontFamily: 'monospace',
    },
    tvPreview: {
      backgroundColor: theme.surfaceLow,
      borderRadius: 8,
      padding: 16,
      marginTop: 16,
      alignItems: 'center',
    },
    tvPreviewName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    tvPreviewIp: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
      fontFamily: 'monospace',
    },
    pinInput: {
      backgroundColor: theme.surfaceLow,
      borderColor: theme.border,
      borderRadius: 14,
      borderWidth: 1,
      color: theme.text,
      fontSize: 24,
      fontWeight: '800',
      height: 58,
      letterSpacing: 0,
      marginBottom: 16,
      paddingHorizontal: 18,
      textAlign: 'center',
      width: 180,
    },
  });
