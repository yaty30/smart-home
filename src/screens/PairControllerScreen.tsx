import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppButton } from '../components/AppButton';
import { createController } from '../domain/controller';
import { type Theme, useTheme } from '../theme/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { useControllers } from '../store/controllers';
import { useDevices } from '../store/devices';
import { useRooms } from '../store/rooms';
import { fetchControllerStatus } from '../services/controllerStatusService';
import { notifyPairingComplete } from '../services/pairingService';

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
  const { addController, controllers, updateControllerConnectionStatus } =
    useControllers();
  const { applyControllerDeviceStatus } = useDevices();
  const { addRoom, getRoomById } = useRooms();
  const [controllerName, setControllerName] = useState('');
  const [hostInput, setHostInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const requestedRoomName = route.params?.roomName?.trim() || undefined;
  const roomId = route.params?.roomId;
  const existingRoom = roomId ? getRoomById(roomId) : undefined;
  const defaultControllerName =
    controllerName.trim() ||
    `${existingRoom?.name ?? requestedRoomName ?? 'Room'} Controller`;
  const canConnect =
    hostInput.trim().length > 0 && tokenInput.trim().length > 0 && !isConnecting;

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  }, [navigation]);

  const handleConnect = useCallback(async () => {
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

    setIsConnecting(true);

    const controller = createController(
      controllerIdFromHost(host),
      defaultControllerName,
      host,
      token,
      existingRoom?.id,
    );

    try {
      const snapshot = await fetchControllerStatus(controller);
      const pairedRoom =
        existingRoom ??
        addRoom(requestedRoomName ?? 'New Room', route.params?.roomIcon);
      const connectedController = {
        ...controller,
        roomId: pairedRoom.id,
        online: true,
        connectionStatus: 'online' as const,
      };

      await addController(connectedController);
      updateControllerConnectionStatus(connectedController.id, 'online');
      applyControllerDeviceStatus(connectedController.id, snapshot);
      void notifyPairingComplete(connectedController);

      Alert.alert(
        'Controller Connected',
        `${connectedController.name} is connected to ${pairedRoom.name}.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Main'),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        'Connection Failed',
        'Could not reach the ESP32. Check the IP address, token, and Wi-Fi connection.',
      );
    } finally {
      setIsConnecting(false);
    }
  }, [
    addController,
    addRoom,
    applyControllerDeviceStatus,
    controllers,
    defaultControllerName,
    existingRoom,
    hostInput,
    navigation,
    requestedRoomName,
    route.params?.roomIcon,
    tokenInput,
    updateControllerConnectionStatus,
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
              Enter the ESP32 address and token to connect this room.
            </Text>
          </View>

          <View style={styles.form}>
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
          </View>

          <View style={styles.actions}>
            <AppButton
              disabled={!canConnect}
              label={isConnecting ? 'Connecting' : 'Connect'}
              leftIcon={
                isConnecting ? (
                  <ActivityIndicator color={theme.accent} size="small" />
                ) : null
              }
              onPress={handleConnect}
            />
            <AppButton
              label="Back"
              onPress={handleBack}
              variant="secondary"
            />
          </View>
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
      justifyContent: 'center',
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
    form: {
      gap: theme.spacing.lg,
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
    actions: {
      gap: theme.spacing.md,
    },
  });
