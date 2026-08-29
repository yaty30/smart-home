import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { StatusDot } from '../common/StatusDot';
import type { Device } from '../../domain/device';
import { type Theme, useTheme } from '../../theme/theme';
import { DeviceTypeIcon } from './DeviceTypeIcon';

type DeviceCardProps = {
  device: Device;
  onPress: () => void;
};

export function DeviceCard({ device, onPress }: DeviceCardProps) {
  const theme = useTheme();
  const deviceCardStyles = useMemo(() => createDeviceCardStyles(theme), [theme]);
  const isOn = device.state.power === true;
  const hasKnownPower = typeof device.state.power === 'boolean';
  const isOffline = device.state.syncStatus === 'offline';
  const isSyncing =
    device.state.syncStatus === 'syncing' ||
    device.state.syncStatus === 'unknown' ||
    device.state.syncStatus === undefined;
  const stateText = !hasKnownPower
    ? 'Off'
    : isOffline
      ? 'Off'
      : isSyncing
        ? 'Off'
        : isOn
          ? 'On'
          : 'Off';

  return (
    <TouchableOpacity style={deviceCardStyles.card} onPress={onPress} activeOpacity={0.78}>
      <View style={deviceCardStyles.iconRow}>
        <DeviceTypeIcon type={device.type} size={26} color={isOn ? theme.accent : theme.textMuted} />
        <StatusDot online={isOn && !isOffline} style={deviceCardStyles.dot} />
      </View>
      <Text style={deviceCardStyles.name} numberOfLines={2}>{device.name}</Text>
      <Text style={deviceCardStyles.state}>{stateText}</Text>
    </TouchableOpacity>
  );
}

const createDeviceCardStyles = (theme: Theme) => StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: theme.surfaceWarm,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    borderColor: theme.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
    minHeight: 120,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  dot: {
    marginTop: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
    lineHeight: 19,
  },
  state: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.textMuted,
  },
});
