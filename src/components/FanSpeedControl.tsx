import { Fan } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  type DimensionValue,
  type LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { theme } from "../theme/theme";
import type { FanSpeed } from "../types/airConditioner";

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
  onInteractionEnd?: () => void;
  onInteractionStart?: () => void;
};

export function FanSpeedControl({
  speed,
  isAuto,
  isPowered,
  onChangeSpeed,
  onChangeAuto,
  onInteractionEnd,
  onInteractionStart,
}: FanSpeedControlProps) {
  const rotation = useRef(new Animated.Value(0)).current;
  const rotationProgress = useRef(0);
  const duration = useRef(1300);
  const lastFrameTime = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const [sliderWidth, setSliderWidth] = useState(0);
  const controlsDisabled = !isPowered;
  const canAdjustSpeed = isPowered;
  const displayedSpeed = isAuto ? fanSteps.length : speed;
  const activeTrackWidth: DimensionValue = `${((displayedSpeed - 1) / (fanSteps.length - 1)) * 100}%`;
  const thumbLeft: DimensionValue = activeTrackWidth;

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
      outputRange: ["0deg", "360deg"],
    });
  }, [rotation]);

  const handleSliderLayout = useCallback((event: LayoutChangeEvent) => {
    setSliderWidth(event.nativeEvent.layout.width);
  }, []);

  const handleSpeedFromLocation = useCallback(
    (locationX: number) => {
      if (!canAdjustSpeed || sliderWidth <= 0) {
        return;
      }

      const boundedX = Math.min(Math.max(locationX, 0), sliderWidth);
      const nextStep = Math.round(
        (boundedX / sliderWidth) * (fanSteps.length - 1),
      );
      onChangeSpeed((nextStep + 1) as FanSpeed);
    },
    [canAdjustSpeed, onChangeSpeed, sliderWidth],
  );

  const sliderPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: () => canAdjustSpeed,
        onMoveShouldSetPanResponder: () => canAdjustSpeed,
        onPanResponderTerminationRequest: () => false,
        onStartShouldSetPanResponder: () => canAdjustSpeed,
        onPanResponderGrant: (event) => {
          onInteractionStart?.();
          handleSpeedFromLocation(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          handleSpeedFromLocation(event.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          onInteractionEnd?.();
        },
        onPanResponderTerminate: () => {
          onInteractionEnd?.();
        },
      }),
    [
      canAdjustSpeed,
      handleSpeedFromLocation,
      onInteractionEnd,
      onInteractionStart,
    ],
  );

  return (
    <View style={[styles.container, !isPowered && styles.containerDisabled]}>
      <View style={styles.header}>
        <Text style={styles.label}>Fan Speed</Text>
        <View style={styles.autoControl}>
          <Text
            style={[
              styles.autoLabel,
              isAuto && isPowered && styles.autoLabelActive,
            ]}
          >
            Auto
          </Text>
          <Switch
            accessibilityLabel="Toggle automatic fan speed"
            disabled={!isPowered}
            ios_backgroundColor={theme.controlBackground}
            onValueChange={onChangeAuto}
            thumbColor={
              isAuto && isPowered ? theme.accentBright : theme.textSecondary
            }
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
          accessibilityRole="adjustable"
          accessibilityState={{ disabled: controlsDisabled }}
          accessibilityValue={{
            min: 1,
            max: 5,
            now: speed,
            text: `Fan speed ${speed}`,
          }}
          onLayout={handleSliderLayout}
          style={[styles.slider, controlsDisabled && styles.sliderDisabled]}
          {...sliderPanResponder.panHandlers}
        >
          <View pointerEvents="none" style={styles.track}>
            <View
              style={[
                styles.trackActive,
                { width: isPowered ? activeTrackWidth : 0 },
              ]}
            />
          </View>
          {!isAuto ? (
            <View
              pointerEvents="none"
              style={[
                styles.sliderValue,
                isPowered && styles.sliderValueActive,
                { left: thumbLeft },
              ]}
            >
              <Text style={styles.sliderValueText}>{speed}</Text>
            </View>
          ) : null}
          <View
            pointerEvents="none"
            style={[
              styles.sliderThumb,
              isPowered && styles.sliderThumbActive,
              { left: thumbLeft },
            ]}
          />
          <View pointerEvents="none" style={styles.stepAnchors}>
            {fanSteps.map((step) => (
              <View
                accessibilityLabel={`Set fan speed level ${step}`}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: controlsDisabled,
                  selected: speed === step,
                }}
                key={step}
                style={styles.stepAnchor}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
  },
  containerDisabled: {
    opacity: 0.58,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: theme.textMuted,
    fontSize: theme.typography.label,
    fontWeight: "600",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  autoControl: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginRight: theme.spacing.md,
  },
  autoLabel: {
    color: theme.textSecondary,
    fontSize: theme.typography.label,
    fontWeight: "700",
    letterSpacing: 0,
  },
  autoLabelActive: {
    color: theme.accent,
  },
  controlRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xl,
    paddingRight: 14
  },
  fanShell: {
    alignItems: "center",
    backgroundColor: theme.controlBackground,
    borderColor: theme.border,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  fanShellActive: {
    borderColor: theme.borderActive,
  },
  slider: {
    flex: 1,
    height: 42,
    justifyContent: "flex-start",
    maxWidth: '100%',
    position: "relative",
  },
  sliderDisabled: {
    opacity: 0.48,
  },
  track: {
    backgroundColor: theme.borderStrong,
    borderRadius: theme.radiusRound,
    height: 4,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 25,
  },
  trackActive: {
    backgroundColor: theme.accent,
    height: 4,
  },
  sliderThumb: {
    backgroundColor: theme.thumb,
    borderColor: theme.accentBright,
    borderRadius: theme.radiusRound,
    borderWidth: 1.5,
    height: 12,
    marginLeft: -6,
    position: "absolute",
    top: 21,
    width: 12,
  },
  sliderThumbActive: {
    shadowColor: theme.accent,
    shadowOffset: {
      height: 2,
      width: 0,
    },
    shadowOpacity: 0.22,
    shadowRadius: 6,
  },
  sliderValue: {
    alignItems: "center",
    backgroundColor: theme.controlBackgroundPressed,
    borderRadius: theme.spacing.xs,
    height: 18,
    justifyContent: "center",
    marginLeft: -9,
    position: "absolute",
    top: 0,
    width: 18,
  },
  sliderValueActive: {
    backgroundColor: theme.accent,
  },
  sliderValueText: {
    color: theme.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 13,
  },
  stepAnchors: {
    bottom: 0,
    flexDirection: "row",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  stepAnchor: {
    flex: 1,
  },
});
