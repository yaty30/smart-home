import { ArrowLeft, ChevronDown, Settings } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { theme } from '../theme/theme';

type ACHeaderProps = {
  location: string;
};

export function ACHeader({ location }: ACHeaderProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={styles.iconButton}
      >
        <ArrowLeft color={theme.text} size={24} strokeWidth={2.2} />
      </TouchableOpacity>

      <View style={styles.titleGroup}>
        <Text style={styles.title}>Air Conditioner</Text>
        <View style={styles.locationRow}>
          <Text style={styles.location}>{location}</Text>
          <ChevronDown
            color={theme.textSecondary}
            size={15}
            strokeWidth={2.4}
          />
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        style={styles.iconButton}
      >
        <Settings color={theme.text} size={23} strokeWidth={2.1} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: theme.controlBackground,
    borderColor: theme.border,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  titleGroup: {
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
  },
  title: {
    color: theme.text,
    fontSize: theme.typography.title,
    fontWeight: '700',
    letterSpacing: 0,
  },
  locationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  location: {
    color: theme.textSecondary,
    fontSize: theme.typography.label,
    fontWeight: '500',
    letterSpacing: 0,
  },
});
