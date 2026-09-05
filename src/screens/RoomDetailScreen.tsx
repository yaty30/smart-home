import { ChevronLeft, FolderPen, PackagePlus, Plus, Trash2 } from 'lucide-react-native';
import { Animated, Keyboard, StyleSheet, Text, TouchableOpacity, View, ScrollView, Alert } from 'react-native';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRooms } from '../store/rooms';
import { useDevices } from '../store/devices';
import { useControllers } from '../store/controllers';
import { type Theme, useTheme } from '../theme/theme';
import type { RootStackScreenProps } from '../navigation/types';
import type { Device, DeviceBrand, DeviceType } from '../domain/device';
import { AppHeader, HeaderIconButton } from '../components/AppHeader';
import { AddDeviceSheet } from '../components/AddDeviceSheet';
import { BottomNav, BOTTOM_NAV_CLEARANCE } from '../components/BottomNav';
import { controllerStatusText } from '../domain/controller';
import { createDevice } from '../domain/device';
import { deviceService, executeDeviceCommand } from '../services/deviceService';
import { tvService } from '../services/tvService';
import { SwipeableItem } from '../components/SwipeableItem';
import { RenameDialog } from '../components/room/RenameDialog';
import { RoomControllerCard } from '../components/room/RoomControllerCard';
import { RoomDeviceCard } from '../components/room/RoomDeviceCard';
import { useBottomNavAnimation } from '../hooks/useBottomNavAnimation';

type RoomDetailScreenProps = RootStackScreenProps<'RoomDetail'>;

type RenameTarget =
  | {
      type: 'room';
    }
  | {
      type: 'device';
      deviceId: string;
    };

