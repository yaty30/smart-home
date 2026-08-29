import { AirVent, Lightbulb, Power, Tv } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  type Device,
  type DeviceType,
  devicePowerPresentation,
} from '../../domain/device';
import { type Theme, useTheme } from '../../theme/theme';

type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

const iconByDeviceType: Record<DeviceType, IconComponent> = {
  ac: AirVent,
  light: Lightbulb,
  tv: Tv,
  fan: AirVent,
};

const deviceStatusText = (device: Device) => {
  const { hasKnownPower, isOffline, isOn } = devicePowerPresentation(
    device.state,
  );

  if (!hasKnownPower || isOffline) {
    return 'Off';
  }

  if (
    device.state.syncStatus === 'syncing' ||
    device.state.syncStatus === 'unknown'
  ) {
    return 'Off';
  }

  return isOn ? 'On' : 'Off';
};

type RoomDeviceCardProps = {
  device: Device;
  controllerOnline: boolean;
  onOpen: () => void;
  onTogglePower: (currentPower: boolean) => void;
};

/**
 * A single device row inside a room: icon, name/brand, AC summary line and the
 * power toggle. Power is only actionable while the room controller is online
 * and the device reports a known power state.
 */
export function RoomDeviceCard({
  controllerOnline,
  device,
  onOpen,
  onTogglePower,
}: RoomDeviceCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const Icon = iconByDeviceType[device.type];
  const isPowered = device.state.power === true;
  const hasKnownPower = typeof device.state.power === 'boolean';
  const isOffline = device.state.syncStatus === 'offline';
  const isSynced = device.state.syncStatus === 'synced';
  const canTogglePower = controllerOnline && hasKnownPower;
  const poweredColor = isPowered && !isOffline
    ? theme.statusColors.online
    : theme.textMuted;

  return (
    <View style={[styles.deviceCard, isPowered && isSynced && styles.deviceCardOn]}>
      <TouchableOpacity
        activeOpacity={0.84}
        accessibilityRole="button"
        accessibilityLabel={`Open ${device.name}`}
        onPress={onOpen}
        style={styles.deviceCardContent}
      >
        <View style={[styles.deviceIcon, isPowered && isSynced && styles.deviceIconOn]}>
          <Icon color={poweredColor} size={20} strokeWidth={2.2} />
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
          {device.type === 'ac' && isPowered && isSynced && (
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
          {device.type === 'ac' && (!isPowered || !isSynced) && (
            <Text style={styles.deviceStatusText}>
              {deviceStatusText(device)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.72}
        accessibilityRole="button"
        accessibilityLabel={`Toggle ${device.name} power`}
        accessibilityState={{ disabled: !canTogglePower }}
        disabled={!canTogglePower}
        onPress={() => onTogglePower(isPowered)}
        style={[
          styles.powerButton,
          isPowered && isSynced && styles.powerButtonOn,
          !canTogglePower && styles.powerButtonDisabled,
        ]}
      >
        <Power color={poweredColor} size={20} strokeWidth={2.4} />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
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
    backgroundColor: theme.statusColors.onlineMuted,
    borderColor: theme.statusColors.onlineBorder,
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
    backgroundColor: theme.statusColors.onlineMuted,
    borderColor: theme.statusColors.onlineBorder,
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
    backgroundColor: theme.statusColors.onlineMuted,
    borderColor: theme.statusColors.onlineBorder,
  },
  powerButtonDisabled: {
    opacity: 0.52,
  },
});
