import { Minus, Plus } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  type GestureResponderEvent,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { theme } from "../theme/theme";
import {
  GAUGE_START_ANGLE,
  GAUGE_SWEEP_ANGLE,
  angleToTemperature,
  describeArc,
  pointToGaugeAngle,
  polarToCartesian,
  temperatureToAngle,
} from "../utils/temperatureGauge";

const STROKE_WIDTH = 14;
const KNOB_RADIUS = 13;
const EDGE_PADDING = KNOB_RADIUS + STROKE_WIDTH / 2;

type ArcTemperatureGaugeProps = {
  size: number;
  temperature: number;
  minTemperature: number;
  maxTemperature: number;
  isPowered: boolean;
  isDisabled?: boolean;
  onChangeTemperature: (temperature: number) => void;
  onInteractionEnd?: () => void;
  onInteractionStart?: () => void;
};

export function ArcTemperatureGauge({
  size,
  temperature,
  minTemperature,
  maxTemperature,
  isPowered,
  isDisabled = false,
  onChangeTemperature,
  onInteractionEnd,
  onInteractionStart,
}: ArcTemperatureGaugeProps) {
  const controlsDisabled = !isPowered || isDisabled;
  const roundedTemperature = Math.round(temperature);
  const canDecrease = !controlsDisabled && roundedTemperature > minTemperature;
  const canIncrease = !controlsDisabled && roundedTemperature < maxTemperature;
  const enabledProgress = useRef(
    new Animated.Value(controlsDisabled ? 0 : 1),
  ).current;

  const center = size / 2;
  const radius = center - EDGE_PADDING;
  const arcEndAngle = GAUGE_START_ANGLE + GAUGE_SWEEP_ANGLE;
  const currentAngle = temperatureToAngle(
    roundedTemperature,
    minTemperature,
    maxTemperature,
  );
  const knobPosition = polarToCartesian(center, center, radius, currentAngle);
  const arcStartPoint = polarToCartesian(
    center,
    center,
    radius,
    GAUGE_START_ANGLE,
  );
  const arcEndPoint = polarToCartesian(center, center, radius, arcEndAngle);
  const gaugeHeight =
    Math.max(arcStartPoint.y, arcEndPoint.y) + EDGE_PADDING + 24;

  const latestDisabled = useRef(controlsDisabled);
  latestDisabled.current = controlsDisabled;
  const latestRange = useRef({ max: maxTemperature, min: minTemperature });
  latestRange.current = { max: maxTemperature, min: minTemperature };
  const latestChange = useRef(onChangeTemperature);
  latestChange.current = onChangeTemperature;
  const latestInteractionStart = useRef(onInteractionStart);
  latestInteractionStart.current = onInteractionStart;
  const latestInteractionEnd = useRef(onInteractionEnd);
  latestInteractionEnd.current = onInteractionEnd;
  const latestCenter = useRef(center);
  latestCenter.current = center;

  useEffect(() => {
    Animated.timing(enabledProgress, {
      duration: 220,
      toValue: controlsDisabled ? 0 : 1,
      useNativeDriver: true,
    }).start();
  }, [controlsDisabled, enabledProgress]);

  const handleTouch = useCallback((event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const angle = pointToGaugeAngle(locationX, locationY, latestCenter.current);
    const nextTemperature = angleToTemperature(
      angle,
      latestRange.current.min,
      latestRange.current.max,
    );

    latestChange.current(nextTemperature);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => !latestDisabled.current,
        onPanResponderGrant: (event) => {
          latestInteractionStart.current?.();
          handleTouch(event);
        },
        onPanResponderMove: (event) => {
          handleTouch(event);
        },
        onPanResponderRelease: () => {
          latestInteractionEnd.current?.();
        },
        onPanResponderTerminate: () => {
          latestInteractionEnd.current?.();
        },
        onStartShouldSetPanResponder: () => !latestDisabled.current,
      }),
    [handleTouch],
  );

  const nudgeTemperature = useCallback(
    (direction: -1 | 1) => {
      const nextTemperature = roundedTemperature + direction;

      if (
        controlsDisabled ||
        nextTemperature < minTemperature ||
        nextTemperature > maxTemperature
      ) {
        return;
      }

      onInteractionStart?.();
      onChangeTemperature(nextTemperature);
      onInteractionEnd?.();
    },
    [
      controlsDisabled,
      maxTemperature,
      minTemperature,
      onChangeTemperature,
      onInteractionEnd,
      onInteractionStart,
      roundedTemperature,
    ],
  );

  const animatedContainerStyle = {
    opacity: enabledProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.44, 1],
    }),
  };

  return (
    <Animated.View
      accessibilityLabel="Temperature"
      accessibilityRole="adjustable"
      accessibilityState={{ disabled: controlsDisabled }}
      accessibilityValue={{
        min: minTemperature,
        max: maxTemperature,
        now: roundedTemperature,
        text: `${roundedTemperature} degrees Celsius`,
      }}
      style={[styles.container, animatedContainerStyle]}
    >
      <View
        {...panResponder.panHandlers}
        style={{ height: gaugeHeight, width: size }}
      >
        <Svg height={gaugeHeight} width={size}>
          <Path
            d={describeArc(center, center, radius, GAUGE_START_ANGLE, arcEndAngle)}
            fill="none"
            stroke={theme.gaugeTrack}
            strokeLinecap="round"
            strokeWidth={STROKE_WIDTH}
          />
          {currentAngle > GAUGE_START_ANGLE ? (
            <Path
              d={describeArc(
                center,
                center,
                radius,
                GAUGE_START_ANGLE,
                currentAngle,
              )}
              fill="none"
              stroke={theme.accentSolid}
              strokeLinecap="round"
              strokeWidth={STROKE_WIDTH}
            />
          ) : null}
          <Circle
            cx={knobPosition.x}
            cy={knobPosition.y}
            fill={theme.accentSolid}
            r={KNOB_RADIUS}
            stroke={theme.root}
            strokeWidth={3}
          />
        </Svg>

        <View pointerEvents="none" style={styles.centerBlock}>
          <Text style={styles.temperatureValue}>{roundedTemperature}°C</Text>
          <Text style={styles.temperatureLabel}>Temperature</Text>
        </View>

        <Text
          pointerEvents="none"
          style={[
            styles.rangeLabel,
            {
              left: arcStartPoint.x - 24,
              top: arcStartPoint.y + theme.spacing.sm,
            },
          ]}
        >
          {minTemperature}°C
        </Text>
        <Text
          pointerEvents="none"
          style={[
            styles.rangeLabel,
            {
              left: arcEndPoint.x - 24,
              top: arcEndPoint.y + theme.spacing.sm,
            },
          ]}
        >
          {maxTemperature}°C
        </Text>
      </View>

      <View style={styles.stepRow}>
        <TouchableOpacity
          activeOpacity={0.74}
          accessibilityLabel="Decrease target temperature"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canDecrease }}
          disabled={!canDecrease}
          onPress={() => nudgeTemperature(-1)}
          style={[styles.stepButton, !canDecrease && styles.stepButtonDisabled]}
        >
          <Minus
            color={canDecrease ? theme.text : theme.textMuted}
            size={20}
            strokeWidth={2.5}
          />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.74}
          accessibilityLabel="Increase target temperature"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canIncrease }}
          disabled={!canIncrease}
          onPress={() => nudgeTemperature(1)}
          style={[styles.stepButton, !canIncrease && styles.stepButtonDisabled]}
        >
          <Plus
            color={canIncrease ? theme.text : theme.textMuted}
            size={20}
            strokeWidth={2.5}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: theme.spacing.md,
    width: "100%",
  },
  centerBlock: {
    alignItems: "center",
    bottom: 0,
    gap: 2,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: theme.spacing.lg,
  },
  temperatureValue: {
    color: theme.accentSolid,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 0,
  },
  temperatureLabel: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0,
  },
  rangeLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
    position: "absolute",
    textAlign: "center",
    width: 48,
    marginTop: 10
  },
  stepRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  stepButton: {
    alignItems: "center",
    backgroundColor: theme.controlBackground,
    borderColor: theme.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  stepButtonDisabled: {
    opacity: 0.42,
  },
});
