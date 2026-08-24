import {
  LinearGradient as ExpoLinearGradient,
  type LinearGradientProps,
} from 'expo-linear-gradient';
import { Power, PowerOff } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { theme } from '../theme/theme';

type PowerButtonProps = {
  isPowered: boolean;
  isDisabled?: boolean;
  variant?: 'large' | 'header';
  onTogglePower: () => void;
};

const GradientView =
  ExpoLinearGradient as unknown as ComponentType<LinearGradientProps>;

export function PowerButton({
  isDisabled = false,
  isPowered,
  variant = 'large',
  onTogglePower,
}: PowerButtonProps) {
  const isHeaderVariant = variant === 'header';
  const activeColor = isPowered ? theme.powerAccent : theme.accent;
  const gradientColors = isPowered ? theme.gradients.danger : theme.gradients.button;

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
        isHeaderVariant ? styles.buttonHeader : styles.buttonLarge,
        isPowered ? styles.buttonOn : styles.buttonOff,
        isDisabled && styles.buttonDisabled,
      ]}
    >
      <GradientView
        colors={gradientColors}
        end={{ x: 0.86, y: 1 }}
        start={{ x: 0.14, y: 0 }}
        style={styles.gradientFill}
      >
        {isPowered ? 
          <PowerOff
            color={activeColor}
            size={isHeaderVariant ? 20 : 34}
            strokeWidth={isHeaderVariant ? 2.35 : 2.4}
          /> :
          <Power
            color={activeColor}
            size={isHeaderVariant ? 20 : 34}
            strokeWidth={isHeaderVariant ? 2.35 : 2.4}
          />
        }
      </GradientView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: theme.paperBackground,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonLarge: {
    height: 90,
    width: 90,
  },
  buttonHeader: {
    height: 48,
    width: 48,
  },
  buttonOn: {
    backgroundColor: theme.powerAccentMuted,
    borderColor: 'rgba(255, 106, 88, 0.58)',
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.26,
    shadowRadius: 16,
  },
  buttonOff: {
    backgroundColor: theme.surfaceWarm,
    borderColor: theme.borderActive,
    shadowColor: '#000000',
    shadowOffset: {
      height: 6,
      width: 0,
    },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  buttonDisabled: {
    opacity: 0.44,
  },
  gradientFill: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
});
