import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { ACHeader } from '../components/ACHeader';
import {
  HorizontalAirflowSelector,
  VerticalAirflowSelector,
} from '../components/AirflowSelectors';
import { FanSpeedControl } from '../components/FanSpeedControl';
import { ModeSelector } from '../components/ModeSelector';
import { PowerButton } from '../components/PowerButton';
import { TemperatureGauge } from '../components/TemperatureGauge';
import { theme } from '../theme/theme';
import type {
  AirConditionerMode,
  AirflowLevel,
  FanSpeed,
} from '../types/airConditioner';
import {
  HEAT_MAX_TEMPERATURE,
  HEAT_MIN_TEMPERATURE,
  MAX_TEMPERATURE,
  MIN_TEMPERATURE,
  normalizeTemperature,
} from '../utils/temperatureGauge';

const temperatureRangeForMode = (mode: AirConditionerMode) => {
  if (mode === 'heat') {
    return {
      min: HEAT_MIN_TEMPERATURE,
      max: HEAT_MAX_TEMPERATURE,
    };
  }

  return {
    min: MIN_TEMPERATURE,
    max: MAX_TEMPERATURE,
  };
};

export function AirConditionerScreen() {
  const { height, width } = useWindowDimensions();
  const [temperature, setTemperature] = useState(24);
  const [mode, setMode] = useState<AirConditionerMode>('auto');
  const [horizontalAirflow, setHorizontalAirflow] =
    useState<AirflowLevel>('three');
  const [horizontalAirflowAuto, setHorizontalAirflowAuto] = useState(true);
  const [verticalAirflow, setVerticalAirflow] = useState<AirflowLevel>('one');
  const [verticalAirflowAuto, setVerticalAirflowAuto] = useState(true);
  const [fanSpeed, setFanSpeed] = useState<FanSpeed>(3);
  const [fanAuto, setFanAuto] = useState(true);
  const [power, setPower] = useState(true);
  const [isAdjustingTemperature, setIsAdjustingTemperature] = useState(false);
  const latestTemperature = useRef(temperature);
  const modeTemperatures = useRef<Partial<Record<AirConditionerMode, number>>>({
    auto: 24,
  });

  const gaugeSize = useMemo(() => {
    const availableWidth = width - theme.spacing.xl * 2;
    const availableHeight = height * 0.39;
    const baseSize = Math.min(Math.max(availableWidth, 278), availableHeight, 372);
    return baseSize * 0.85;
  }, [height, width]);

  const temperatureRange = useMemo(() => {
    return temperatureRangeForMode(mode);
  }, [mode]);

  const triggerSelectionHaptic = useCallback(() => {
    void Haptics.selectionAsync();
  }, []);

  const triggerPressHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleTemperatureChange = useCallback(
    (nextTemperature: number) => {
      const normalizedTemperature = normalizeTemperature(
        nextTemperature,
        temperatureRange.min,
        temperatureRange.max,
      );

      if (latestTemperature.current === normalizedTemperature) {
        return;
      }

      latestTemperature.current = normalizedTemperature;
      modeTemperatures.current[mode] = normalizedTemperature;
      triggerSelectionHaptic();
      setTemperature(normalizedTemperature);
    },
    [mode, temperatureRange.max, temperatureRange.min, triggerSelectionHaptic],
  );

  const handleModeChange = useCallback(
    (nextMode: AirConditionerMode) => {
      triggerPressHaptic();
      const nextRange = temperatureRangeForMode(nextMode);
      modeTemperatures.current[mode] = temperature;

      const savedTemperature = modeTemperatures.current[nextMode] ?? temperature;
      const nextTemperature = normalizeTemperature(
        savedTemperature,
        nextRange.min,
        nextRange.max,
      );

      modeTemperatures.current[nextMode] = nextTemperature;
      latestTemperature.current = nextTemperature;
      setMode(nextMode);
      setTemperature(nextTemperature);
    },
    [mode, temperature, triggerPressHaptic],
  );

  const handleHorizontalAirflowChange = useCallback(
    (nextLevel: AirflowLevel) => {
      triggerPressHaptic();
      setHorizontalAirflowAuto(false);
      setHorizontalAirflow(nextLevel);
    },
    [triggerPressHaptic],
  );

  const handleVerticalAirflowChange = useCallback(
    (nextLevel: AirflowLevel) => {
      triggerPressHaptic();
      setVerticalAirflowAuto(false);
      setVerticalAirflow(nextLevel);
    },
    [triggerPressHaptic],
  );

  const handleHorizontalAirflowAutoChange = useCallback(
    (nextAuto: boolean) => {
      triggerPressHaptic();
      setHorizontalAirflowAuto(nextAuto);
    },
    [triggerPressHaptic],
  );

  const handleVerticalAirflowAutoChange = useCallback(
    (nextAuto: boolean) => {
      triggerPressHaptic();
      setVerticalAirflowAuto(nextAuto);
    },
    [triggerPressHaptic],
  );

  const handleFanSpeedChange = useCallback(
    (nextSpeed: FanSpeed) => {
      triggerPressHaptic();

      if (fanSpeed === nextSpeed) {
        return;
      }

      setFanSpeed(nextSpeed);
    },
    [fanSpeed, triggerPressHaptic],
  );

  const handleFanAutoChange = useCallback(
    (nextFanAuto: boolean) => {
      triggerPressHaptic();
      setFanAuto(nextFanAuto);
    },
    [triggerPressHaptic],
  );

  const handleTogglePower = useCallback(() => {
    triggerPressHaptic();
    setPower((currentPower) => !currentPower);
  }, [triggerPressHaptic]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          scrollEnabled={!isAdjustingTemperature}
          showsVerticalScrollIndicator={false}
        >
          <ACHeader location="Working Space" />

          <View style={styles.gaugeSection}>
            <TemperatureGauge
              isPowered={power}
              maxTemperature={temperatureRange.max}
              minTemperature={temperatureRange.min}
              onChangeTemperature={handleTemperatureChange}
              onInteractionEnd={() => setIsAdjustingTemperature(false)}
              onInteractionStart={() => setIsAdjustingTemperature(true)}
              size={gaugeSize}
              temperature={temperature}
            />
          </View>

          <View style={styles.controls}>
            <FanSpeedControl
              isAuto={fanAuto}
              isPowered={power}
              onChangeAuto={handleFanAutoChange}
              onChangeSpeed={handleFanSpeedChange}
              speed={fanSpeed}
            />

            <ModeSelector
              isPowered={power}
              onChangeMode={handleModeChange}
              selectedMode={mode}
            />

            <HorizontalAirflowSelector
              isAuto={horizontalAirflowAuto}
              isPowered={power}
              onChangeAuto={handleHorizontalAirflowAutoChange}
              onChangeLevel={handleHorizontalAirflowChange}
              selectedLevel={horizontalAirflow}
            />

            <VerticalAirflowSelector
              isAuto={verticalAirflowAuto}
              isPowered={power}
              onChangeAuto={handleVerticalAirflowAutoChange}
              onChangeLevel={handleVerticalAirflowChange}
              selectedLevel={verticalAirflow}
            />
          </View>

          <View style={styles.powerArea}>
            <PowerButton isPowered={power} onTogglePower={handleTogglePower} />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.root,
    flex: 1,
  },
  screen: {
    backgroundColor: theme.root,
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  gaugeSection: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 213,
    paddingHorizontal: theme.spacing.xl,
  },
  controls: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
  },
  powerArea: {
    justifyContent: 'center',
    minHeight: 124,
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
});
