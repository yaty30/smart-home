import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import {
  CalendarClock,
  Power,
  PowerOff,
  Rocket,
  Star,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { ACHeader } from "../components/ACHeader";
import { useBottomNavAnimation } from "../hooks/useBottomNavAnimation";
import type { RootStackNavigationProp } from "../navigation/types";
import { AcLiveControls } from "../components/ac/AcLiveControls";
import { AcPresetSheet } from "../components/ac/AcPresetSheet";
import { AcPresetShortcutRow } from "../components/ac/AcPresetShortcutRow";
import { AcTemperatureCard } from "../components/ac/AcTemperatureCard";
import { AnimatedBottomNav } from "../components/AnimatedBottomNav";
import {
  SCREEN_BOTTOM_SAFE_PADDING,
  ScreenView,
} from "../components/ScreenView";
import { BOTTOM_NAV_CLEARANCE } from "../components/BottomNav";
import { useDeviceConnection } from "../context/DeviceConnectionContext";
import { useAcCommands } from "../hooks/useAcCommands";
import { useAcPresets } from "../hooks/useAcPresets";
import { useAcSchedule } from "../hooks/useAcSchedule";
import { AcScheduleSheet } from "../components/AcScheduleSheet";
import { type Theme, useTheme } from "../theme/theme";
import type {
  AirConditionerMode,
  AirflowLevel,
  FanSpeed,
} from "../types/airConditioner";
import { MAX_AC_PRESETS, type AcPreset } from "../types/acPreset";
import type { EspAirflow, EspFanSpeed } from "../types/device";
import { temperatureRangeForMode } from "../constants/acModes";
import {
  acSnapshotToUiState,
  airflowLevelToEspPosition,
  modeToEspMode,
} from "../utils/acProtocol";
import { normalizeTemperature } from "../utils/temperatureGauge";
import { useDevices } from "../store/devices";
import { useRooms } from "../store/rooms";

type AirConditionerScreenProps = {
  deviceId: string;
  onBackPress: () => void;
};

const airflowToEsp = (value: AcPreset["horizontalAirflow"]): EspAirflow =>
  value === "auto" ? "auto" : airflowLevelToEspPosition[value];

const fanSpeedToEsp = (value: AcPreset["fanSpeed"]): EspFanSpeed =>
  value === "auto" ? "auto" : (String(value) as EspFanSpeed);

export function AirConditionerScreen({
  deviceId,
  onBackPress,
}: AirConditionerScreenProps) {
  const {
    deviceConnectionLatencyMs,
    deviceConnectionStatus,
    deviceState,
    isDeviceConnected,
    pairedDevice,
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
  const [isPresetSheetVisible, setIsPresetSheetVisible] = useState(false);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [activePresetDraft, setActivePresetDraft] = useState<AcPreset | null>(
    null,
  );
  const [isScheduleSheetVisible, setIsScheduleSheetVisible] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const latestTemperature = useRef(temperature);
  const latestFanSpeed = useRef<FanSpeed>(fanSpeed);
  const latestHeaderScrolled = useRef(false);
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

  const powerStatusText = canControlDevice
    ? power
      ? "On"
      : "Off"
    : unavailableStatusText;

  const {
    clearTemperatureCommandTimer,
    logDroppedCommand,
    sendAcCommand,
    sendTemperatureCommandDebounced,
    updateAcSnapshot,
  } = useAcCommands({ canControlDevice });
  const {
    deleteSchedule: handleDeleteSchedule,
    isScheduleLoading,
    saveSchedule: handleSaveSchedule,
    schedules,
    toggleScheduleEnabled: handleToggleScheduleEnabled,
  } = useAcSchedule();
  const {
    deletePreset: handleDeletePreset,
    presets,
    savePreset: handleSavePreset,
  } = useAcPresets();
  const { getRoomById } = useRooms();
  const selectedDevice = devices.find((device) => device.id === deviceId);
  const selectedRoom = selectedDevice
    ? getRoomById(selectedDevice.roomId)
    : undefined;
  const selectedDeviceName = selectedDevice?.name ?? "Air Conditioner";
  const selectedRoomName = selectedRoom?.name ?? "Room";
  const createPresetDraft = useCallback((): AcPreset => {
    const presetMode = mode === "fan" ? "auto" : mode;
    const range = temperatureRangeForMode(presetMode);

    return {
      id: `preset-${Date.now()}`,
      fanSpeed: fanAuto ? "auto" : fanSpeed,
      horizontalAirflow: horizontalAirflowAuto ? "auto" : horizontalAirflow,
      mode: presetMode,
      name: "",
      powerful,
      quiet,
      temperature: normalizeTemperature(
        temperature,
        range.min,
        range.max,
      ),
      verticalAirflow: verticalAirflowAuto ? "auto" : verticalAirflow,
    };
  }, [
    fanAuto,
    fanSpeed,
    horizontalAirflow,
    horizontalAirflowAuto,
    mode,
    powerful,
    quiet,
    temperature,
    verticalAirflow,
    verticalAirflowAuto,
  ]);

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

    const next = acSnapshotToUiState(deviceState.ac);

    latestTemperature.current = next.temperature;
    modeTemperatures.current[next.mode] = next.temperature;
    setTemperature(next.temperature);
    setMode(next.mode);
    setPower(next.power);

    setFanAuto(next.fanAuto);
    if (next.fanSpeed !== null) {
      latestFanSpeed.current = next.fanSpeed;
      setFanSpeed(next.fanSpeed);
    }

    setHorizontalAirflowAuto(next.horizontalAirflowAuto);
    if (next.horizontalAirflow !== null) {
      setHorizontalAirflow(next.horizontalAirflow);
    }

    setVerticalAirflowAuto(next.verticalAirflowAuto);
    if (next.verticalAirflow !== null) {
      setVerticalAirflow(next.verticalAirflow);
    }

    setQuiet(next.quiet);
    setPowerful(next.powerful);
  }, [deviceState]);

  const triggerSelectionHaptic = useCallback(() => {
    void Haptics.selectionAsync();
  }, []);

  const triggerPressHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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

  const handleOpenPresetSheet = useCallback(() => {
    if (presets.length >= MAX_AC_PRESETS) {
      Alert.alert(
        "Preset Limit Reached",
        `You can keep up to ${MAX_AC_PRESETS} presets. Long press a preset to delete it.`,
      );
      return;
    }

    triggerPressHaptic();
    setActivePresetDraft(createPresetDraft());
    setIsPresetSheetVisible(true);
  }, [createPresetDraft, presets.length, triggerPressHaptic]);

  const handleSavePresetShortcut = useCallback(
    async (preset: AcPreset) => {
      setIsSavingPreset(true);

      try {
        await handleSavePreset(preset);
        setIsPresetSheetVisible(false);
        setActivePresetDraft(null);
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      } catch (error) {
        Alert.alert(
          "Preset Not Saved",
          error instanceof Error ? error.message : "Please try again.",
        );
      } finally {
        setIsSavingPreset(false);
      }
    },
    [handleSavePreset],
  );

  const handleApplyPreset = useCallback(
    (preset: AcPreset) => {
      if (!canControlDevice) {
        logDroppedCommand(`preset=${preset.name}`);
        return;
      }

      const nextFan = fanSpeedToEsp(preset.fanSpeed);
      const nextHorizontalAirflow = airflowToEsp(preset.horizontalAirflow);
      const nextVerticalAirflow = airflowToEsp(preset.verticalAirflow);
      const nextRange = temperatureRangeForMode(preset.mode);
      const nextTemperature = normalizeTemperature(
        preset.temperature,
        nextRange.min,
        nextRange.max,
      );

      triggerPressHaptic();
      clearTemperatureCommandTimer();
      latestTemperature.current = nextTemperature;
      modeTemperatures.current[preset.mode] = nextTemperature;
      setPower(true);
      setMode(preset.mode);
      setTemperature(nextTemperature);
      setQuiet(preset.quiet);
      setPowerful(preset.powerful);
      setFanAuto(preset.fanSpeed === "auto");
      if (preset.fanSpeed !== "auto") {
        latestFanSpeed.current = preset.fanSpeed;
        setFanSpeed(preset.fanSpeed);
      }
      setHorizontalAirflowAuto(preset.horizontalAirflow === "auto");
      if (preset.horizontalAirflow !== "auto") {
        setHorizontalAirflow(preset.horizontalAirflow);
      }
      setVerticalAirflowAuto(preset.verticalAirflow === "auto");
      if (preset.verticalAirflow !== "auto") {
        setVerticalAirflow(preset.verticalAirflow);
      }

      updateAcSnapshot({
        fan: nextFan,
        mode: modeToEspMode(preset.mode),
        power: true,
        powerful: preset.powerful,
        quiet: preset.quiet,
        swingHorizontal: nextHorizontalAirflow,
        swingVertical: nextVerticalAirflow,
        temperature: nextTemperature,
      });
      void sendAcCommand({
        fan: preset.fanSpeed,
        mode: modeToEspMode(preset.mode),
        power: "on",
        powerful: preset.powerful ? "on" : "off",
        quiet: preset.quiet ? "on" : "off",
        swingHorizontal: nextHorizontalAirflow,
        swingVertical: nextVerticalAirflow,
        temp: nextTemperature,
      });
    },
    [
      canControlDevice,
      clearTemperatureCommandTimer,
      logDroppedCommand,
      sendAcCommand,
      triggerPressHaptic,
      updateAcSnapshot,
    ],
  );

  const isFavourite = useMemo(
    () => devices.find((d) => d.id === deviceId)?.state.favourite === true,
    [devices, deviceId],
  );
  const existingFavourite = useMemo(
    () =>
      devices.find((d) => d.state.favourite === true && d.id !== deviceId) ??
      null,
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
        "Replace Favourite?",
        `"${existingFavourite.name}" is currently your home hero. Replace it with this device?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Replace", style: "destructive", onPress: doSet },
        ],
      );
    } else {
      doSet();
    }
  }, [
    clearFavouriteDevice,
    deviceId,
    existingFavourite,
    isFavourite,
    setFavouriteDevice,
  ]);

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
  }, [animateBottomNavOut, onBackPress, triggerPressHaptic]);

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
          eyebrow={selectedRoomName}
          isScrolled={isHeaderScrolled}
          onBackPress={handleBackPress}
          title={selectedDeviceName}
          rightAccessory={
            <TouchableOpacity
              activeOpacity={0.75}
              accessibilityLabel="Toggle air conditioner power"
              accessibilityRole="switch"
              accessibilityState={{
                checked: power,
                disabled: !canControlDevice,
              }}
              disabled={!canControlDevice}
              onPress={handleTogglePower}
              style={[
                styles.headerPowerButton,
                power
                  ? styles.headerPowerButtonOn
                  : styles.headerPowerButtonOff,
                !canControlDevice && styles.headerPowerButtonDisabled,
              ]}
            >
              {power ? (
                <PowerOff
                  color={theme.powerAccent}
                  size={20}
                  strokeWidth={2.4}
                />
              ) : (
                <Power color={theme.accent} size={20} strokeWidth={2.4} />
              )}
            </TouchableOpacity>
          }
        />

        <View style={styles.body}>
          {!canControlDevice ? (
            <Text style={styles.connectionStatus}>{unavailableStatusText}</Text>
          ) : null}

          <AcPresetShortcutRow
            presets={presets}
            onDeletePreset={(id) => {
              void handleDeletePreset(id);
            }}
            onPressPreset={handleApplyPreset}
          />

          <AcTemperatureCard
            canControlDevice={canControlDevice}
            connectionLatencyMs={deviceConnectionLatencyMs}
            connectionStatus={deviceConnectionStatus}
            gaugeSize={gaugeSize}
            maxTemperature={temperatureRange.max}
            minTemperature={temperatureRange.min}
            onChangeTemperature={handleTemperatureChange}
            onInteractionEnd={handleTemperatureInteractionEnd}
            onInteractionStart={() => setIsAdjustingTemperature(true)}
            onTogglePowerful={() => handlePowerfulChange(!powerful)}
            onToggleQuiet={() => handleQuietChange(!quiet)}
            power={power}
            powerful={powerful}
            powerfulControlEnabled={powerfulControlEnabled}
            quiet={quiet}
            quietControlEnabled={quietControlEnabled}
            subtitle={`${selectedRoomName} · ${powerStatusText}`}
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
            acModePill={{
              dimStyle: liveLabelDimStyle,
              enabled: liveControlsEnabled,
              mode: mode,
              onSelectMode: handleModeChange,
            }}
          />
        </View>
      </ScrollView>

      <AcScheduleSheet
        loading={isScheduleLoading}
        onClose={() => setIsScheduleSheetVisible(false)}
        onSaveSchedule={handleSaveSchedule}
        onDeleteSchedule={handleDeleteSchedule}
        onToggleScheduleEnabled={handleToggleScheduleEnabled}
        schedules={schedules}
        visible={isScheduleSheetVisible}
      />

      {activePresetDraft ? (
        <AcPresetSheet
          count={presets.length}
          initial={activePresetDraft}
          saving={isSavingPreset}
          visible={isPresetSheetVisible}
          onClose={() => setIsPresetSheetVisible(false)}
          onSave={handleSavePresetShortcut}
        />
      ) : null}

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
            icon: (
              <Rocket
                color={theme.modeColors.dry}
                size={22}
                strokeWidth={2.2}
              />
            ),
            label: "New Preset",
            onPress: handleOpenPresetSheet,
          },
          {
            active: isFavourite,
            icon: isFavourite ? (
              <Star
                color={theme.accent}
                size={22}
                strokeWidth={2.2}
                fill={theme.accent}
              />
            ) : (
              <Star color={theme.accentMuted} size={22} strokeWidth={2.2} />
            ),
            label: isFavourite ? "Remove Favourite" : "Set Favourite",
            onPress: handleSetFavourite,
          },
        ]}
      />
    </ScreenView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      flexGrow: 1,
      paddingBottom:
        SCREEN_BOTTOM_SAFE_PADDING + theme.spacing.xl + BOTTOM_NAV_CLEARANCE,
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
    headerPowerButton: {
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    headerPowerButtonOn: {
      backgroundColor: theme.powerAccentMuted,
      borderColor: theme.powerButton.borderOn,
    },
    headerPowerButtonOff: {
      backgroundColor: theme.surfaceWarm,
      borderColor: theme.borderActive,
    },
    headerPowerButtonDisabled: {
      opacity: 0.44,
    },
  });
