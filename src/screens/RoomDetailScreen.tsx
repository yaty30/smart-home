import { AirVent, ChevronLeft, FolderPen, Lightbulb, PackagePlus, Plus, Trash2, Tv, Wifi, WifiOff, Power, ChevronRight } from 'lucide-react-native';
import { Animated, Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, Alert } from 'react-native';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRooms } from '../store/rooms';
import { useDevices } from '../store/devices';
import { useControllers } from '../store/controllers';
import { type Theme, useTheme } from '../theme/theme';
import type { RootStackScreenProps } from '../navigation/types';
import type { Device, DeviceBrand, DeviceType } from '../domain/device';
import type { ComponentType } from 'react';
import { AppHeader, HeaderIconButton } from '../components/AppHeader';
import { AddDeviceSheet } from '../components/AddDeviceSheet';
import { BottomNav, BOTTOM_NAV_CLEARANCE } from '../components/BottomNav';
import { createDevice } from '../domain/device';
import { deviceService, executeDeviceCommand } from '../services/deviceService';
import { controllerHealthService } from '../services/controllerHealthService';
import { isDebugMode } from '../config/debug';
import { SwipeableItem } from '../components/SwipeableItem';

type RoomDetailScreenProps = RootStackScreenProps<'RoomDetail'>;

type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

type RenameTarget =
  | {
      type: 'room';
    }
  | {
      type: 'device';
      deviceId: string;
    };

const iconByDeviceType: Record<DeviceType, IconComponent> = {
  ac: AirVent,
  light: Lightbulb,
  tv: Tv,
  fan: AirVent,
};

const POWERED_GREEN = '#4ADE80';
const POWERED_GREEN_MUTED = 'rgba(74, 222, 128, 0.18)';
const POWERED_GREEN_BORDER = 'rgba(74, 222, 128, 0.72)';
const CONTROLLER_STATUS_POLL_MS = 10000;
const BOTTOM_NAV_ANIMATION_MS = 260;
const BOTTOM_NAV_HIDDEN_OFFSET = BOTTOM_NAV_CLEARANCE + 48;

