import { useCallback, useMemo } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { theme } from '../theme/theme';
import {
  GAUGE_START_ANGLE,
  GAUGE_SWEEP_ANGLE,
  angleToTemperature,
  describeArc,
  pointToGaugeAngle,
  polarToCartesian,
  temperatureToAngle,
} from '../utils/temperatureGauge';

type TemperatureGaugeProps = {
  size: number;
  temperature: number;
  minTemperature: number;
  maxTemperature: number;
  isPowered: boolean;
  onChangeTemperature: (temperature: number) => void;
  onInteractionEnd?: () => void;
  onInteractionStart?: () => void;
};

export function TemperatureGauge({
  size,
  temperature,
  minTemperature,
  maxTemperature,
  isPowered,
  onChangeTemperature,
  onInteractionEnd,
  onInteractionStart,
}: TemperatureGaugeProps) {
  const strokeWidth = Math.max(16, size * 0.06);
  const center = size / 2;
  const radius = center - strokeWidth - 12;
  const currentAngle = temperatureToAngle(
    temperature,
    minTemperature,
    maxTemperature,
  );
  const thumb = polarToCartesian(center, center, radius, currentAngle);
  const activeArc = describeArc(
    center,
    center,
    radius,
    GAUGE_START_ANGLE,
    currentAngle,
  );
  const trackArc = describeArc(
    center,
    center,
    radius,
    GAUGE_START_ANGLE,
    GAUGE_START_ANGLE + GAUGE_SWEEP_ANGLE,
  );

  const updateFromPoint = useCallback((locationX: number, locationY: number) => {
    if (!isPowered) {
      return;
    }

    const angle = pointToGaugeAngle(locationX, locationY, center);
    onChangeTemperature(
      angleToTemperature(angle, minTemperature, maxTemperature),
    );
  }, [
    center,
    isPowered,
    maxTemperature,
    minTemperature,
    onChangeTemperature,
  ]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
      onMoveShouldSetPanResponder: () => isPowered,
      onStartShouldSetPanResponder: () => isPowered,
      onPanResponderGrant: (event) => {
        onInteractionStart?.();
        updateFromPoint(event.nativeEvent.locationX, event.nativeEvent.locationY);
      },
      onPanResponderMove: (event) => {
        updateFromPoint(event.nativeEvent.locationX, event.nativeEvent.locationY);
      },
      onPanResponderRelease: () => {
        onInteractionEnd?.();
      },
      onPanResponderTerminate: () => {
        onInteractionEnd?.();
      },
    }),
    [
      center,
      isPowered,
      maxTemperature,
      minTemperature,
      onInteractionEnd,
      onInteractionStart,
      onChangeTemperature,
      updateFromPoint,
    ],
  );

  const inactiveStyle = useMemo(() => {
    return isPowered ? undefined : styles.contentInactive;
  }, [isPowered]);

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Temperature"
      accessibilityValue={{
        min: minTemperature,
        max: maxTemperature,
        now: temperature,
        text: `${temperature} degrees Celsius`,
      }}
      style={[styles.container, { height: size, width: size }, inactiveStyle]}
      {...panResponder.panHandlers}
    >
      <Svg height={size} width={size} style={styles.svg}>
        <Defs>
          <LinearGradient id="temperatureGradient" x1="0" x2="1" y1="0" y2="0">
            <Stop offset="0" stopColor={theme.accentBright} />
            <Stop offset="1" stopColor={theme.accentDeep} />
          </LinearGradient>
        </Defs>
        <Path
          d={trackArc}
          fill="none"
          stroke={theme.gaugeTrack}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
        <Path
          d={activeArc}
          fill="none"
          stroke="url(#temperatureGradient)"
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={thumb.x}
          cy={thumb.y}
          fill={theme.thumb}
          r={strokeWidth * 0.42}
          stroke={theme.accentGlow}
          strokeWidth={strokeWidth * 0.38}
        />
      </Svg>

      <View pointerEvents="none" style={styles.rangeLabels}>
        <Text style={styles.rangeText}>{minTemperature}°</Text>
        <Text style={styles.rangeText}>{maxTemperature}°</Text>
      </View>

      <View pointerEvents="none" style={styles.centerContent}>
        <View style={styles.temperatureRow}>
          <Text style={styles.temperatureValue}>{temperature}</Text>
          <Text style={styles.temperatureUnit}>°C</Text>
        </View>
        <Text style={styles.roomLabel}>Room</Text>
        <Text style={styles.roomLabel}>Temperature</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentInactive: {
    opacity: 0.48,
  },
  svg: {
    position: 'absolute',
  },
  rangeLabels: {
    bottom: '20%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: '8%',
    position: 'absolute',
    right: '8%',
  },
  rangeText: {
    color: theme.textMuted,
    fontSize: theme.typography.label,
    fontWeight: '600',
    letterSpacing: 0,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.spacing.lg,
  },
  temperatureRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  temperatureValue: {
    color: theme.text,
    fontSize: theme.typography.temperature,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 68,
  },
  temperatureUnit: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 38,
    marginLeft: theme.spacing.xs,
  },
  roomLabel: {
    color: theme.textSecondary,
    fontSize: theme.typography.label,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 20,
  },
});
