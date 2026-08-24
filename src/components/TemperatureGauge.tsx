import Slider from "@react-native-community/slider";
import { Minus, Plus, Thermometer } from "lucide-react-native";
import { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { theme } from "../theme/theme";

type TemperatureGaugeProps = {
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

export function TemperatureGauge({
  size,
  temperature,
  minTemperature,
  maxTemperature,
  isPowered,
  isDisabled = false,
  onChangeTemperature,
  onInteractionEnd,
  onInteractionStart,
}: TemperatureGaugeProps) {
  const controlsDisabled = !isPowered || isDisabled;
  const roundedTemperature = Math.round(temperature);
  const canDecrease = !controlsDisabled && roundedTemperature > minTemperature;
  const canIncrease = !controlsDisabled && roundedTemperature < maxTemperature;
  const controlWidth = Math.min(size, 520);
  const enabledProgress = useRef(new Animated.Value(controlsDisabled ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(enabledProgress, {
      duration: 220,
      toValue: controlsDisabled ? 0 : 1,
      useNativeDriver: true,
    }).start();
  }, [controlsDisabled, enabledProgress]);

  const animatedContainerStyle = {
    opacity: enabledProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.48, 1],
    }),
  };

  const updateTemperature = useCallback(
    (nextTemperature: number) => {
      onChangeTemperature(Math.round(nextTemperature));
    },
    [onChangeTemperature],
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
      updateTemperature(nextTemperature);
      onInteractionEnd?.();
    },
    [
      controlsDisabled,
      maxTemperature,
      minTemperature,
      onInteractionEnd,
      onInteractionStart,
      roundedTemperature,
      updateTemperature,
    ],
  );

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
      style={[
        styles.container,
        animatedContainerStyle,
      ]}
    >

      <View style={styles.title}>
        <Thermometer color={theme.text} size={18} />
        <Text style={styles.temperatureLabel}>Temperature</Text>
      </View>
      <View pointerEvents="none" style={styles.temperatureBlock}>
        <View style={styles.temperatureValueBlock}>
          <Text style={styles.temperatureValue}>{roundedTemperature}</Text>
          <Text style={styles.temperatureValueUnit}>°C</Text>
        </View>
      </View>

      <View style={styles.sliderRow}>
        <View style={styles.sliderControlRow}>
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

          <View style={styles.sliderWrap}>
            <Slider
              disabled={controlsDisabled}
              maximumTrackTintColor={theme.gaugeTrack}
              maximumValue={maxTemperature}
              minimumTrackTintColor={theme.accent}
              minimumValue={minTemperature}
              onSlidingComplete={() => onInteractionEnd?.()}
              onSlidingStart={() => onInteractionStart?.()}
              onValueChange={updateTemperature}
              step={1}
              style={styles.slider}
              tapToSeek
              thumbTintColor={theme.accentDeep}
              value={roundedTemperature}
            />
            <View pointerEvents="none" style={styles.rangeLabels}>
              <View style={styles.rangeValueBlock}>
                <Text style={styles.rangeText}>{minTemperature}</Text>
                <Text style={styles.rangeTextUnit}>°C</Text>
              </View>
              <View style={styles.rangeValueBlock}>
                <Text style={styles.rangeText}>{maxTemperature}</Text>
                <Text style={styles.rangeTextUnit}>°C</Text>
              </View>
            </View>
          </View>

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
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: theme.spacing.xl,
    width: "100%",
  },
  title: {
    width: "100%",
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6
  },
  temperatureBlock: {
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  temperatureValueBlock: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 2
  },
  temperatureValue: {
    color: theme.text,
    fontSize: 50,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 66,
  },
  temperatureValueUnit: {
    color: theme.text,
    marginTop: 10,
    fontSize: 18,
    fontWeight: "600",
  },
  temperatureLabel: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0,
  },
  sliderRow: {
    alignSelf: "stretch",
    width: "100%",
  },
  sliderControlRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    width: "100%",
  },
  sliderWrap: {
    flex: 1,
    gap: theme.spacing.xs,
    minWidth: 0,
  },
  slider: {
    height: 38,
    width: "100%",
  },
  stepButton: {
    alignItems: "center",
    backgroundColor: theme.controlBackground,
    borderColor: theme.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
    position: 'relative',
    bottom: 8
  },
  stepButtonDisabled: {
    opacity: 0.42,
  },
  rangeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 0,
  },
  rangeValueBlock: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 1,
  },
  rangeText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
  },
  rangeTextUnit: {
    color: theme.textSecondary,
    fontSize: 9,
    fontWeight: "600",
    marginTop: 1,
  },
});
