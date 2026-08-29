import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { CalendarClock, Ellipsis, Star } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { ACHeader } from "../components/ACHeader";
import { useBottomNavAnimation } from "../hooks/useBottomNavAnimation";
import type { RootStackNavigationProp } from "../navigation/types";
import { AcLiveControls } from "../components/ac/AcLiveControls";
import { AcModePillRow } from "../components/ac/AcModePillRow";
import { AcTemperatureCard } from "../components/ac/AcTemperatureCard";
import { AnimatedBottomNav } from "../components/AnimatedBottomNav";
import {
  SCREEN_BOTTOM_SAFE_PADDING,
  ScreenView,
} from "../components/ScreenView";
import { BOTTOM_NAV_CLEARANCE } from "../components/BottomNav";
import { useDeviceConnection } from "../context/DeviceConnectionContext";
import {
  deleteAcScheduleFromDevice,
  getAcScheduleFromDevice,
  putAcScheduleToDevice,
} from "../api/acScheduleApi";
import {
  getAcSchedule,
  removeAcSchedule,
  saveAcSchedule,
} from "../storage/acScheduleStorage";
import { AcScheduleSheet } from "../components/AcScheduleSheet";
import { type Theme, useTheme } from "../theme/theme";
import type { AcSchedule } from "../types/acSchedule";
import type {
  AirConditionerMode,
  AirflowLevel,
  FanSpeed,
} from "../types/airConditioner";
import type {
  DeviceStateSnapshot,
  EspAirflow,
  EspFanSpeed,
} from "../types/device";
import { temperatureRangeForMode } from "../constants/acModes";
import { normalizeTemperature } from "../utils/temperatureGauge";
import { HeaderIconButton } from "../components/AppHeader";
import { useDevices } from "../store/devices";

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

const airflowLevelToEspPosition: Record<
  AirflowLevel,
  Exclude<EspAirflow, "auto">
> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
};

const espPositionToAirflowLevel: Record<
  "1" | "2" | "3" | "4" | "5",
  AirflowLevel
> = {
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
};

const DEVICE_COMMAND_TIMEOUT_MS = 1500;
const TEMPERATURE_COMMAND_DEBOUNCE_MS = 400;

type AirConditionerScreenProps = {
  deviceId: string;
  onBackPress: () => void;
};

