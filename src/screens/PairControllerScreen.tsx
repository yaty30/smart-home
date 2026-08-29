import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CheckCircle2, RefreshCw, Settings, Wifi } from 'lucide-react-native';
import { AppButton } from '../components/AppButton';
import { SETUP_AP_PASSWORD, SETUP_AP_PREFIX } from '../config/provisioning';
import { createController, type Controller } from '../domain/controller';
import type { RootStackScreenProps } from '../navigation/types';
import {
  fetchSetupInfo,
  fetchSetupNetworks,
  sendSetupWifi,
  setupControllerLabel,
  setupShortIdFromSSID,
  type SetupInfo,
  type SetupNetwork,
  type SetupWifiResult,
} from '../services/controllerProvisioningService';
import { fetchControllerStatus } from '../services/controllerStatusService';
import { notifyPairingComplete } from '../services/pairingService';
import { useControllers } from '../store/controllers';
import { useDevices } from '../store/devices';
import { useRooms } from '../store/rooms';
import { type Theme, useTheme } from '../theme/theme';

type PairControllerScreenProps = RootStackScreenProps<'PairController'>;

const normalizeControllerHost = (value: string): string | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return `${url.protocol}//${url.host}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
};

const controllerIdFromHost = (host: string) => {
  try {
    return `manual-${new URL(host).hostname.replace(/[^a-zA-Z0-9-]/g, '-')}`;
  } catch {
    return `manual-${Date.now()}`;
  }
};

export function PairControllerScreen({
  navigation,
  route,
}: PairControllerScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    addController,
    controllers,
    getControllerByControllerId,
    updateControllerConnectionStatus,
  } = useControllers();
  const { applyControllerDeviceStatus } = useDevices();
  const { addRoom, getRoomById } = useRooms();

  const [controllerName, setControllerName] = useState('');
  const [setupSsidInput, setSetupSsidInput] = useState('');
  const [setupInfo, setSetupInfo] = useState<SetupInfo | null>(null);
  const [setupNetworks, setSetupNetworks] = useState<SetupNetwork[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<SetupNetwork | null>(
    null,
  );
  const [homeWifiPassword, setHomeWifiPassword] = useState('');
  const [provisionedResult, setProvisionedResult] =
    useState<SetupWifiResult | null>(null);
  const [isCheckingSetup, setIsCheckingSetup] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isVerifyingProvisioned, setIsVerifyingProvisioned] = useState(false);

  const [hostInput, setHostInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [isManualConnecting, setIsManualConnecting] = useState(false);

  const requestedRoomName = route.params?.roomName?.trim() || undefined;
  const roomId = route.params?.roomId;
  const existingRoom = roomId ? getRoomById(roomId) : undefined;
  const defaultControllerName =
    controllerName.trim() ||
    `${existingRoom?.name ?? requestedRoomName ?? 'Room'} Controller`;
  const canConnectManually =
    hostInput.trim().length > 0 &&
    tokenInput.trim().length > 0 &&
    !isManualConnecting;
  const canProvision =
    setupInfo !== null &&
    selectedNetwork !== null &&
    !isProvisioning &&
    !isCheckingSetup;

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  }, [navigation]);

  const handleOpenSettings = useCallback(() => {
    void Linking.openSettings().catch(() => {
      Alert.alert('Settings Unavailable', 'Open Wi-Fi settings manually.');
    });
  }, []);

  const resolvePairedRoom = useCallback(
    (controller?: Controller) => {
      if (controller?.roomId) {
        const controllerRoom = getRoomById(controller.roomId);
        if (controllerRoom) {
          return controllerRoom;
        }
      }

      return (
        existingRoom ??
        addRoom(requestedRoomName ?? 'New Room', route.params?.roomIcon)
      );
    },
    [addRoom, existingRoom, getRoomById, requestedRoomName, route.params?.roomIcon],
  );

  const saveConnectedController = useCallback(
    async (controller: Controller) => {
      const snapshot = await fetchControllerStatus(controller);
      await addController(controller);
      updateControllerConnectionStatus(controller.id, 'online');
      applyControllerDeviceStatus(controller.id, snapshot);
      void notifyPairingComplete(controller);

      Alert.alert('Controller Connected', `${controller.name} is connected.`, [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Main'),
        },
      ]);
    },
    [
      addController,
      applyControllerDeviceStatus,
      navigation,
      updateControllerConnectionStatus,
    ],
  );

  const handleCheckSetupController = useCallback(async () => {
    setIsCheckingSetup(true);
    setProvisionedResult(null);
    setSetupNetworks([]);
    setSelectedNetwork(null);

    try {
      const info = await fetchSetupInfo();
      const expectedShortId = setupShortIdFromSSID(setupSsidInput);
      if (expectedShortId !== null && expectedShortId !== info.shortId) {
        Alert.alert(
          'Different Controller Connected',
          `The phone reached ${setupControllerLabel(
            info.shortId,
          )}, not ${setupControllerLabel(expectedShortId)}.`,
        );
        return;
      }

      if (!info.setupMode) {
        Alert.alert(
          'Controller Already Configured',
          'This controller is not currently in setup mode.',
        );
        return;
      }

      setSetupInfo(info);
      const networks = await fetchSetupNetworks();
      setSetupNetworks(networks);
      setSelectedNetwork(networks[0] ?? null);
    } catch (error) {
      Alert.alert(
        'Setup Controller Not Found',
        `Connect to a Wi-Fi network named ${SETUP_AP_PREFIX}XXXXXX, then try again.`,
      );
    } finally {
      setIsCheckingSetup(false);
    }
  }, [setupSsidInput]);

  const handleProvision = useCallback(async () => {
    if (selectedNetwork === null) {
      return;
    }

    setIsProvisioning(true);
    setProvisionedResult(null);

    try {
      const result = await sendSetupWifi(
        selectedNetwork.ssid,
        homeWifiPassword,
      );
      if (setupInfo !== null && result.controllerId !== setupInfo.controllerId) {
        throw new Error('Provisioned controller identity changed');
      }
      setProvisionedResult(result);
      Alert.alert(
        'Wi-Fi Saved',
        'Return your phone to the normal Wi-Fi network, then verify the controller.',
      );
    } catch (error) {
      Alert.alert(
        'Wi-Fi Setup Failed',
        error instanceof Error
          ? error.message
          : 'The controller could not join that Wi-Fi network.',
      );
    } finally {
      setIsProvisioning(false);
    }
  }, [homeWifiPassword, selectedNetwork, setupInfo]);

  const handleVerifyProvisionedController = useCallback(async () => {
    if (provisionedResult === null) {
      return;
    }

    const host = normalizeControllerHost(provisionedResult.ip);
    if (host === null) {
      Alert.alert('Invalid Controller IP', 'The controller returned an invalid IP.');
      return;
    }

    const duplicateIP = controllers.find(
      (controller) =>
        controller.controllerId !== provisionedResult.controllerId &&
        controller.ip.replace(/\/+$/, '') === host,
    );
    if (duplicateIP) {
      Alert.alert(
        'Controller Already Added',
        `${duplicateIP.name} is already using ${host}.`,
      );
      return;
    }

    setIsVerifyingProvisioned(true);

    try {
      const existingController = getControllerByControllerId(
        provisionedResult.controllerId,
      );
      const pairedRoom = resolvePairedRoom(existingController);
      const baseController =
        existingController ??
        createController(
          provisionedResult.controllerId,
          defaultControllerName,
          host,
          provisionedResult.token,
          pairedRoom.id,
        );
      const connectedController: Controller = {
        ...baseController,
        controllerId: provisionedResult.controllerId,
        connectionStatus: 'online',
        ip: host,
        name:
          controllerName.trim() ||
          existingController?.name ||
          defaultControllerName,
        online: true,
        roomId: pairedRoom.id,
        token: provisionedResult.token,
      };

      await saveConnectedController(connectedController);
    } catch (error) {
      Alert.alert(
        'Verification Failed',
        'Make sure your phone is back on the normal Wi-Fi network, then try again.',
      );
    } finally {
      setIsVerifyingProvisioned(false);
    }
  }, [
    controllerName,
    controllers,
    defaultControllerName,
    getControllerByControllerId,
    provisionedResult,
    resolvePairedRoom,
    saveConnectedController,
  ]);

  const handleManualConnect = useCallback(async () => {
    const host = normalizeControllerHost(hostInput);
    const token = tokenInput.trim();

    if (host === null) {
      Alert.alert('Invalid IP Address', 'Enter a valid ESP32 address.');
      return;
    }

    if (token.length === 0) {
      Alert.alert('Token Required', 'Enter the controller token.');
      return;
    }

    const duplicateController = controllers.find(
      (controller) => controller.ip.replace(/\/+$/, '') === host,
    );
    if (duplicateController) {
      Alert.alert(
        'Controller Already Added',
        `${duplicateController.name} is already using ${host}.`,
      );
      return;
    }

    setIsManualConnecting(true);

    const pairedRoom = resolvePairedRoom();
    const controller = createController(
      controllerIdFromHost(host),
      defaultControllerName,
      host,
      token,
      pairedRoom.id,
    );

    try {
      await saveConnectedController({
        ...controller,
        connectionStatus: 'online',
        online: true,
      });
    } catch (error) {
      Alert.alert(
        'Connection Failed',
        'Could not reach the ESP32. Check the IP address, token, and Wi-Fi connection.',
      );
    } finally {
      setIsManualConnecting(false);
    }
  }, [
    controllers,
    defaultControllerName,
    hostInput,
    resolvePairedRoom,
    saveConnectedController,
    tokenInput,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Add Controller</Text>
            <Text style={styles.body}>
              Join the controller setup Wi-Fi, choose your home Wi-Fi, then save
              the controller.
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Wifi color={theme.accent} size={20} />
              <Text style={styles.sectionTitle}>Wi-Fi Setup</Text>
            </View>

            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Setup networks are named {SETUP_AP_PREFIX}ABC123. Password:{' '}
                {SETUP_AP_PASSWORD}
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Controller Name</Text>
              <TextInput
                autoCapitalize="words"
                onChangeText={setControllerName}
                placeholder={defaultControllerName}
                placeholderTextColor={theme.textMuted}
                style={styles.input}
                value={controllerName}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Selected Controller SSID</Text>
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={setSetupSsidInput}
                placeholder={`${SETUP_AP_PREFIX}ABC123`}
                placeholderTextColor={theme.textMuted}
                style={styles.input}
                value={setupSsidInput}
              />
            </View>

            <View style={styles.inlineActions}>
              <AppButton
                label="Open Wi-Fi Settings"
                leftIcon={<Settings color={theme.text} size={18} />}
                onPress={handleOpenSettings}
                style={styles.inlineButton}
                variant="secondary"
              />
              <AppButton
                disabled={isCheckingSetup}
                label={isCheckingSetup ? 'Checking' : 'Check Controller'}
                leftIcon={
                  isCheckingSetup ? (
                    <ActivityIndicator color={theme.accent} size="small" />
                  ) : (
                    <RefreshCw color={theme.accent} size={18} />
                  )
                }
                onPress={handleCheckSetupController}
                style={styles.inlineButton}
              />
            </View>

            {setupInfo !== null && (
              <View style={styles.connectedPanel}>
                <Text style={styles.connectedLabel}>Connected Controller</Text>
                <Text style={styles.connectedName}>
                  {setupControllerLabel(setupInfo.shortId)}
                </Text>
                <Text style={styles.connectedDetail}>
                  {setupInfo.controllerId}
                </Text>
              </View>
            )}

            {setupNetworks.length > 0 && (
              <View style={styles.field}>
                <Text style={styles.label}>Home Wi-Fi</Text>
                <View style={styles.networkList}>
                  {setupNetworks.map((network) => {
                    const selected = network.ssid === selectedNetwork?.ssid;
                    return (
                      <TouchableOpacity
                        activeOpacity={0.78}
                        key={network.ssid}
                        onPress={() => setSelectedNetwork(network)}
                        style={[
                          styles.networkRow,
                          selected && styles.networkRowSelected,
                        ]}
                      >
                        <View style={styles.networkNameGroup}>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.networkName,
                              selected && styles.networkNameSelected,
                            ]}
                          >
                            {network.ssid}
                          </Text>
                          <Text style={styles.networkRssi}>
                            {network.rssi} dBm
                          </Text>
                        </View>
                        {selected && (
                          <CheckCircle2 color={theme.accent} size={20} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {selectedNetwork !== null && (
              <View style={styles.field}>
                <Text style={styles.label}>Home Wi-Fi Password</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setHomeWifiPassword}
                  placeholder="Password"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry
                  style={styles.input}
                  value={homeWifiPassword}
                />
              </View>
            )}

            <AppButton
              disabled={!canProvision}
              label={isProvisioning ? 'Connecting Controller' : 'Save Wi-Fi'}
              leftIcon={
                isProvisioning ? (
                  <ActivityIndicator color={theme.accent} size="small" />
                ) : null
              }
              onPress={handleProvision}
            />

            {provisionedResult !== null && (
              <View style={styles.verifyPanel}>
                <Text style={styles.noticeText}>
                  Controller joined Wi-Fi at {provisionedResult.ip}. Return this
                  phone to the normal Wi-Fi network before verifying.
                </Text>
                <View style={styles.inlineActions}>
                  <AppButton
                    label="Open Wi-Fi Settings"
                    leftIcon={<Settings color={theme.text} size={18} />}
                    onPress={handleOpenSettings}
                    style={styles.inlineButton}
                    variant="secondary"
                  />
                  <AppButton
                    disabled={isVerifyingProvisioned}
                    label={
                      isVerifyingProvisioned ? 'Verifying' : 'Verify and Save'
                    }
                    leftIcon={
                      isVerifyingProvisioned ? (
                        <ActivityIndicator color={theme.accent} size="small" />
                      ) : (
                        <CheckCircle2 color={theme.accent} size={18} />
                      )
                    }
                    onPress={handleVerifyProvisionedController}
                    style={styles.inlineButton}
                  />
                </View>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Settings color={theme.textSecondary} size={20} />
              <Text style={styles.sectionTitle}>Manual Pairing</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>ESP32 IP Address</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                onChangeText={setHostInput}
                placeholder="192.168.1.50"
                placeholderTextColor={theme.textMuted}
                style={styles.input}
                value={hostInput}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Token</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setTokenInput}
                placeholder="Controller token"
                placeholderTextColor={theme.textMuted}
                secureTextEntry
                style={styles.input}
                value={tokenInput}
              />
            </View>

            <AppButton
              disabled={!canConnectManually}
              label={isManualConnecting ? 'Connecting' : 'Connect Manually'}
              leftIcon={
                isManualConnecting ? (
                  <ActivityIndicator color={theme.accent} size="small" />
                ) : null
              }
              onPress={handleManualConnect}
            />
          </View>

          <AppButton label="Back" onPress={handleBack} variant="secondary" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      backgroundColor: theme.root,
      flex: 1,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      gap: theme.spacing.xl,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.xxxl,
    },
    header: {
      gap: theme.spacing.sm,
    },
    title: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: 0,
      textAlign: 'center',
    },
    body: {
      color: theme.textSecondary,
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: 0,
      lineHeight: 22,
      textAlign: 'center',
    },
    section: {
      gap: theme.spacing.lg,
    },
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: 0,
    },
    notice: {
      backgroundColor: theme.accentSubtle,
      borderColor: theme.border,
      borderRadius: theme.radiusSmall,
      borderWidth: 1,
      padding: theme.spacing.md,
    },
    noticeText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0,
      lineHeight: 19,
    },
    field: {
      gap: theme.spacing.sm,
    },
    label: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0,
    },
    input: {
      backgroundColor: theme.surfaceWarm,
      borderColor: theme.border,
      borderRadius: theme.radiusMedium,
      borderWidth: 1,
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
      minHeight: 54,
      paddingHorizontal: theme.spacing.md,
    },
    inlineActions: {
      gap: theme.spacing.md,
    },
    inlineButton: {
      flex: 1,
    },
    connectedPanel: {
      backgroundColor: theme.surfaceWarm,
      borderColor: theme.border,
      borderRadius: theme.radiusSmall,
      borderWidth: 1,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
    connectedLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0,
      textTransform: 'uppercase',
    },
    connectedName: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '900',
      letterSpacing: 0,
    },
    connectedDetail: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0,
    },
    networkList: {
      borderColor: theme.border,
      borderRadius: theme.radiusSmall,
      borderWidth: 1,
      overflow: 'hidden',
    },
    networkRow: {
      alignItems: 'center',
      backgroundColor: theme.surfaceWarm,
      borderBottomColor: theme.borders.soft,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: theme.spacing.md,
      minHeight: 58,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    networkRowSelected: {
      backgroundColor: theme.accentSubtle,
    },
    networkNameGroup: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    networkName: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0,
    },
    networkNameSelected: {
      color: theme.accentBright,
    },
    networkRssi: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0,
    },
    verifyPanel: {
      gap: theme.spacing.md,
    },
  });
