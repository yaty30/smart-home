import { Fan } from 'lucide-react-native';
import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { theme } from '../theme/theme';
import type { FanSpeed } from '../types/airConditioner';

const fanSteps: FanSpeed[] = [1, 2, 3, 4, 5];

const fanDurations: Record<FanSpeed, number> = {
  1: 2200,
  2: 1650,
  3: 1200,
  4: 820,
  5: 520,
};

type FanSpeedControlProps = {
  speed: FanSpeed;
  isAuto: boolean;
  isPowered: boolean;
  onChangeSpeed: (speed: FanSpeed) => void;
  onChangeAuto: (isAuto: boolean) => void;
};

export function FanSpeedControl({
  speed,
  isAuto,
  isPowered,
  onChangeSpeed,
  onChangeAuto,
}: FanSpeedControlProps) {
  const rotation = useRef(new Animated.Value(0)).current;
  const rotationProgress = useRef(0);
  const duration = useRef(1300);
  const lastFrameTime = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const controlsDisabled = !isPowered || isAuto;

  duration.current = isAuto ? 1300 : fanDurations[speed];

  useEffect(() => {
    if (!isPowered) {
      lastFrameTime.current = null;
      return;
    }

    const animate = (timestamp: number) => {
      if (lastFrameTime.current === null) {
        lastFrameTime.current = timestamp;
      }

      const elapsed = timestamp - lastFrameTime.current;
      lastFrameTime.current = timestamp;
      rotationProgress.current =
        (rotationProgress.current + elapsed / duration.current) % 1;
      rotation.setValue(rotationProgress.current);
      frame.current = requestAnimationFrame(animate);
    };

    frame.current = requestAnimationFrame(animate);

    return () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }
      frame.current = null;
      lastFrameTime.current = null;
    };
  }, [isPowered, rotation]);

  const fanRotation = useMemo(() => {
    return rotation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });
  }, [rotation]);

  return (
    <View style={[styles.container, !isPowered && styles.containerDisabled]}>
      <View style={styles.header}>
        <Text style={styles.label}>Fan Speed</Text>
        <View style={styles.autoControl}>
          <Text style={[styles.autoLabel, isAuto && isPowered && styles.autoLabelActive]}>
            Auto
          </Text>
          <Switch
            accessibilityLabel="Toggle automatic fan speed"
            disabled={!isPowered}
            ios_backgroundColor={theme.controlBackground}
            onValueChange={onChangeAuto}
            thumbColor={isAuto && isPowered ? theme.accentBright : theme.textSecondary}
            trackColor={{
              false: theme.controlBackgroundPressed,
              true: theme.accentMuted,
            }}
            value={isPowered && isAuto}
          />
        </View>
      </View>

      <View style={styles.controlRow}>
        <Animated.View
          style={[
            styles.fanShell,
            isPowered && styles.fanShellActive,
            { transform: [{ rotate: fanRotation }] },
          ]}
        >
          <Fan
            color={isPowered ? theme.accent : theme.textMuted}
            size={24}
            strokeWidth={2.2}
          />
        </Animated.View>

        <View
          accessibilityLabel="Fan speed slider"
          accessibilityState={{ disabled: controlsDisabled }}
          style={[styles.slider, controlsDisabled && styles.sliderDisabled]}
        >
          <View style={styles.track} />
          {fanSteps.map((step) => {
            const active = isPowered && !isAuto && step <= speed;
            const selected = isPowered && !isAuto && step === speed;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: controlsDisabled }}
                disabled={controlsDisabled}
                key={step}
                onPress={() => onChangeSpeed(step)}
                style={styles.stepButton}
              >
                <View
                  style={[
                    styles.stepDot,
                    active && styles.stepDotActive,
                    selected && styles.stepDotSelected,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.paperBackgroundElevated,
    borderColor: theme.border,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  containerDisabled: {
    opacity: 0.58,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: theme.textMuted,
    fontSize: theme.typography.label,
    fontWeight: '600',
    letterSpacing: 0,
  },
  autoControl: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginRight: theme.spacing.md,
  },
  autoLabel: {
    color: theme.textSecondary,
    fontSize: theme.typography.label,
    fontWeight: '700',
    letterSpacing: 0,
  },
  autoLabelActive: {
    color: theme.accent,
  },
  controlRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  fanShell: {
    alignItems: 'center',
    backgroundColor: theme.controlBackground,
    borderColor: theme.border,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  fanShellActive: {
    borderColor: theme.borderActive,
  },
  slider: {
    flex: 1,
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
    position: 'relative',
  },
  sliderDisabled: {
    opacity: 0.48,
  },
  track: {
    backgroundColor: theme.borderStrong,
    height: 2,
    left: 18,
    position: 'absolute',
    right: 18,
    top: 21,
  },
  stepButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 36,
  },
  stepDot: {
    backgroundColor: theme.paperBackground,
    borderColor: theme.textMuted,
    borderRadius: theme.radiusRound,
    borderWidth: 2,
    height: 13,
    width: 13,
  },
  stepDotActive: {
    backgroundColor: theme.accentSubtle,
    borderColor: theme.accent,
  },
  stepDotSelected: {
    backgroundColor: theme.thumb,
    borderColor: theme.accentBright,
    height: 18,
    shadowColor: theme.accent,
    shadowOffset: {
      height: 4,
      width: 0,
    },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    width: 18,
  },
});