export function RoomDetailScreen({ navigation, route }: RoomDetailScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { roomId } = route.params;
  const { getRoomById, removeRoom, updateRoomName } = useRooms();
  const { getDeviceById, getDevicesByRoom, removeDevice, removeDevicesByRoom, addDevice, updateDeviceName, updateDeviceState } = useDevices();
  const { controllers, getControllerById, updateControllerOnlineStatus } = useControllers();
  const [showAddDeviceSheet, setShowAddDeviceSheet] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [renameValue, setRenameValue] = useState('');
  const bottomNavTranslateY = useRef(new Animated.Value(BOTTOM_NAV_HIDDEN_OFFSET)).current;
  const bottomNavOpacity = useRef(new Animated.Value(0)).current;
  const isLeavingScreen = useRef(false);

  const room = getRoomById(roomId);
  const devices = getDevicesByRoom(roomId);

  const roomController = controllers.find((c) => c.roomId === roomId);
  const ControllerStatusIcon = roomController?.online ? Wifi : WifiOff;

  useEffect(() => {
    deviceService.initialize(getDeviceById, getControllerById);
  }, [getDeviceById, getControllerById]);

  useEffect(() => {
    if (!roomController) {
      return undefined;
    }

    controllerHealthService.start([roomController], updateControllerOnlineStatus, 10000);

    return () => {
      controllerHealthService.stop();
    };
  }, [roomController, updateControllerOnlineStatus]);

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

  const handleDeleteDevice = (deviceId: string, deviceName: string) => {
    Alert.alert(
      'Delete Device',
      `Are you sure you want to delete ${deviceName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void removeDevice(deviceId);
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
  }, [devices.length, navigation, removeDevicesByRoom, removeRoom, room, roomId]);

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
        Alert.alert(
          'Controller Offline',
          `The controller for ${room.name} is currently offline. Please ensure the ESP32 is powered on and connected to your network.`,
          [{ text: 'OK' }]
        );
        return;
      }

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
        device.state = {
          power: false,
          temperature: 24,
          mode: 'cool',
          fanSpeed: 'auto',
          swingVertical: 'auto',
          swingHorizontal: 'center',
          quiet: false,
          powerful: false,
        };
      }

      await addDevice(device);
      setShowAddDeviceSheet(false);

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

  const animateBottomNavIn = useCallback(() => {
    bottomNavTranslateY.stopAnimation();
    bottomNavOpacity.stopAnimation();

    Animated.parallel([
      Animated.timing(bottomNavTranslateY, {
        duration: BOTTOM_NAV_ANIMATION_MS,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(bottomNavOpacity, {
        duration: BOTTOM_NAV_ANIMATION_MS,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bottomNavOpacity, bottomNavTranslateY]);

  const animateBottomNavOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(bottomNavTranslateY, {
        duration: 220,
        toValue: BOTTOM_NAV_HIDDEN_OFFSET,
        useNativeDriver: true,
      }),
      Animated.timing(bottomNavOpacity, {
        duration: 180,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bottomNavOpacity, bottomNavTranslateY]);

  useEffect(() => {
    const frame = requestAnimationFrame(animateBottomNavIn);

    return () => {
      cancelAnimationFrame(frame);
      bottomNavTranslateY.stopAnimation();
      bottomNavOpacity.stopAnimation();
    };
  }, [animateBottomNavIn, bottomNavOpacity, bottomNavTranslateY]);

  useEffect(() => {
    const addNavigationListener = navigation.addListener as unknown as (
      eventName: 'transitionStart' | 'gestureCancel',
      listener: (event: { data?: { closing?: boolean } }) => void,
    ) => () => void;

    const unsubscribeTransitionStart = addNavigationListener('transitionStart', (event) => {
      if (!event.data?.closing) {
        return;
      }

      animateBottomNavOut();
    });

    const unsubscribeGestureCancel = addNavigationListener('gestureCancel', () => {
      if (!isLeavingScreen.current) {
        animateBottomNavIn();
      }
    });

    return () => {
      unsubscribeTransitionStart();
      unsubscribeGestureCancel();
    };
  }, [animateBottomNavIn, animateBottomNavOut, navigation]);

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
          <TouchableOpacity
            activeOpacity={0.84}
            accessibilityRole="button"
            accessibilityLabel="View controller details"
            onPress={() => navigation.navigate('Controllers')}
            style={styles.controllerCard}
          >
            <View style={styles.controllerHeader}>
              <View style={styles.controllerIconWrapper}>
                <ControllerStatusIcon
                  color={roomController.online ? theme.accent : theme.textMuted}
                  size={20}
                  strokeWidth={2.2}
                />
              </View>
              <View style={styles.controllerInfoSection}>
                <Text style={styles.controllerLabel}>Controller</Text>
                <Text style={[
                  styles.controllerStatus,
                  roomController.online && styles.controllerStatusOnline
                ]}>
                  {roomController.online ? 'Online' : 'Offline'}
                </Text>
              </View>
              <ChevronRight color={theme.textMuted} size={20} strokeWidth={2.2} />
            </View>
            <View style={styles.controllerDetails}>
              <Text style={styles.controllerIP}>{roomController.ip}</Text>
            </View>
          </TouchableOpacity>
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
              const Icon = iconByDeviceType[device.type];
              const isPowered = device.state.power === true;

              return (
                <SwipeableItem
                  key={device.id}
                  onDelete={() => handleDeleteDevice(device.id, device.name)}
                  onRename={() => handleOpenDeviceRename(device)}
                  onSwipeEnd={() => setScrollEnabled(true)}
                  onSwipeStart={() => setScrollEnabled(false)}
                  style={styles.deviceCardWrapper}
                >
                  <View style={[styles.deviceCard, isPowered && styles.deviceCardOn]}>
                    <TouchableOpacity
                      activeOpacity={0.84}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${device.name}`}
                      onPress={() => {
                        if (device.type === 'ac') {
                          navigation.navigate('DeviceControl', { deviceId: device.id });
                        }
                      }}
                      style={styles.deviceCardContent}
                    >
                      <View style={[styles.deviceIcon, isPowered && styles.deviceIconOn]}>
                        <Icon
                          color={isPowered ? POWERED_GREEN : theme.textMuted}
                          size={20}
                          strokeWidth={2.2}
                        />
                      </View>
                      <View style={styles.deviceInfo}>
                        <Text numberOfLines={1} style={styles.deviceName}>
                          {device.name}
                        </Text>
                        {device.type === 'ac' && device.brand && (
                          <Text numberOfLines={1} style={styles.deviceBrand}>
                            {device.brand.charAt(0).toUpperCase() + device.brand.slice(1)}
                          </Text>
                        )}
                        {device.type === 'ac' && isPowered && (
                          <View style={styles.deviceStatus}>
                            <Text style={styles.deviceStatusText}>
                              {device.state.temperature}°C
                            </Text>
                            <Text style={styles.deviceStatusSeparator}>•</Text>
                            <Text style={styles.deviceStatusText}>
                              {device.state.mode ? device.state.mode.charAt(0).toUpperCase() + device.state.mode.slice(1) : 'Auto'}
                            </Text>
                            <Text style={styles.deviceStatusSeparator}>•</Text>
                            <Text style={styles.deviceStatusText}>
                              {device.state.fanSpeed === 'auto' ? 'Auto Fan' : `Fan ${device.state.fanSpeed}`}
                            </Text>
                          </View>
                        )}
                        {device.type === 'ac' && !isPowered && (
                          <Text style={styles.deviceStatusText}>Off</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.72}
                      accessibilityRole="button"
                      accessibilityLabel={`Toggle ${device.name} power`}
                      onPress={() => void handleTogglePower(device.id, isPowered)}
                      style={[styles.powerButton, isPowered && styles.powerButtonOn]}
                    >
                      <Power
                        color={isPowered ? POWERED_GREEN : theme.textMuted}
                        size={20}
                        strokeWidth={2.4}
                      />
                    </TouchableOpacity>
                  </View>
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

      <Modal
        animationType="fade"
        onRequestClose={handleCloseRename}
        transparent
        visible={renameTarget !== null}
      >
        <Pressable style={styles.renameBackdrop} onPress={handleCloseRename}>
          <Pressable style={styles.renameDialog} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.renameTitle}>{renameTitle}</Text>
            <Text style={styles.renameLabel}>{renameLabel}</Text>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              onChangeText={setRenameValue}
              onSubmitEditing={handleSubmitRename}
              placeholder={renameTarget?.type === 'device' ? 'Air Conditioner' : 'Living Room'}
              placeholderTextColor={theme.textMuted}
              returnKeyType="done"
              style={styles.renameInput}
              value={renameValue}
            />
            <View style={styles.renameActions}>
              <TouchableOpacity
                activeOpacity={0.74}
                accessibilityRole="button"
                accessibilityLabel="Cancel rename"
                onPress={handleCloseRename}
                style={styles.renameSecondaryButton}
              >
                <Text style={styles.renameSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.74}
                accessibilityRole="button"
                accessibilityLabel={`Save ${renameTarget?.type ?? 'item'} name`}
                disabled={renameValue.trim().length === 0}
                onPress={handleSubmitRename}
                style={[
                  styles.renamePrimaryButton,
                  renameValue.trim().length === 0 && styles.renameButtonDisabled,
                ]}
              >
                <Text style={styles.renamePrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
  controllerCard: {
    alignItems: 'stretch',
    backgroundColor: theme.surfaceWarm,
    borderColor: theme.border,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.md,
  },
  controllerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  controllerIconWrapper: {
    alignItems: 'center',
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  controllerInfoSection: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  controllerLabel: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  controllerStatus: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
  },
  controllerStatusOnline: {
    color: '#4ADE80',
  },
  controllerDetails: {
    paddingLeft: 52,
  },
  controllerIP: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
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
  deviceCard: {
    alignItems: 'center',
    backgroundColor: theme.surfaceWarm,
    borderColor: theme.border,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  deviceCardOn: {
    backgroundColor: POWERED_GREEN_MUTED,
    borderColor: POWERED_GREEN_BORDER,
  },
  deviceCardContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  deviceIcon: {
    alignItems: 'center',
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  deviceIconOn: {
    backgroundColor: POWERED_GREEN_MUTED,
    borderColor: POWERED_GREEN_BORDER,
  },
  deviceInfo: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  deviceName: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  deviceBrand: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0,
  },
  deviceStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  deviceStatusText: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0,
  },
  deviceStatusSeparator: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  powerButton: {
    alignItems: 'center',
    backgroundColor: theme.surfaceLow,
    borderColor: theme.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  powerButtonOn: {
    backgroundColor: POWERED_GREEN_MUTED,
    borderColor: POWERED_GREEN_BORDER,
  },
  deleteSection: {
    marginTop: 'auto',
    paddingTop: theme.spacing.xxl,
  },
  renameBackdrop: {
    alignItems: 'center',
    backgroundColor: theme.scrim,
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  renameDialog: {
    backgroundColor: theme.paperBackground,
    borderColor: theme.border,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    maxWidth: 420,
    padding: theme.spacing.xl,
    width: '100%',
  },
  renameTitle: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: theme.spacing.xl,
  },
  renameLabel: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
  },
  renameInput: {
    backgroundColor: theme.surfaceLow,
    borderColor: theme.border,
    borderRadius: 14,
    borderWidth: 1,
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
    height: 54,
    paddingHorizontal: theme.spacing.lg,
  },
  renameActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'flex-end',
    marginTop: theme.spacing.xl,
  },
  renameSecondaryButton: {
    alignItems: 'center',
    borderColor: theme.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  renameSecondaryText: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  renamePrimaryButton: {
    alignItems: 'center',
    backgroundColor: theme.accent,
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  renameButtonDisabled: {
    opacity: 0.45,
  },
  renamePrimaryText: {
    color: theme.textOnAccent,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
});
