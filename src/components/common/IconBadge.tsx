import { useMemo, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme, type Theme } from '../../theme/theme';

type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

type IconBadgeVariant = 'default' | 'online' | 'offline';

type IconBadgeProps = {
  icon: IconComponent;
  size?: number;
  variant?: IconBadgeVariant;
  iconSize?: number;
  strokeWidth?: number;
};

export function IconBadge({
  icon: Icon,
  size = 48,
  variant = 'default',
  iconSize = 22,
  strokeWidth = 2.2,
}: IconBadgeProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme, size), [theme, size]);

  const iconColor =
    variant === 'online'
      ? theme.statusColors.online
      : variant === 'offline'
        ? theme.textMuted
        : theme.accent;

  const containerStyle = [
    styles.container,
    variant === 'online' && styles.containerOnline,
    variant === 'offline' && styles.containerOffline,
  ];

  return (
    <View style={containerStyle}>
      <Icon color={iconColor} size={iconSize} strokeWidth={strokeWidth} />
    </View>
  );
}

const createStyles = (theme: Theme, size: number) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      backgroundColor: theme.accentMuted,
      borderColor: theme.borderActive,
      borderRadius: size / 4,
      borderWidth: 1,
      height: size,
      justifyContent: 'center',
      width: size,
    },
    containerOnline: {
      backgroundColor: theme.statusColors.onlineMuted,
      borderColor: theme.statusColors.onlineBorder,
    },
    containerOffline: {
      backgroundColor: theme.surfaceLow,
      borderColor: theme.border,
    },
  });
