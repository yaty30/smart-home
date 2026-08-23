import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { ACHeader } from "../components/ACHeader";
import {
  HorizontalAirflowSelector,
  VerticalAirflowSelector,
} from "../components/AirflowSelectors";
import { FanSpeedControl } from "../components/FanSpeedControl";
import { DisplayControls } from "../components/DisplayControls";
import { ModeSelector } from "../components/ModeSelector";
import { PowerButton } from "../components/PowerButton";
import { TemperatureGauge } from "../components/TemperatureGauge";
import { useDeviceConnection } from "../context/DeviceConnectionContext";
import { theme } from "../theme/theme";
import type {
  AirConditionerMode,
  AirflowLevel,
  FanSpeed,
} from "../types/airConditioner";
import {
  HEAT_MAX_TEMPERATURE,
  HEAT_MIN_TEMPERATURE,
  MAX_TEMPERATURE,
  MIN_TEMPERATURE,
  normalizeTemperature,
} from "../utils/temperatureGauge";

const temperatureRangeForMode = (mode: AirConditionerMode) => {
  if (mode === "heat") {
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

const modeToEspMode = (mode: AirConditionerMode) => {
  switch (mode) {
    case "auto":
      return "auto";
    case "cold":
      return "cool";
    case "dry":
      return "dry";
    case "heat":
      return "heat";
    case "fan":
      return "fan";
    default:
      return "cool";
  }
};

const airflowLevelToEspPosition: Record<AirflowLevel, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
};

const espPositionToAirflowLevel: Record<"1" | "2" | "3" | "4" | "5", AirflowLevel> = {
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
};

export function AirConditionerScreen() {
  const {
    deviceState,
    disconnectDevice,
    isDeviceConnected,
    pairedDevice,
  } = useDeviceConnection();
  const { height, width } = useWindowDimensions();
  const [temperature, setTemperature] = useState(24);
  const [mode, setMode] = useState<AirConditionerMode>("auto");
  const [horizontalAirflow, setHorizontalAirflow] =
    useState<AirflowLevel>("three");
  const [horizontalAirflowAuto, setHorizontalAirflowAuto] = useState(true);
  const [verticalAirflow, setVerticalAirflow] = useState<AirflowLevel>("one");
  const [verticalAirflowAuto, setVerticalAirflowAuto] = useState(true);
  const [fanSpeed, setFanSpeed] = useState<FanSpeed>(3);
  const [fanAuto, setFanAuto] = useState(true);
  const [power, setPower] = useState(true);
  const [screenOn, setScreenOn] = useState(true);
  const [qrVisible, setQrVisible] = useState(false);
  const [isAdjustingTemperature, setIsAdjustingTemperature] = useState(false);
  const [isAdjustingFanSpeed, setIsAdjustingFanSpeed] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const latestTemperature = useRef(temperature);
  const latestFanSpeed = useRef<FanSpeed>(fanSpeed);
  const latestHeaderScrolled = useRef(false);
  const modeTemperatures = useRef<Partial<Record<AirConditionerMode, number>>>({
    auto: 24,
  });

  const gaugeSize = useMemo(() => {
    const availableWidth = width - theme.spacing.xl * 2;
    const availableHeight = height * 0.39;
    const baseSize = Math.min(
      Math.max(availableWidth, 278),
      availableHeight,
      372,
    );
    return baseSize * 0.85;
  }, [height, width]);

  const temperatureRange = useMemo(() => {
    return temperatureRangeForMode(mode);
  }, [mode]);

  useEffect(() => {
    if (deviceState === null) {
      return;
    }

    const nextMode: AirConditionerMode =
      deviceState.ac.mode === "cool" ? "cold" : deviceState.ac.mode;
    const nextTemperature = deviceState.ac.temperature;
    latestTemperature.current = nextTemperature;
    modeTemperatures.current[nextMode] = nextTemperature;
    setTemperature(nextTemperature);
    setMode(nextMode);
    setPower(deviceState.ac.power);

    if (deviceState.ac.fan === "auto") {
      setFanAuto(true);
    } else {
      const nextFanSpeed = Number(deviceState.ac.fan) as FanSpeed;
      latestFanSpeed.current = nextFanSpeed;
      setFanSpeed(nextFanSpeed);
      setFanAuto(false);
    }

    if (deviceState.ac.swingHorizontal === "auto") {
      setHorizontalAirflowAuto(true);
    } else {
      setHorizontalAirflow(
        espPositionToAirflowLevel[deviceState.ac.swingHorizontal],
      );
      setHorizontalAirflowAuto(false);
    }

    if (deviceState.ac.swingVertical === "auto") {
      setVerticalAirflowAuto(true);
    } else {
      setVerticalAirflow(
        espPositionToAirflowLevel[deviceState.ac.swingVertical],
      );
      setVerticalAirflowAuto(false);
    }

    setScreenOn(deviceState.display.screenOn);
    setQrVisible(deviceState.display.qrVisible);
  }, [deviceState]);

  const triggerSelectionHaptic = useCallback(() => {
    void Haptics.selectionAsync();
  }, []);

  const triggerPressHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const sendAcCommand = useCallback(
    async (params: Record<string, string | number>) => {
      if (pairedDevice === null) {
        return;
      }

      const host = pairedDevice.host.replace(/\/+$/, "");
      const searchParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });

      try {
        const response = await fetch(`${host}/ac?${searchParams.toString()}`, {
          headers: {
            Authorization: `Bearer ${pairedDevice.token}`,
          },
          method: "GET",
        });

        if (!response.ok) {
          console.warn("ESP32 AC request failed", response.status);
        }
      } catch (error) {
        console.warn("ESP32 AC request could not be sent.", error);
      }
    },
    [pairedDevice],
  );

  const sendDisplayCommand = useCallback(
    async (params: Record<string, string>) => {
      if (pairedDevice === null) {
        return;
      }

      const host = pairedDevice.host.replace(/\/+$/, "");
      const searchParams = new URLSearchParams(params);

      try {
        const response = await fetch(
          `${host}/display?${searchParams.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${pairedDevice.token}`,
            },
            method: "GET",
          },
        );

        if (!response.ok) {
          console.warn("ESP32 display request failed", response.status);
        }
      } catch (error) {
        console.warn("ESP32 display request could not be sent.", error);
      }
    },
    [pairedDevice],
  );

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

      const savedTemperature =
        modeTemperatures.current[nextMode] ?? temperature;
      const nextTemperature = normalizeTemperature(
        savedTemperature,
        nextRange.min,
        nextRange.max,
      );

      modeTemperatures.current[nextMode] = nextTemperature;
      latestTemperature.current = nextTemperature;
      setMode(nextMode);
      setTemperature(nextTemperature);
      void sendAcCommand({
        mode: modeToEspMode(nextMode),
        temp: nextTemperature,
      });
    },
    [mode, sendAcCommand, temperature, triggerPressHaptic],
  );

  const handleHorizontalAirflowChange = useCallback(
    (nextLevel: AirflowLevel) => {
      triggerPressHaptic();
      setHorizontalAirflowAuto(false);
      setHorizontalAirflow(nextLevel);
      void sendAcCommand({
        swingHorizontal: airflowLevelToEspPosition[nextLevel],
      });
    },
    [sendAcCommand, triggerPressHaptic],
  );

  const handleVerticalAirflowChange = useCallback(
    (nextLevel: AirflowLevel) => {
      triggerPressHaptic();
      setVerticalAirflowAuto(false);
      setVerticalAirflow(nextLevel);
      void sendAcCommand({
        swingVertical: airflowLevelToEspPosition[nextLevel],
      });
    },
    [sendAcCommand, triggerPressHaptic],
  );

  const handleHorizontalAirflowAutoChange = useCallback(
    (nextAuto: boolean) => {
      triggerPressHaptic();
      setHorizontalAirflowAuto(nextAuto);
      void sendAcCommand({
        swingHorizontal: nextAuto
          ? "auto"
          : airflowLevelToEspPosition[horizontalAirflow],
      });
    },
    [horizontalAirflow, sendAcCommand, triggerPressHaptic],
  );

  const handleVerticalAirflowAutoChange = useCallback(
    (nextAuto: boolean) => {
      triggerPressHaptic();
      setVerticalAirflowAuto(nextAuto);
      void sendAcCommand({
        swingVertical: nextAuto
          ? "auto"
          : airflowLevelToEspPosition[verticalAirflow],
      });
    },
    [sendAcCommand, triggerPressHaptic, verticalAirflow],
  );

  const handleFanSpeedChange = useCallback(
    (nextSpeed: FanSpeed) => {
      if (!fanAuto && fanSpeed === nextSpeed) {
        return;
      }

      triggerPressHaptic();
      latestFanSpeed.current = nextSpeed;
      setFanAuto(false);
      setFanSpeed(nextSpeed);
    },
    [fanAuto, fanSpeed, triggerPressHaptic],
  );

  const handleFanAutoChange = useCallback(
    (nextFanAuto: boolean) => {
      triggerPressHaptic();
      setFanAuto(nextFanAuto);
      void sendAcCommand({
        fan: nextFanAuto ? "auto" : latestFanSpeed.current,
      });
    },
    [sendAcCommand, triggerPressHaptic],
  );

  const handleTogglePower = useCallback(() => {
    triggerPressHaptic();
    setPower((currentPower) => {
      const nextPower = !currentPower;
      void sendAcCommand({
        power: nextPower ? "on" : "off",
      });

      return nextPower;
    });
  }, [sendAcCommand, triggerPressHaptic]);

  const handleDisconnectDevice = useCallback(() => {
    triggerPressHaptic();
    void disconnectDevice();
  }, [disconnectDevice, triggerPressHaptic]);

  const handleTemperatureInteractionEnd = useCallback(() => {
    setIsAdjustingTemperature(false);
    void sendAcCommand({
      temp: latestTemperature.current,
    });
  }, [sendAcCommand]);

  const handleFanSpeedInteractionEnd = useCallback(() => {
    setIsAdjustingFanSpeed(false);
    void sendAcCommand({
      fan: latestFanSpeed.current,
    });
  }, [sendAcCommand]);

  const handleScreenPowerChange = useCallback(
    (nextScreenOn: boolean) => {
      triggerPressHaptic();
      setScreenOn(nextScreenOn);
      void sendDisplayCommand({ screen: nextScreenOn ? "on" : "off" });
    },
    [sendDisplayCommand, triggerPressHaptic],
  );

  const handleQrVisibilityChange = useCallback(
    (nextQrVisible: boolean) => {
      triggerPressHaptic();
      setQrVisible(nextQrVisible);
      void sendDisplayCommand({ qr: nextQrVisible ? "show" : "hide" });
    },
    [sendDisplayCommand, triggerPressHaptic],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIsHeaderScrolled = event.nativeEvent.contentOffset.y > 0;

      if (latestHeaderScrolled.current === nextIsHeaderScrolled) {
        return;
      }

      latestHeaderScrolled.current = nextIsHeaderScrolled;
      setIsHeaderScrolled(nextIsHeaderScrolled);
    },
    [],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          scrollEnabled={!isAdjustingTemperature && !isAdjustingFanSpeed}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[0]}
        >
          <ACHeader
            isScrolled={isHeaderScrolled}
            location="Working Space"
            onBackPress={handleDisconnectDevice}
          />

          <View style={styles.gaugeSection}>
            <TemperatureGauge
              isPowered={power}
              maxTemperature={temperatureRange.max}
              minTemperature={temperatureRange.min}
              onChangeTemperature={handleTemperatureChange}
              onInteractionEnd={handleTemperatureInteractionEnd}
              onInteractionStart={() => setIsAdjustingTemperature(true)}
              size={gaugeSize}
              temperature={temperature}
            />
          </View>

          <View style={styles.controls}>
            <ModeSelector
              isPowered={power}
              onChangeMode={handleModeChange}
              selectedMode={mode}
            />

            <View style={styles.controlDivider} />

            <FanSpeedControl
              isAuto={fanAuto}
              isPowered={power}
              onChangeAuto={handleFanAutoChange}
              onChangeSpeed={handleFanSpeedChange}
              onInteractionEnd={handleFanSpeedInteractionEnd}
              onInteractionStart={() => setIsAdjustingFanSpeed(true)}
              speed={fanSpeed}
            />

            <View style={styles.controlDivider} />

            <HorizontalAirflowSelector
              isAuto={horizontalAirflowAuto}
              isPowered={power}
              onChangeAuto={handleHorizontalAirflowAutoChange}
              onChangeLevel={handleHorizontalAirflowChange}
              selectedLevel={horizontalAirflow}
            />

            <View style={styles.controlDivider} />

            <VerticalAirflowSelector
              isAuto={verticalAirflowAuto}
              isPowered={power}
              onChangeAuto={handleVerticalAirflowAutoChange}
              onChangeLevel={handleVerticalAirflowChange}
              selectedLevel={verticalAirflow}
            />

            <View style={styles.controlDivider} />

            <DisplayControls
              canControlQr={
                isDeviceConnected &&
                deviceState?.display.pairingMode !== true
              }
              onChangeQrVisible={handleQrVisibilityChange}
              onChangeScreenOn={handleScreenPowerChange}
              qrVisible={qrVisible}
              screenOn={screenOn}
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
    alignItems: "center",
    justifyContent: "center",
    minHeight: 213,
    paddingHorizontal: theme.spacing.xl,
  },
  controls: {
    backgroundColor: theme.surfaceLow,
    borderColor: theme.borderStrong,
    borderRadius: theme.radiusLarge,
    borderWidth: 1,
    gap: theme.spacing.lg,
    marginHorizontal: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    shadowColor: "#000000",
    shadowOffset: {
      height: 14,
      width: 0,
    },
    shadowOpacity: 0.22,
    shadowRadius: 24,
  },
  controlDivider: {
    backgroundColor: theme.border,
    height: 1,
    width: "100%",
  },
  powerArea: {
    justifyContent: "center",
    minHeight: 128,
    paddingBottom: theme.spacing.xxxl + 20,
    paddingTop: theme.spacing.xl,
  },
});
