import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
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

const DEVICE_COMMAND_TIMEOUT_MS = 1500;

export function AirConditionerScreen() {
  const {
    deviceConnectionStatus,
    deviceState,
    disconnectDevice,
    isDeviceConnected,
    pairedDevice,
    reportDeviceUnreachable,
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
  const canControlDevice =
    isDeviceConnected && pairedDevice !== null && deviceState !== null;
  const unavailableStatusText = useMemo(() => {
    if (deviceConnectionStatus === "connecting") {
      return "Reconnecting to ESP32";
    }

    if (deviceConnectionStatus === "connected" && deviceState === null) {
      return "Syncing ESP32 state";
    }

    return "Device offline";
  }, [deviceConnectionStatus, deviceState]);

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

  const logDroppedCommand = useCallback((description: string) => {
    console.log(
      `[Device] Dropped command because ESP32 is offline: ${description}`,
    );
  }, []);

  const sendAcCommand = useCallback(
    async (params: Record<string, string | number>) => {
      const description = Object.entries(params)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(",");

      if (!canControlDevice || pairedDevice === null) {
        logDroppedCommand(description);
        return false;
      }

      const host = pairedDevice.host.replace(/\/+$/, "");
      const searchParams = new URLSearchParams();
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        DEVICE_COMMAND_TIMEOUT_MS,
      );

      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });

      try {
        console.log(`[Device] Command sent immediately: ${description}`);
        const response = await fetch(`${host}/ac?${searchParams.toString()}`, {
          headers: {
            Authorization: `Bearer ${pairedDevice.token}`,
          },
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          console.warn("ESP32 AC request failed", response.status);
          return false;
        }
        return true;
      } catch (error) {
        console.warn("ESP32 AC request failed without retry.", error);
        reportDeviceUnreachable();
        return false;
      } finally {
        clearTimeout(timeout);
      }
    },
    [canControlDevice, logDroppedCommand, pairedDevice, reportDeviceUnreachable],
  );

  const sendDisplayCommand = useCallback(
    async (params: Record<string, string>) => {
      const description = Object.entries(params)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(",");

      if (!canControlDevice || pairedDevice === null) {
        logDroppedCommand(description);
        return false;
      }

      const host = pairedDevice.host.replace(/\/+$/, "");
      const searchParams = new URLSearchParams(params);
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        DEVICE_COMMAND_TIMEOUT_MS,
      );

      try {
        console.log(`[Device] Command sent immediately: ${description}`);
        const response = await fetch(
          `${host}/display?${searchParams.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${pairedDevice.token}`,
            },
            method: "GET",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          console.warn("ESP32 display request failed", response.status);
          return false;
        }
        return true;
      } catch (error) {
        console.warn("ESP32 display request failed without retry.", error);
        reportDeviceUnreachable();
        return false;
      } finally {
        clearTimeout(timeout);
      }
    },
    [canControlDevice, logDroppedCommand, pairedDevice, reportDeviceUnreachable],
  );

  const handleTemperatureChange = useCallback(
    (nextTemperature: number) => {
      if (!canControlDevice) {
        return;
      }

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
    [
      canControlDevice,
      mode,
      temperatureRange.max,
      temperatureRange.min,
      triggerSelectionHaptic,
    ],
  );

  const handleModeChange = useCallback(
    (nextMode: AirConditionerMode) => {
      if (!canControlDevice) {
        logDroppedCommand(`mode=${modeToEspMode(nextMode)}`);
        return;
      }

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
    [
      canControlDevice,
      logDroppedCommand,
      mode,
      sendAcCommand,
      temperature,
      triggerPressHaptic,
    ],
  );

  const handleHorizontalAirflowChange = useCallback(
    (nextLevel: AirflowLevel) => {
      if (!canControlDevice) {
        logDroppedCommand(
          `swingHorizontal=${airflowLevelToEspPosition[nextLevel]}`,
        );
        return;
      }

      triggerPressHaptic();
      setHorizontalAirflowAuto(false);
      setHorizontalAirflow(nextLevel);
      void sendAcCommand({
        swingHorizontal: airflowLevelToEspPosition[nextLevel],
      });
    },
    [canControlDevice, logDroppedCommand, sendAcCommand, triggerPressHaptic],
  );

  const handleVerticalAirflowChange = useCallback(
    (nextLevel: AirflowLevel) => {
      if (!canControlDevice) {
        logDroppedCommand(`swingVertical=${airflowLevelToEspPosition[nextLevel]}`);
        return;
      }

      triggerPressHaptic();
      setVerticalAirflowAuto(false);
      setVerticalAirflow(nextLevel);
      void sendAcCommand({
        swingVertical: airflowLevelToEspPosition[nextLevel],
      });
    },
    [canControlDevice, logDroppedCommand, sendAcCommand, triggerPressHaptic],
  );

  const handleHorizontalAirflowAutoChange = useCallback(
    (nextAuto: boolean) => {
      const nextSwing = nextAuto
        ? "auto"
        : airflowLevelToEspPosition[horizontalAirflow];

      if (!canControlDevice) {
        logDroppedCommand(`swingHorizontal=${nextSwing}`);
        return;
      }

      triggerPressHaptic();
      setHorizontalAirflowAuto(nextAuto);
      void sendAcCommand({
        swingHorizontal: nextSwing,
      });
    },
    [
      canControlDevice,
      horizontalAirflow,
      logDroppedCommand,
      sendAcCommand,
      triggerPressHaptic,
    ],
  );

  const handleVerticalAirflowAutoChange = useCallback(
    (nextAuto: boolean) => {
      const nextSwing = nextAuto ? "auto" : airflowLevelToEspPosition[verticalAirflow];

      if (!canControlDevice) {
        logDroppedCommand(`swingVertical=${nextSwing}`);
        return;
      }

      triggerPressHaptic();
      setVerticalAirflowAuto(nextAuto);
      void sendAcCommand({
        swingVertical: nextSwing,
      });
    },
    [
      canControlDevice,
      logDroppedCommand,
      sendAcCommand,
      triggerPressHaptic,
      verticalAirflow,
    ],
  );

  const handleFanSpeedChange = useCallback(
    (nextSpeed: FanSpeed) => {
      if (!canControlDevice) {
        return;
      }

      if (!fanAuto && fanSpeed === nextSpeed) {
        return;
      }

      triggerPressHaptic();
      latestFanSpeed.current = nextSpeed;
      setFanAuto(false);
      setFanSpeed(nextSpeed);
    },
    [canControlDevice, fanAuto, fanSpeed, triggerPressHaptic],
  );

  const handleFanAutoChange = useCallback(
    (nextFanAuto: boolean) => {
      if (!canControlDevice) {
        logDroppedCommand(`fan=${nextFanAuto ? "auto" : latestFanSpeed.current}`);
        return;
      }

      triggerPressHaptic();
      setFanAuto(nextFanAuto);
      void sendAcCommand({
        fan: nextFanAuto ? "auto" : latestFanSpeed.current,
      });
    },
    [canControlDevice, logDroppedCommand, sendAcCommand, triggerPressHaptic],
  );

  const handleTogglePower = useCallback(() => {
    if (!canControlDevice) {
      logDroppedCommand(`power=${power ? "off" : "on"}`);
      return;
    }

    triggerPressHaptic();
    setPower((currentPower) => {
      const nextPower = !currentPower;
      void sendAcCommand({
        power: nextPower ? "on" : "off",
      });

      return nextPower;
    });
  }, [canControlDevice, logDroppedCommand, power, sendAcCommand, triggerPressHaptic]);

  const handleDisconnectDevice = useCallback(() => {
    triggerPressHaptic();
    void disconnectDevice();
  }, [disconnectDevice, triggerPressHaptic]);

  const handleTemperatureInteractionEnd = useCallback(() => {
    setIsAdjustingTemperature(false);

    if (!canControlDevice) {
      logDroppedCommand(`temp=${latestTemperature.current}`);
      return;
    }

    void sendAcCommand({
      temp: latestTemperature.current,
    });
  }, [canControlDevice, logDroppedCommand, sendAcCommand]);

  const handleFanSpeedInteractionEnd = useCallback(() => {
    setIsAdjustingFanSpeed(false);

    if (!canControlDevice) {
      logDroppedCommand(`fan=${latestFanSpeed.current}`);
      return;
    }

    void sendAcCommand({
      fan: latestFanSpeed.current,
    });
  }, [canControlDevice, logDroppedCommand, sendAcCommand]);

  const handleScreenPowerChange = useCallback(
    (nextScreenOn: boolean) => {
      if (!canControlDevice) {
        logDroppedCommand(`screen=${nextScreenOn ? "on" : "off"}`);
        return;
      }

      triggerPressHaptic();
      setScreenOn(nextScreenOn);
      void sendDisplayCommand({ screen: nextScreenOn ? "on" : "off" });
    },
    [canControlDevice, logDroppedCommand, sendDisplayCommand, triggerPressHaptic],
  );

  const handleQrVisibilityChange = useCallback(
    (nextQrVisible: boolean) => {
      if (!canControlDevice) {
        logDroppedCommand(`qr=${nextQrVisible ? "show" : "hide"}`);
        return;
      }

      triggerPressHaptic();
      setQrVisible(nextQrVisible);
      void sendDisplayCommand({ qr: nextQrVisible ? "show" : "hide" });
    },
    [canControlDevice, logDroppedCommand, sendDisplayCommand, triggerPressHaptic],
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
              isDisabled={!canControlDevice}
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
            {!canControlDevice ? (
              <Text style={styles.connectionStatus}>{unavailableStatusText}</Text>
            ) : null}

            <ModeSelector
              isDisabled={!canControlDevice}
              isPowered={power}
              onChangeMode={handleModeChange}
              selectedMode={mode}
            />

            <View style={styles.controlDivider} />

            <FanSpeedControl
              isAuto={fanAuto}
              isDisabled={!canControlDevice}
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
              isDisabled={!canControlDevice}
              isPowered={power}
              onChangeAuto={handleHorizontalAirflowAutoChange}
              onChangeLevel={handleHorizontalAirflowChange}
              selectedLevel={horizontalAirflow}
            />

            <View style={styles.controlDivider} />

            <VerticalAirflowSelector
              isAuto={verticalAirflowAuto}
              isDisabled={!canControlDevice}
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
              isDisabled={!canControlDevice}
              onChangeQrVisible={handleQrVisibilityChange}
              onChangeScreenOn={handleScreenPowerChange}
              qrVisible={qrVisible}
              screenOn={screenOn}
            />
          </View>

          <View style={styles.powerArea}>
            <PowerButton
              isDisabled={!canControlDevice}
              isPowered={power}
              onTogglePower={handleTogglePower}
            />
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
  connectionStatus: {
    color: theme.textSecondary,
    fontSize: theme.typography.body,
    fontWeight: "700",
    letterSpacing: 0,
    textAlign: "center",
  },
  powerArea: {
    justifyContent: "center",
    minHeight: 128,
    paddingBottom: theme.spacing.xxxl + 20,
    paddingTop: theme.spacing.xl,
  },
});
