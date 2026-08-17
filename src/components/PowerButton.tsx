import { Power } from 'lucide-react-native';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { theme } from '../theme/theme';

type PowerButtonProps = {
  isPowered: boolean;
  onTogglePower: () => void;
};

export function PowerButton({ isPowered, onTogglePower }: PowerButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      accessibilityRole="switch"
      accessibilityState={{ checked: isPowered }}
      accessibilityLabel="Toggle air conditioner power"
      onPress={onTogglePower}
      style={[styles.button, isPowered ? styles.buttonOn : styles.buttonOff]}
    >
      <Power
        color={isPowered ? theme.accentBright : theme.textMuted}
        size={34}
        strokeWidth={2.4}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: theme.controlBackground,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  buttonOn: {
    borderColor: theme.borderActive,
    elevation: 10,
    shadowColor: theme.accent,
    shadowOffset: {
      height: 12,
      width: 0,
    },
    shadowOpacity: 0.24,
    shadowRadius: 24,
  },
  buttonOff: {
    borderColor: theme.borderStrong,
    opacity: 0.72,
  },
});