export function RoomDetailScreen({ navigation, route }: RoomDetailScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { roomId } = route.params;
  const { getRoomById, removeRoom, updateRoomName } = useRooms();
  const { getDeviceById, getDevicesByRoom, removeDevice, removeDevicesByRoom, addDevice, updateDeviceName, updateDeviceState } = useDevices();
  const { controllers, getControllerById } = useControllers();
  const [showAddDeviceSheet, setShowAddDeviceSheet] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [renameValue, setRenameValue] = useState('');
  const {
    animateBottomNavOut,
    bottomNavOpacity,
    bottomNavTranslateY,
    isLeavingScreen,
  } = useBottomNavAnimation({ navigation });

  const room = getRoomById(roomId);
  const devices = getDevicesByRoom(roomId);

  const roomController = controllers.find((c) => c.roomId === roomId);
  const currentControllerStatusText = controllerStatusText(
    roomController?.connectionStatus,
    roomController?.online,
  );

  useEffect(() => {
    deviceService.initialize(getDeviceById, getControllerById);
  }, [getDeviceById, getControllerById]);

  const handleTogglePower = useCallback(
    async (deviceId: string, currentPower: boolean) => {
      const newPower = !currentPower;
      updateDeviceState(deviceId, { power: newPower });

      try {
        await executeDeviceCommand(deviceId, {
          type: 'power',
          value: newPower,
        });
      } catch (error) {
        updateDeviceState(deviceId, { power: currentPower });
        Alert.alert('Error', 'Failed to toggle device power');
      }
    },
    [updateDeviceState]
  );

  const unpairDeviceIfNeeded = useCallback(
    async (device: Device) => {
      if (device.type !== 'tv' || !device.controllerDeviceId) {
        return;
      }

      const controller = getControllerById(device.controllerId);
      if (!controller?.online) {
        return;
      }

      try {
        await tvService.unpairTv(controller, device.controllerDeviceId);
      } catch (error) {
        console.warn('[RoomDetail] Failed to unpair TV from controller:', error);
      }
    },
    [getControllerById],
  );

  const handleDeleteDevice = (device: Device) => {
    Alert.alert(
      'Delete Device',
      `Are you sure you want to delete ${device.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await unpairDeviceIfNeeded(device);
            await removeDevice(device.id);
          },
        },
      ]
    );
  };

  const handleOpenDeviceRename = useCallback((device: Device) => {
    setRenameTarget({ type: 'device', deviceId: device.id });
    setRenameValue(device.name);
  }, []);

  const handleDeleteRoom = useCallback(() => {
    if (!room) {
      return;
    }

    const deviceCount = devices.length;
    const message =
      deviceCount > 0
        ? `Deleting ${room.name} will also delete ${deviceCount} ${deviceCount === 1 ? 'device' : 'devices'} in this room. This action cannot be undone.`
        : `Deleting ${room.name} cannot be undone.`;

    Alert.alert('Delete Room', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await Promise.all(devices.map(unpairDeviceIfNeeded));
          await removeDevicesByRoom(roomId);
          removeRoom(roomId);
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Main');
          }
        },
      },
    ]);
  }, [
    devices,
    navigation,
    removeDevicesByRoom,
    removeRoom,
    room,
    roomId,
    unpairDeviceIfNeeded,
  ]);

  const handleOpenRename = useCallback(() => {
    if (!room) {
      return;
    }

    setRenameValue(room.name);
    setRenameTarget({ type: 'room' });
  }, [room]);

  const handleCloseRename = useCallback(() => {
    Keyboard.dismiss();
    setRenameTarget(null);
    setRenameValue('');
  }, []);

  const handleSubmitRename = useCallback(() => {
    const trimmedName = renameValue.trim();
    if (!trimmedName || renameTarget === null) {
      return;
    }

    if (renameTarget.type === 'room') {
      updateRoomName(roomId, trimmedName);
    } else {
      void updateDeviceName(renameTarget.deviceId, trimmedName);
    }

    handleCloseRename();
  }, [handleCloseRename, renameTarget, renameValue, roomId, updateDeviceName, updateRoomName]);

  const handleAddDevice = useCallback(
    async (deviceType: DeviceType, brand: DeviceBrand) => {
      if (!room) {
        return;
      }

      if (!roomController) {
        Alert.alert(
          'No Controller Found',
          'This room does not have a controller assigned. Please pair a controller with this room first.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (!roomController.online) {
        const waitingForStatus =
          roomController.connectionStatus === 'unknown' ||
          roomController.connectionStatus === 'connecting' ||
          roomController.connectionStatus === undefined;

        Alert.alert(
          'Controller Offline',
          waitingForStatus
            ? `The controller for ${room.name} is currently offline. Please wait for it to reconnect or check the ESP32 power and Wi-Fi connection.`
            : `The controller for ${room.name} is currently offline. Please ensure the ESP32 is powered on and connected to your network.`,
          [{ text: 'OK' }]
        );
        return;
      }

      setShowAddDeviceSheet(false);

      // TV requires discovery flow
      if (deviceType === 'tv') {
        navigation.navigate('TvDiscovery', {
          roomId,
          controllerId: roomController.id,
        });
        return;
      }

      // AC and other devices use direct creation
      const deviceName =
        deviceType === 'ac' ? 'Air Conditioner' : deviceType.toUpperCase();

      const device = createDevice(
        deviceName,
        roomId,
        roomController.id,
        deviceType,
        brand,
        'ir'
      );

      if (deviceType === 'ac' && brand === 'panasonic') {
        device.capabilities = {
          power: true,
          temperature: { min: 16, max: 30 },
          modes: ['auto', 'cool', 'dry', 'fan', 'heat'],
          fanSpeeds: ['auto', '1', '2', '3', '4', '5'],
          swing: true,
        };
        device.state = { syncStatus: 'unknown' };
      }

      await addDevice(device);

      Alert.alert('Device Added', `${deviceName} has been added successfully.`, [
        {
          text: 'Configure',
          onPress: () => {
            if (deviceType === 'ac') {
              navigation.navigate('DeviceControl', { deviceId: device.id });
            }
          },
        },
        { text: 'OK' },
      ]);
    },
    [roomController, room, roomId, addDevice, navigation]
  );

  const handleBackPress = useCallback(() => {
    if (isLeavingScreen.current) {
      return;
    }

    isLeavingScreen.current = true;
    animateBottomNavOut();

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  }, [animateBottomNavOut, navigation]);

  const renameTitle = renameTarget?.type === 'device' ? 'Rename Device' : 'Rename Room';
  const renameLabel = renameTarget?.type === 'device' ? 'Device Name' : 'Room Name';

  if (!room) {
    return (
      <View style={styles.screen}>
        <Text style={styles.errorText}>Room not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        leftAction={
          <HeaderIconButton
            accessibilityLabel="Back"
            onPress={handleBackPress}
          >
            <ChevronLeft color={theme.accent} size={26} strokeWidth={2.35} />
          </HeaderIconButton>
        }
        title={room.name}
      />

      <ScrollView
        scrollEnabled={scrollEnabled}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        {roomController && (
          <RoomControllerCard
            controller={roomController}
            statusText={currentControllerStatusText}
            onPress={() => navigation.navigate('Controllers')}
          />
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Devices</Text>
          <TouchableOpacity
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel="Add device"
            onPress={() => setShowAddDeviceSheet(true)}
            style={styles.addDeviceButton}
          >
            <Plus color={theme.accent} size={20} strokeWidth={2.6} />
          </TouchableOpacity>
        </View>

        {devices.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No devices in this room</Text>
            <Text style={styles.emptyHint}>Add your first device to get started</Text>
          </View>
        ) : (
          <View style={styles.deviceList}>
            {devices.map((device) => {
              return (
                <SwipeableItem
                  key={device.id}
                  onDelete={() => handleDeleteDevice(device)}
                  onRename={() => handleOpenDeviceRename(device)}
                  onSwipeEnd={() => setScrollEnabled(true)}
                  onSwipeStart={() => setScrollEnabled(false)}
                  style={styles.deviceCardWrapper}
                >
                  <RoomDeviceCard
                    device={device}
                    controllerOnline={roomController?.online === true}
                    onOpen={() => {
                      if (device.type === 'ac' || device.type === 'tv') {
                        navigation.navigate('DeviceControl', { deviceId: device.id });
                      }
                    }}
                    onTogglePower={(currentPower) =>
                      void handleTogglePower(device.id, currentPower)
                    }
                  />
                </SwipeableItem>
              );
            })}
          </View>
        )}
      </ScrollView>

      <AddDeviceSheet
        visible={showAddDeviceSheet}
        onClose={() => setShowAddDeviceSheet(false)}
        onContinue={handleAddDevice}
      />

      <RenameDialog
        visible={renameTarget !== null}
        title={renameTitle}
        label={renameLabel}
        placeholder={renameTarget?.type === 'device' ? 'Air Conditioner' : 'Living Room'}
        saveAccessibilityLabel={`Save ${renameTarget?.type ?? 'item'} name`}
        value={renameValue}
        onChangeValue={setRenameValue}
        onCancel={handleCloseRename}
        onSubmit={handleSubmitRename}
      />

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.bottomNavAnimationLayer,
          {
            opacity: bottomNavOpacity,
            transform: [{ translateY: bottomNavTranslateY }],
          },
        ]}
      >
        <BottomNav
          visible
          items={[
            {
              icon: (
                <PackagePlus
                  color={theme.accentStrong}
                  size={22}
                  strokeWidth={2.2}
                />
              ),
              label: 'Add New Device',
              onPress: () => setShowAddDeviceSheet(true),
            },
            {
              icon: (
                <FolderPen
                  color={theme.accentStrong}
                  size={22}
                  strokeWidth={2.2}
                />
              ),
              label: 'Rename Room',
              onPress: handleOpenRename,
            },
            {
              icon: (
                <Trash2
                  color={theme.powerAccent}
                  size={22}
                  strokeWidth={2.2}
                />
              ),
              label: 'Delete Room',
              onPress: handleDeleteRoom,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  bottomNavAnimationLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  screen: {
    backgroundColor: theme.root,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl + BOTTOM_NAV_CLEARANCE,
  },
  emptyState: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xxxl,
  },
  emptyText: {
    color: theme.textSecondary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0,
  },
  emptyHint: {
    color: theme.textMuted,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'center',
  },
  errorText: {
    color: theme.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'center',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  addDeviceButton: {
    alignItems: 'center',
    backgroundColor: theme.surfaceWarm,
    borderColor: theme.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  deviceList: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  deviceCardWrapper: {
    borderRadius: theme.radiusMedium,
  },
});
