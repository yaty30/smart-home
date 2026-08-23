import { Power } from 'lucide-react-native';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { theme } from '../theme/theme';

type PowerButtonProps = {
  isPowered: boolean;
  isDisabled?: boolean;
  onTogglePower: () => void;
};

export function PowerButton({
  isDisabled = false,
  isPowered,
  onTogglePower,
}: PowerButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      accessibilityRole="switch"
      accessibilityState={{ checked: isPowered, disabled: isDisabled }}
      accessibilityLabel="Toggle air conditioner power"
      disabled={isDisabled}
      onPress={onTogglePower}
      style={[
        styles.button,
        isPowered ? styles.buttonOn : styles.buttonOff,
        isDisabled && styles.buttonDisabled,
      ]}
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
    backgroundColor: theme.paperBackground,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 90,
    justifyContent: 'center',
    width: 90,
  },
  buttonOn: {
    borderColor: theme.borderActive,
    elevation: 10,
    shadowColor: theme.accent,
    shadowOffset: {
      height: 14,
      width: 0,
    },
    shadowOpacity: 0.28,
    shadowRadius: 26,
  },
  buttonOff: {
    borderColor: theme.borderStrong,
    opacity: 0.72,
  },
  buttonDisabled: {
    opacity: 0.44,
  },
});