export function AirConditionerScreen({
  deviceId,
  onBackPress,
}: AirConditionerScreenProps) {
  const {
    deviceConnectionStatus,
    debugMode,
    deviceState,
    isDeviceConnected,
    pairedDevice,
    reportDeviceUnreachable,
    updateDeviceState,
  } = useDeviceConnection();
  const navigation = useNavigation<RootStackNavigationProp<"DeviceControl">>();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width } = useWindowDimensions();
  const {
    animateBottomNavOut,
    bottomNavOpacity,
    bottomNavTranslateY,
    isLeavingScreen,
  } = useBottomNavAnimation({ navigation });
  const { clearFavouriteDevice, devices, setFavouriteDevice } = useDevices();
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
  const [quiet, setQuiet] = useState(false);
  const [powerful, setPowerful] = useState(false);
  const [isAdjustingTemperature, setIsAdjustingTemperature] = useState(false);
  const [isScheduleSheetVisible, setIsScheduleSheetVisible] = useState(false);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [schedule, setSchedule] = useState<AcSchedule | null>(null);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const latestTemperature = useRef(temperature);
  const latestFanSpeed = useRef<FanSpeed>(fanSpeed);
  const latestHeaderScrolled = useRef(false);
  const scheduleMutationVersion = useRef(0);
  const temperatureCommandTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const controlEnabledProgress = useRef(new Animated.Value(1)).current;
  const modeTemperatures = useRef<Partial<Record<AirConditionerMode, number>>>({
    auto: 24,
  });

  const gaugeSize = useMemo(() => {
    return Math.min(width - theme.spacing.xl * 5, 300);
  }, [width]);

  const temperatureRange = useMemo(() => {
    return temperatureRangeForMode(mode);
  }, [mode]);
  const canControlDevice =
    isDeviceConnected && pairedDevice !== null && deviceState !== null;
  const liveControlsEnabled = canControlDevice && power;
  const quietControlEnabled = canControlDevice && power;
  const powerfulControlEnabled = canControlDevice && power;
  const unavailableStatusText = useMemo(() => {
    if (deviceConnectionStatus === "connecting") {
      return "Reconnecting to ESP32";
    }

    if (deviceConnectionStatus === "connected" && deviceState === null) {
      return "Off";
    }

    return "Off";
  }, [deviceConnectionStatus, deviceState]);

  const scheduleDeviceKey =
    pairedDevice === null ? null : `${pairedDevice.host}|${pairedDevice.token}`;
  const powerStatusText = canControlDevice
    ? power
      ? "On"
      : "Off"
    : unavailableStatusText;

  useEffect(() => {
    if (pairedDevice === null) {
      setSchedule(null);
      setIsScheduleLoading(false);
      return;
    }

    let cancelled = false;
    const loadVersion = scheduleMutationVersion.current;
    setIsScheduleLoading(true);

    const loadSchedule = debugMode
      ? getAcSchedule(pairedDevice)
      : getAcScheduleFromDevice(pairedDevice);

    void loadSchedule
      .then((fetchedSchedule) => {
        if (cancelled || scheduleMutationVersion.current !== loadVersion) return;
        setSchedule(fetchedSchedule);
      })
      .catch(() => {
        if (cancelled || scheduleMutationVersion.current !== loadVersion) return;
        setSchedule(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsScheduleLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debugMode, scheduleDeviceKey]);

  useEffect(() => {
    Animated.timing(controlEnabledProgress, {
      duration: 220,
      toValue: liveControlsEnabled ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [controlEnabledProgress, liveControlsEnabled]);

  const liveLabelDimStyle = {
    opacity: controlEnabledProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.52, 1],
    }),
  };

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

    setQuiet(deviceState.ac.power ? deviceState.ac.quiet : false);
    setPowerful(deviceState.ac.power ? deviceState.ac.powerful : false);
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

  const updateAcSnapshot = useCallback(
    (acPatch: Partial<DeviceStateSnapshot["ac"]>) => {
      updateDeviceState((currentState) =>
        currentState === null
          ? currentState
          : {
            ...currentState,
            ac: {
              ...currentState.ac,
              ...acPatch,
            },
          },
      );
    },
    [updateDeviceState],
  );

  const sendAcCommand = useCallback(
    async (params: Record<string, string | number>) => {
      const description = Object.entries(params)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(",");

      if (!canControlDevice || pairedDevice === null) {
        logDroppedCommand(description);
        return false;
      }

      if (debugMode) {
        console.log(`[Device] Debug command accepted: ${description}`);
        return true;
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
    [
      canControlDevice,
      debugMode,
      logDroppedCommand,
      pairedDevice,
      reportDeviceUnreachable,
    ],
  );

  const clearTemperatureCommandTimer = useCallback(() => {
    if (temperatureCommandTimer.current !== null) {
      clearTimeout(temperatureCommandTimer.current);
      temperatureCommandTimer.current = null;
    }
  }, []);

  const sendTemperatureCommandDebounced = useCallback(
    (nextTemperature: number) => {
      clearTemperatureCommandTimer();
      temperatureCommandTimer.current = setTimeout(() => {
        temperatureCommandTimer.current = null;

        if (!canControlDevice) {
          logDroppedCommand(`temp=${nextTemperature}`);
          return;
        }

        void sendAcCommand({
          temp: nextTemperature,
        });
      }, TEMPERATURE_COMMAND_DEBOUNCE_MS);
    },
    [
      canControlDevice,
      clearTemperatureCommandTimer,
      logDroppedCommand,
      sendAcCommand,
    ],
  );

  useEffect(() => {
    return clearTemperatureCommandTimer;
  }, [clearTemperatureCommandTimer]);

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
      updateAcSnapshot({ temperature: normalizedTemperature });
      sendTemperatureCommandDebounced(normalizedTemperature);
    },
    [
      canControlDevice,
      mode,
      sendTemperatureCommandDebounced,
      temperatureRange.max,
      temperatureRange.min,
      triggerSelectionHaptic,
      updateAcSnapshot,
    ],
  );

  const handleModeChange = useCallback(
    (nextMode: AirConditionerMode) => {
      if (!canControlDevice) {
        logDroppedCommand(`mode=${modeToEspMode(nextMode)}`);
        return;
      }

      triggerPressHaptic();
      clearTemperatureCommandTimer();
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
      updateAcSnapshot({
        mode: modeToEspMode(nextMode),
        temperature: nextTemperature,
      });
      void sendAcCommand({
        mode: modeToEspMode(nextMode),
        temp: nextTemperature,
      });
    },
    [
      canControlDevice,
      clearTemperatureCommandTimer,
      logDroppedCommand,
      mode,
      sendAcCommand,
      temperature,
      triggerPressHaptic,
      updateAcSnapshot,
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
      updateAcSnapshot({
        swingHorizontal: airflowLevelToEspPosition[nextLevel],
      });
      void sendAcCommand({
        swingHorizontal: airflowLevelToEspPosition[nextLevel],
      });
    },
    [
      canControlDevice,
      logDroppedCommand,
      sendAcCommand,
      triggerPressHaptic,
      updateAcSnapshot,
    ],
  );

  const handleVerticalAirflowChange = useCallback(
    (nextLevel: AirflowLevel) => {
      if (!canControlDevice) {
        logDroppedCommand(
          `swingVertical=${airflowLevelToEspPosition[nextLevel]}`,
        );
        return;
      }

      triggerPressHaptic();
      setVerticalAirflowAuto(false);
      setVerticalAirflow(nextLevel);
      updateAcSnapshot({
        swingVertical: airflowLevelToEspPosition[nextLevel],
      });
      void sendAcCommand({
        swingVertical: airflowLevelToEspPosition[nextLevel],
      });
    },
    [
      canControlDevice,
      logDroppedCommand,
      sendAcCommand,
      triggerPressHaptic,
      updateAcSnapshot,
    ],
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
      updateAcSnapshot({
        swingHorizontal: nextSwing,
      });
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
      updateAcSnapshot,
    ],
  );

  const handleVerticalAirflowAutoChange = useCallback(
    (nextAuto: boolean) => {
      const nextSwing = nextAuto
        ? "auto"
        : airflowLevelToEspPosition[verticalAirflow];

      if (!canControlDevice) {
        logDroppedCommand(`swingVertical=${nextSwing}`);
        return;
      }

      triggerPressHaptic();
      setVerticalAirflowAuto(nextAuto);
      updateAcSnapshot({
        swingVertical: nextSwing,
      });
      void sendAcCommand({
        swingVertical: nextSwing,
      });
    },
    [
      canControlDevice,
      logDroppedCommand,
      sendAcCommand,
      triggerPressHaptic,
      updateAcSnapshot,
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
      updateAcSnapshot({
        fan: String(nextSpeed) as EspFanSpeed,
      });
      void sendAcCommand({
        fan: nextSpeed,
      });
    },
    [
      canControlDevice,
      fanAuto,
      fanSpeed,
      sendAcCommand,
      triggerPressHaptic,
      updateAcSnapshot,
    ],
  );

  const handleFanAutoChange = useCallback(
    (nextFanAuto: boolean) => {
      if (!canControlDevice) {
        logDroppedCommand(
          `fan=${nextFanAuto ? "auto" : latestFanSpeed.current}`,
        );
        return;
      }

      triggerPressHaptic();
      setFanAuto(nextFanAuto);
      updateAcSnapshot({
        fan: nextFanAuto
          ? "auto"
          : (String(latestFanSpeed.current) as EspFanSpeed),
      });
      void sendAcCommand({
        fan: nextFanAuto ? "auto" : latestFanSpeed.current,
      });
    },
    [
      canControlDevice,
      logDroppedCommand,
      sendAcCommand,
      triggerPressHaptic,
      updateAcSnapshot,
    ],
  );

  const handleTogglePower = useCallback(() => {
    if (!canControlDevice) {
      logDroppedCommand(`power=${power ? "off" : "on"}`);
      return;
    }

    triggerPressHaptic();
    clearTemperatureCommandTimer();
    setPower((currentPower) => {
      const nextPower = !currentPower;
      const nextSnapshot = nextPower
        ? { power: nextPower }
        : { power: nextPower, quiet: false, powerful: false };

      if (!nextPower) {
        setQuiet(false);
        setPowerful(false);
      }

      updateAcSnapshot(nextSnapshot);
      void sendAcCommand({
        power: nextPower ? "on" : "off",
        ...(nextPower ? {} : { quiet: "off", powerful: "off" }),
      });

      return nextPower;
    });
  }, [
    canControlDevice,
    clearTemperatureCommandTimer,
    logDroppedCommand,
    power,
    sendAcCommand,
    triggerPressHaptic,
    updateAcSnapshot,
  ]);

  const isFavourite = useMemo(
    () => devices.find((d) => d.id === deviceId)?.state.favourite === true,
    [devices, deviceId],
  );
  const existingFavourite = useMemo(
    () => devices.find((d) => d.state.favourite === true && d.id !== deviceId) ?? null,
    [devices, deviceId],
  );

  const handleSetFavourite = useCallback(() => {
    if (isFavourite) {
      void clearFavouriteDevice(deviceId);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    const doSet = () => {
      void setFavouriteDevice(deviceId);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    if (existingFavourite !== null) {
      Alert.alert(
        'Replace Favourite?',
        `"${existingFavourite.name}" is currently your home hero. Replace it with this device?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: doSet },
        ],
      );
    } else {
      doSet();
    }
  }, [clearFavouriteDevice, deviceId, existingFavourite, isFavourite, setFavouriteDevice]);

  const handleBackPress = useCallback(() => {
    if (isLeavingScreen.current) {
      return;
    }

    isLeavingScreen.current = true;
    triggerPressHaptic();

    // Start bottom nav exit animation
    animateBottomNavOut();

    // Start screen navigation immediately
    onBackPress();
  }, [
    animateBottomNavOut,
    onBackPress,
    triggerPressHaptic,
  ]);

  const handleTemperatureInteractionEnd = useCallback(() => {
    setIsAdjustingTemperature(false);

    if (!canControlDevice) {
      logDroppedCommand(`temp=${latestTemperature.current}`);
    }
  }, [canControlDevice, logDroppedCommand]);

  const handleQuietChange = useCallback(
    (nextQuiet: boolean) => {
      if (!quietControlEnabled) {
        logDroppedCommand(`quiet=${nextQuiet ? "on" : "off"}`);
        return;
      }

      triggerPressHaptic();
      setQuiet(nextQuiet);
      setPowerful(false);
      updateAcSnapshot({ quiet: nextQuiet, powerful: false });
      void sendAcCommand({ quiet: nextQuiet ? "on" : "off", powerful: "off" });
    },
    [
      logDroppedCommand,
      quietControlEnabled,
      sendAcCommand,
      triggerPressHaptic,
      updateAcSnapshot,
    ],
  );

  const handlePowerfulChange = useCallback(
    (nextPowerful: boolean) => {
      if (!powerfulControlEnabled) {
        logDroppedCommand(`powerful=${nextPowerful ? "on" : "off"}`);
        return;
      }

      triggerPressHaptic();
      setPowerful(nextPowerful);
      setQuiet(false);
      updateAcSnapshot({ powerful: nextPowerful, quiet: false });
      void sendAcCommand({
        powerful: nextPowerful ? "on" : "off",
        quiet: "off",
      });
    },
    [
      logDroppedCommand,
      powerfulControlEnabled,
      sendAcCommand,
      triggerPressHaptic,
      updateAcSnapshot,
    ],
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

  const handleSaveSchedule = useCallback(
    async (nextSchedule: AcSchedule) => {
      if (pairedDevice === null) {
        throw new Error("No paired device available for schedule");
      }

      scheduleMutationVersion.current += 1;

      if (debugMode) {
        await saveAcSchedule(pairedDevice, nextSchedule);
        setSchedule(nextSchedule);
        return;
      }

      const savedSchedule = await putAcScheduleToDevice(
        pairedDevice,
        nextSchedule,
      );
      const scheduleWithDays = {
        ...savedSchedule,
        days: nextSchedule.days,
        powerful: nextSchedule.powerful,
        quiet: nextSchedule.quiet,
        repeatEnabled: nextSchedule.repeatEnabled,
        repeatFrequency: nextSchedule.repeatFrequency,
      };

      setSchedule(scheduleWithDays);
      void saveAcSchedule(pairedDevice, scheduleWithDays).catch(() => { });
    },
    [debugMode, pairedDevice],
  );

  const handleToggleScheduleEnabled = useCallback(
    async (enabled: boolean) => {
      if (schedule === null) {
        return;
      }

      await handleSaveSchedule({
        ...schedule,
        enabled,
      });
    },
    [handleSaveSchedule, schedule],
  );

  const handleDeleteSchedule = useCallback(async () => {
    if (pairedDevice === null || schedule === null) {
      return;
    }

    scheduleMutationVersion.current += 1;

    try {
      if (debugMode) {
        await removeAcSchedule(pairedDevice);
        setSchedule(null);
        return;
      }

      await deleteAcScheduleFromDevice(pairedDevice);
      setSchedule(null);
      void removeAcSchedule(pairedDevice).catch(() => { });
    } catch (error) {
      console.warn("[Schedule] DELETE failed:", error);
    }
  }, [debugMode, pairedDevice, schedule]);

  return (
    <ScreenView>
      <ScrollView
        alwaysBounceVertical
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        scrollEnabled={!isAdjustingTemperature}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <ACHeader
          eyebrow="Living Room"
          isScrolled={isHeaderScrolled}
          onBackPress={handleBackPress}
          title="Air Conditioner"
          rightAccessory={
            <HeaderIconButton
              accessibilityLabel="More options"
              framed
              onPress={() => { }}
            >
              <Ellipsis color={theme.accent} size={24} strokeWidth={2.6} />
            </HeaderIconButton>
          }
        />

        <View style={styles.body}>
          {!canControlDevice ? (
            <Text style={styles.connectionStatus}>{unavailableStatusText}</Text>
          ) : null}

          <AcModePillRow
            dimStyle={liveLabelDimStyle}
            enabled={liveControlsEnabled}
            mode={mode}
            onSelectMode={handleModeChange}
          />

          <AcTemperatureCard
            canControlDevice={canControlDevice}
            gaugeSize={gaugeSize}
            maxTemperature={temperatureRange.max}
            minTemperature={temperatureRange.min}
            onChangeTemperature={handleTemperatureChange}
            onInteractionEnd={handleTemperatureInteractionEnd}
            onInteractionStart={() => setIsAdjustingTemperature(true)}
            onTogglePower={handleTogglePower}
            onTogglePowerful={() => handlePowerfulChange(!powerful)}
            onToggleQuiet={() => handleQuietChange(!quiet)}
            power={power}
            powerful={powerful}
            powerfulControlEnabled={powerfulControlEnabled}
            quiet={quiet}
            quietControlEnabled={quietControlEnabled}
            subtitle={`Living Room · ${powerStatusText}`}
            title="Air Conditioner"
            temperature={temperature}
          />

          <AcLiveControls
            canControlDevice={canControlDevice}
            fanAuto={fanAuto}
            fanSpeed={fanSpeed}
            horizontalAirflow={horizontalAirflow}
            horizontalAirflowAuto={horizontalAirflowAuto}
            onChangeFanAuto={handleFanAutoChange}
            onChangeFanSpeed={handleFanSpeedChange}
            onChangeHorizontalAirflow={handleHorizontalAirflowChange}
            onChangeHorizontalAirflowAuto={handleHorizontalAirflowAutoChange}
            onChangeVerticalAirflow={handleVerticalAirflowChange}
            onChangeVerticalAirflowAuto={handleVerticalAirflowAutoChange}
            power={power}
            verticalAirflow={verticalAirflow}
            verticalAirflowAuto={verticalAirflowAuto}
          />
        </View>
      </ScrollView>

      <AcScheduleSheet
        loading={isScheduleLoading}
        onClose={() => setIsScheduleSheetVisible(false)}
        onSaveSchedule={handleSaveSchedule}
        onDeleteSchedule={handleDeleteSchedule}
        onToggleScheduleEnabled={handleToggleScheduleEnabled}
        schedule={schedule}
        visible={isScheduleSheetVisible}
      />

      {/* Bottom nav enters with this screen and also exits during swipe-back. */}
      <AnimatedBottomNav
        opacity={bottomNavOpacity}
        translateY={bottomNavTranslateY}
        items={[
          {
            icon: (
              <CalendarClock
                color={theme.accentStrong}
                size={22}
                strokeWidth={2.2}
              />
            ),
            label: "Schedule",
            onPress: () => setIsScheduleSheetVisible(true),
          },
          {
            active: isFavourite,
            icon: (
              isFavourite ? (
                <Star
                  color={theme.accent}
                  size={22}
                  strokeWidth={2.2}
                  fill={theme.accent}
                />
              ) : (
                <Star
                  color={theme.accentMuted}
                  size={22}
                  strokeWidth={2.2}
                />
              )
            ),
            label: isFavourite ? "Remove Favourite" : "Set Favourite",
            onPress: handleSetFavourite,
          },
        ]}
      />
    </ScreenView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingBottom: SCREEN_BOTTOM_SAFE_PADDING + theme.spacing.xl + BOTTOM_NAV_CLEARANCE,
  },
  body: {
    gap: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  connectionStatus: {
    color: theme.textSecondary,
    fontSize: theme.typography.body,
    fontWeight: "700",
    letterSpacing: 0,
    textAlign: "center",
  },
});
