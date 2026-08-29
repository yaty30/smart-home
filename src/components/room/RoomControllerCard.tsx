import { ChevronRight, Wifi, WifiOff } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { Controller } from '../../domain/controller';
import { type Theme, useTheme } from '../../theme/theme';

type RoomControllerCardProps = {
  controller: Controller;
  statusText: string;
  onPress: () => void;
};

/** Room controller summary card: online state, status label and IP. */
export function RoomControllerCard({
  controller,
  onPress,
  statusText,
}: RoomControllerCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const StatusIcon = controller.online ? Wifi : WifiOff;

  return (
    <TouchableOpacity
      activeOpacity={0.84}
      accessibilityRole="button"
      accessibilityLabel="View controller details"
      onPress={onPress}
      style={styles.controllerCard}
    >
      <View style={styles.controllerHeader}>
        <View style={styles.controllerIconWrapper}>
          <StatusIcon
            color={controller.online ? theme.accent : theme.textMuted}
            size={20}
            strokeWidth={2.2}
          />
        </View>
        <View style={styles.controllerInfoSection}>
          <Text style={styles.controllerLabel}>Controller</Text>
          <Text style={[
            styles.controllerStatus,
            controller.online && styles.controllerStatusOnline
          ]}>
            {statusText}
          </Text>
        </View>
        <ChevronRight color={theme.textMuted} size={20} strokeWidth={2.2} />
      </View>
      <View style={styles.controllerDetails}>
        <Text style={styles.controllerIP}>{controller.ip}</Text>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
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
    color: theme.statusColors.online,
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
});
