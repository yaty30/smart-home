import { Star } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AcStatePills } from '../AcStatePills';
import type { Device } from '../../domain/device';
import { useRooms } from '../../store/rooms';
import { type Theme, useTheme } from '../../theme/theme';
import { DeviceTypeIcon } from './DeviceTypeIcon';

type HeroCardProps = {
  device: Device;
  onOpenControl: () => void;
};

export function HeroCard({ device, onOpenControl }: HeroCardProps) {
  const theme = useTheme();
  const heroStyles = useMemo(() => createHeroStyles(theme), [theme]);
  const isOn = device.state.power === true;
  const hasKnownPower = typeof device.state.power === 'boolean';
  const isOffline = device.state.syncStatus === 'offline';
  const isSyncing =
    device.state.syncStatus === 'syncing' ||
    device.state.syncStatus === 'unknown' ||
    device.state.syncStatus === undefined;
  const isLiveOn = isOn && !isOffline && !isSyncing;
  const powerLabel = !hasKnownPower
    ? 'OFF'
    : isOffline
      ? 'OFF'
      : isSyncing
        ? 'OFF'
        : isOn
          ? 'ON'
          : 'OFF';
  const { getRoomById } = useRooms();
  const room = getRoomById(device.roomId)?.name ?? '';

  return (
    <TouchableOpacity style={heroStyles.card} onPress={onOpenControl} activeOpacity={0.78}>
      <View style={heroStyles.header}>
        <View style={heroStyles.nameLine}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Star size={14} color={theme.accent} fill={theme.accent} style={heroStyles.starIcon} />
            <Text style={{ ...heroStyles.label, color: theme.accentGlow }} numberOfLines={1}>{room}</Text>
          </View>
          <Text style={{ ...heroStyles.label, fontSize: 22 }} numberOfLines={1}>{device.name}</Text>
        </View>
        <View style={[heroStyles.powerBadge, isLiveOn ? heroStyles.powerBadgeOn : heroStyles.powerBadgeOff]}>
          <Text style={[heroStyles.powerBadgeText, isLiveOn ? heroStyles.powerBadgeTextOn : heroStyles.powerBadgeTextOff]}>
            {powerLabel}
          </Text>
        </View>
      </View>

      <View style={heroStyles.body}>
        <DeviceTypeIcon type={device.type} size={48} color={isOn ? theme.accent : theme.textMuted} />
      </View>

      {device.type === 'ac' && hasKnownPower && isOn && (
        <AcStatePills state={device.state} />
      )}
    </TouchableOpacity>
  );
}

const createHeroStyles = (theme: Theme) => StyleSheet.create({
  card: {
    backgroundColor: theme.surfaceWarm,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    borderColor: theme.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameLine: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    flex: 1,
    marginRight: theme.spacing.md,
  },
  starIcon: {
    marginTop: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    flex: 1,
  },
  powerBadge: {
    borderRadius: theme.radiusSmall,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  powerBadgeOn: {
    backgroundColor: theme.accentMuted,
    borderWidth: 1,
    borderColor: theme.borderActive,
  },
  powerBadgeOff: {
    backgroundColor: theme.surfaceLow,
    borderWidth: 1,
    borderColor: theme.border,
  },
  powerBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  powerBadgeTextOn: {
    color: theme.accent,
  },
  powerBadgeTextOff: {
    color: theme.textMuted,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
});
