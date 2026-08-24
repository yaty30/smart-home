import * as Haptics from "expo-haptics";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { CalendarDays, Clock, Radio } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { ACHeader } from "../components/ACHeader";
import { AppButton } from "../components/AppButton";
import {
  HorizontalAirflowSelector,
  VerticalAirflowSelector,
} from "../components/AirflowSelectors";
import { CollapsibleView } from "../components/CollapsibleView";
import { FanSpeedControl } from "../components/FanSpeedControl";
import { DisplayControls } from "../components/DisplayControls";
import { ModeSelector } from "../components/ModeSelector";
import { PowerButton } from "../components/PowerButton";
import {
  SCREEN_BOTTOM_SAFE_PADDING,
  ScreenView,
} from "../components/ScreenView";
import { Section } from "../components/Section";
import { TemperatureGauge } from "../components/TemperatureGauge";
import { useDeviceConnection } from "../context/DeviceConnectionContext";
import { useHomeData } from "../context/HomeDataContext";
import type { RootStackScreenProps } from "../navigation/types";
import {
  getAcSchedule,
  removeAcSchedule,
  saveAcSchedule,
} from "../storage/acScheduleStorage";
import { theme } from "../theme/theme";
import type { AcSchedule, ScheduleAirflow } from "../types/acSchedule";
import type {
  AirConditionerMode,
  AirflowLevel,
  FanSpeed,
} from "../types/airConditioner";
import type { EspAirflow, EspFanSpeed } from "../types/device";
import { normalizeTemperature } from "../utils/temperatureGauge";

const temperatureRanges: Record<
  Exclude<AirConditionerMode, "fan">,
  { min: number; max: number }
> = {
  auto: { min: 16, max: 30 },
  cold: { min: 16, max: 26 },
  dry: { min: 16, max: 28 },
  heat: { min: 22, max: 30 },
};

const temperatureRangeForMode = (mode: AirConditionerMode) => {
  if (mode === "fan") {
    return temperatureRanges.auto;
  }

  return temperatureRanges[mode];
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

const airflowLevelToEspPosition: Record<AirflowLevel, Exclude<EspAirflow, "auto">> = {
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

type ActiveTab = "control" | "schedule";
type TimeField = "start" | "end";
type SchedulerViewState = "empty" | "summary" | "editor" | "confirmDelete";

const defaultSchedule: AcSchedule = {
  enabled: true,
  endTime: "07:30",
  horizontalAirflow: "auto",
  mode: "cold",
  startTime: "22:30",
  temperature: 24,
  verticalAirflow: "auto",
};

const formatTimePart = (value: number) => String(value).padStart(2, "0");

const timeStringFromDate = (date: Date) => {
  return `${formatTimePart(date.getHours())}:${formatTimePart(
    date.getMinutes(),
  )}`;
};

const dateFromTimeString = (time: string) => {
  const [hours = "0", minutes = "0"] = time.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date;
};

const displayMode = (mode: AcSchedule["mode"]) => {
  switch (mode) {
    case "auto":
      return "Auto";
    case "cold":
      return "Cold";
    case "dry":
      return "Dry";
    case "heat":
      return "Heat";
  }
};

const displayAirflow = (airflow: ScheduleAirflow) => {
  if (airflow === "auto") {
    return "Auto";
  }

  return airflowLevelToEspPosition[airflow];
};

export function AirConditionerScreen({
  navigation,
  route,
}: RootStackScreenProps<"AirConditioner">) {
  const { deviceId } = route.params;
  const { devices, scenes } = useHomeData();
  const {
    getRuntime,
    sendAcCommand: sendAcCommandToDevice,
    sendDisplayCommand: sendDisplayCommandToDevice,
    updateAcState,
    updateDisplayState,
  } = useDeviceConnection();
  const device = devices.find((currentDevice) => currentDevice.id === deviceId);
  const scene = scenes.find(
    (currentScene) => currentScene.id === device?.sceneId,
  );
  const { state: deviceState, status: deviceConnectionStatus } =
    getRuntime(deviceId);
  const isDeviceConnected = deviceConnectionStatus === "connected";
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<ActiveTab>("control");
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
  const [qrVisible, setQrVisible] = useState(false);
  const [isAdjustingTemperature, setIsAdjustingTemperature] = useState(false);
  const [savedSchedule, setSavedSchedule] = useState<AcSchedule | null>(null);
  const [draftSchedule, setDraftSchedule] = useState<AcSchedule | null>(null);
  const [schedulerViewState, setSchedulerViewState] =
    useState<SchedulerViewState>("empty");
  const [scheduleValidationError, setScheduleValidationError] = useState<
    string | null
  >(null);
  const [activeTimePicker, setActiveTimePicker] = useState<TimeField | null>(
    null,
  );
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const latestTemperature = useRef(temperature);
  const latestFanSpeed = useRef<FanSpeed>(fanSpeed);
  const latestHeaderScrolled = useRef(false);
  const controlEnabledProgress = useRef(new Animated.Value(1)).current;
  const modeTemperatures = useRef<Partial<Record<AirConditionerMode, number>>>({
    auto: 24,
  });

  const gaugeSize = useMemo(() => {
    return Math.min(width - theme.spacing.xl * 4, 520);
  }, [width]);

  const temperatureRange = useMemo(() => {
    return temperatureRangeForMode(mode);
  }, [mode]);
  const scheduleTemperatureRange = useMemo(() => {
    return temperatureRangeForMode(draftSchedule?.mode ?? "cold");
  }, [draftSchedule?.mode]);
  const canControlDevice =
    isDeviceConnected && device !== undefined && deviceState !== null;
  const liveControlsEnabled = canControlDevice && power;
  const unavailableStatusText = useMemo(() => {
    if (device === undefined) {
      return "This device was removed";
    }

    if (deviceConnectionStatus === "connecting") {
      return "Reconnecting to ESP32";
    }

    if (deviceConnectionStatus === "connected" && deviceState === null) {
      return "Syncing ESP32 state";
    }

    return "Device offline";
  }, [device, deviceConnectionStatus, deviceState]);

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
    let isMounted = true;

    const loadSchedule = async () => {
      const storedSchedule = await getAcSchedule(deviceId);

      if (!isMounted) {
        return;
      }

      setSavedSchedule(storedSchedule);
      setDraftSchedule(null);
      setScheduleValidationError(null);
      setActiveTimePicker(null);
      setSchedulerViewState(storedSchedule === null ? "empty" : "summary");
    };

    void loadSchedule();

    return () => {
      isMounted = false;
    };
  }, [deviceId]);

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

    setQuiet(deviceState.ac.quiet);
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

  const updateAcSnapshot = useCallback(
    (acPatch: Parameters<typeof updateAcState>[1]) => {
      updateAcState(deviceId, acPatch);
    },
    [deviceId, updateAcState],
  );

  const updateDisplaySnapshot = useCallback(
    (displayPatch: Parameters<typeof updateDisplayState>[1]) => {
      updateDisplayState(deviceId, displayPatch);
    },
    [deviceId, updateDisplayState],
  );

  const sendAcCommand = useCallback(
    (params: Record<string, string | number>) => {
      if (!canControlDevice) {
        logDroppedCommand(
          Object.entries(params)
            .map(([key, value]) => `${key}=${String(value)}`)
            .join(","),
        );
        return Promise.resolve(false);
      }

      return sendAcCommandToDevice(deviceId, params);
    },
    [canControlDevice, deviceId, logDroppedCommand, sendAcCommandToDevice],
  );

  const sendDisplayCommand = useCallback(
    (params: Record<string, string>) => {
      if (!canControlDevice) {
        logDroppedCommand(
          Object.entries(params)
            .map(([key, value]) => `${key}=${value}`)
            .join(","),
        );
        return Promise.resolve(false);
      }

      return sendDisplayCommandToDevice(deviceId, params);
    },
    [canControlDevice, deviceId, logDroppedCommand, sendDisplayCommandToDevice],
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
      updateAcSnapshot({ temperature: normalizedTemperature });
    },
    [
      canControlDevice,
      mode,
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
        logDroppedCommand(`swingVertical=${airflowLevelToEspPosition[nextLevel]}`);
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
      const nextSwing = nextAuto ? "auto" : airflowLevelToEspPosition[verticalAirflow];

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
        logDroppedCommand(`fan=${nextFanAuto ? "auto" : latestFanSpeed.current}`);
        return;
      }

      triggerPressHaptic();
      setFanAuto(nextFanAuto);
      updateAcSnapshot({
        fan: nextFanAuto ? "auto" : (String(latestFanSpeed.current) as EspFanSpeed),
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
    setPower((currentPower) => {
      const nextPower = !currentPower;
      updateAcSnapshot({ power: nextPower });
      void sendAcCommand({
        power: nextPower ? "on" : "off",
      });

      return nextPower;
    });
  }, [
    canControlDevice,
    logDroppedCommand,
    power,
    sendAcCommand,
    triggerPressHaptic,
    updateAcSnapshot,
  ]);

  const handleBackPress = useCallback(() => {
    triggerPressHaptic();
    navigation.goBack();
  }, [navigation, triggerPressHaptic]);

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

  const handleQrVisibilityChange = useCallback(
    (nextQrVisible: boolean) => {
      if (!canControlDevice) {
        logDroppedCommand(`qr=${nextQrVisible ? "show" : "hide"}`);
        return;
      }

      triggerPressHaptic();
      setQrVisible(nextQrVisible);
      updateDisplaySnapshot({ qrVisible: nextQrVisible });
      void sendDisplayCommand({ qr: nextQrVisible ? "show" : "hide" });
    },
    [
      canControlDevice,
      logDroppedCommand,
      sendDisplayCommand,
      triggerPressHaptic,
      updateDisplaySnapshot,
    ],
  );

  const handleScreenOnChange = useCallback(
    (nextScreenOn: boolean) => {
      if (!canControlDevice) {
        logDroppedCommand(`screen=${nextScreenOn ? "on" : "off"}`);
        return;
      }

      triggerPressHaptic();
      updateDisplaySnapshot({ screenOn: nextScreenOn });
      void sendDisplayCommand({ screen: nextScreenOn ? "on" : "off" });
    },
    [
      canControlDevice,
      logDroppedCommand,
      sendDisplayCommand,
      triggerPressHaptic,
      updateDisplaySnapshot,
    ],
  );

  const handleQuietChange = useCallback(
    (nextQuiet: boolean) => {
      if (!canControlDevice) {
        logDroppedCommand(`quiet=${nextQuiet ? "on" : "off"}`);
        return;
      }

      triggerPressHaptic();
      setQuiet(nextQuiet);
      updateAcSnapshot({ quiet: nextQuiet });
      void sendAcCommand({ quiet: nextQuiet ? "on" : "off" });
    },
    [
      canControlDevice,
      logDroppedCommand,
      sendAcCommand,
      triggerPressHaptic,
      updateAcSnapshot,
    ],
  );

  const handleScheduleTemperatureChange = useCallback(
    (nextTemperature: number) => {
      setDraftSchedule((currentDraft) => {
        if (currentDraft === null) {
          return currentDraft;
        }

        return {
          ...currentDraft,
          temperature: normalizeTemperature(
            nextTemperature,
            scheduleTemperatureRange.min,
            scheduleTemperatureRange.max,
          ),
        };
      });
    },
    [scheduleTemperatureRange.max, scheduleTemperatureRange.min],
  );

  const handleScheduleModeChange = useCallback(
    (nextMode: AirConditionerMode) => {
      if (nextMode === "fan") {
        return;
      }

      const nextRange = temperatureRangeForMode(nextMode);
      triggerPressHaptic();
      setDraftSchedule((currentDraft) => {
        if (currentDraft === null) {
          return currentDraft;
        }

        return {
          ...currentDraft,
          mode: nextMode,
          temperature: normalizeTemperature(
            currentDraft.temperature,
            nextRange.min,
            nextRange.max,
          ),
        };
      });
    },
    [triggerPressHaptic],
  );

  const handleScheduleTimeChange = useCallback(
    (field: TimeField, event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS !== "ios") {
        setActiveTimePicker(null);
      }

      if (event.type === "dismissed" || selectedDate === undefined) {
        return;
      }

      setScheduleValidationError(null);
      setDraftSchedule((currentDraft) => {
        if (currentDraft === null) {
          return currentDraft;
        }

        return {
          ...currentDraft,
          [field === "start" ? "startTime" : "endTime"]:
            timeStringFromDate(selectedDate),
        };
      });
    },
    [],
  );

  const handleCreateSchedule = useCallback(() => {
    triggerPressHaptic();
    setDraftSchedule(defaultSchedule);
    setScheduleValidationError(null);
    setSchedulerViewState("editor");
  }, [triggerPressHaptic]);

  const handleEditSchedule = useCallback(() => {
    if (savedSchedule === null) {
      return;
    }

    triggerPressHaptic();
    setDraftSchedule({ ...savedSchedule });
    setScheduleValidationError(null);
    setSchedulerViewState("editor");
  }, [savedSchedule, triggerPressHaptic]);

  const handleCancelScheduleEditing = useCallback(() => {
    triggerPressHaptic();
    setDraftSchedule(null);
    setScheduleValidationError(null);
    setActiveTimePicker(null);
    setSchedulerViewState(savedSchedule === null ? "empty" : "summary");
  }, [savedSchedule, triggerPressHaptic]);

  const handleSaveSchedule = useCallback(async () => {
    if (draftSchedule === null) {
      return;
    }

    if (draftSchedule.startTime === draftSchedule.endTime) {
      setScheduleValidationError("Start and end time cannot be the same.");
      return;
    }

    triggerPressHaptic();
    await saveAcSchedule(deviceId, draftSchedule);
    setSavedSchedule(draftSchedule);
    setDraftSchedule(null);
    setScheduleValidationError(null);
    setActiveTimePicker(null);
    setSchedulerViewState("summary");
  }, [deviceId, draftSchedule, triggerPressHaptic]);

  const handleToggleScheduleEnabled = useCallback(
    async (nextEnabled: boolean) => {
      if (savedSchedule === null) {
        return;
      }

      triggerPressHaptic();
      const nextSchedule = {
        ...savedSchedule,
        enabled: nextEnabled,
      };
      await saveAcSchedule(deviceId, nextSchedule);
      setSavedSchedule(nextSchedule);
    },
    [deviceId, savedSchedule, triggerPressHaptic],
  );

  const handleRequestDeleteSchedule = useCallback(() => {
    triggerPressHaptic();
    setSchedulerViewState("confirmDelete");
  }, [triggerPressHaptic]);

  const handleCancelDeleteSchedule = useCallback(() => {
    triggerPressHaptic();
    setSchedulerViewState(savedSchedule === null ? "empty" : "summary");
  }, [savedSchedule, triggerPressHaptic]);

  const handleDeleteSchedule = useCallback(async () => {
    triggerPressHaptic();
    await removeAcSchedule(deviceId);
    setSavedSchedule(null);
    setDraftSchedule(null);
    setScheduleValidationError(null);
    setActiveTimePicker(null);
    setSchedulerViewState("empty");
  }, [deviceId, triggerPressHaptic]);

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
        bounces={false}
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        scrollEnabled={!isAdjustingTemperature}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <ACHeader
          eyebrow={scene?.name}
          isScrolled={isHeaderScrolled}
          onBackPress={handleBackPress}
          title={device?.name ?? "Air Conditioner"}
          rightAccessory={
            <PowerButton
              isPowered={power}
              onTogglePower={handleTogglePower}
              variant="header"
            />
          }
        />

        <View style={styles.body}>
          {!canControlDevice ? (
            <Text style={styles.connectionStatus}>{unavailableStatusText}</Text>
          ) : null}

          <View style={styles.tabs}>
            {(["control", "schedule"] as const).map((tab) => {
              const selected = activeTab === tab;
              return (
                <TouchableOpacity
                  activeOpacity={0.78}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[styles.tab, selected && styles.tabActive]}
                >
                  <View style={styles.tabContent}>
                    {tab === "control" ? 
                      <Radio color={selected ? theme.accent : theme.textSecondary} /> : 
                      <CalendarDays color={selected ? theme.accent : theme.textSecondary} />
                    }
                    <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                      {tab === "control" ? "Remote" : "Schedule"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {activeTab === "control" ? (
            <>
              <CollapsibleView visible={power}>
                <View style={styles.liveControlSections}>
                  <Section>
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
                  </Section>

                  <Section>
                    <ModeSelector
                      isDisabled={!canControlDevice}
                      isPowered={power}
                      onChangeMode={handleModeChange}
                      selectedMode={mode}
                    />
                  </Section>

                  <Section>
                    <FanSpeedControl
                      isAuto={fanAuto}
                      isDisabled={!canControlDevice}
                      isPowered={power}
                      onChangeAuto={handleFanAutoChange}
                      onChangeSpeed={handleFanSpeedChange}
                      speed={fanSpeed}
                    />
                  </Section>

                  <Section style={styles.airflowCard}>
                    <HorizontalAirflowSelector
                      isAuto={horizontalAirflowAuto}
                      isDisabled={!canControlDevice}
                      isPowered={power}
                      onChangeAuto={handleHorizontalAirflowAutoChange}
                      onChangeLevel={handleHorizontalAirflowChange}
                      selectedLevel={horizontalAirflow}
                    />
                    <VerticalAirflowSelector
                      isAuto={verticalAirflowAuto}
                      isDisabled={!canControlDevice}
                      isPowered={power}
                      onChangeAuto={handleVerticalAirflowAutoChange}
                      onChangeLevel={handleVerticalAirflowChange}
                      selectedLevel={verticalAirflow}
                    />
                  </Section>
                </View>
              </CollapsibleView>

              <Section>
                <DisplayControls
                  canControlQr={
                    isDeviceConnected &&
                    deviceState?.display.pairingMode !== true
                  }
                  isDisabled={!canControlDevice}
                  onChangeQuiet={handleQuietChange}
                  onChangeQrVisible={handleQrVisibilityChange}
                  onChangeScreenOn={handleScreenOnChange}
                  quiet={quiet}
                  qrVisible={qrVisible}
                  screenOn={deviceState?.display.screenOn ?? false}
                />
              </Section>
            </>
          ) : (
            <>
              {schedulerViewState === "empty" ? (
                <Section style={styles.emptyScheduleCard}>
                  <Text style={styles.cardTitle}>No schedule</Text>
                  <Text style={styles.cardSubtitle}>
                    This AC can have one automatic schedule.
                  </Text>
                  <AppButton
                    label="Create Schedule"
                    onPress={handleCreateSchedule}
                    vibe="strong"
                  />
                </Section>
              ) : null}

              {schedulerViewState === "summary" && savedSchedule !== null ? (
                <Section>
                  <View style={styles.summaryHeader}>
                    <View style={styles.summaryTitleGroup}>
                      <Text style={styles.cardTitle}>AC Schedule</Text>
                      <Text style={styles.cardSubtitle}>
                        {savedSchedule.enabled
                          ? "Runs every day"
                          : "Schedule paused"}
                      </Text>
                    </View>
                    <View style={styles.scheduleSwitchRow}>
                      <Text style={styles.switchLabel}>
                        {savedSchedule.enabled ? "ON" : "OFF"}
                      </Text>
                      <Switch
                        accessibilityLabel="Toggle AC schedule"
                        ios_backgroundColor={theme.controlBackground}
                        onValueChange={handleToggleScheduleEnabled}
                        thumbColor={
                          savedSchedule.enabled
                            ? theme.accent
                            : theme.textSecondary
                        }
                        trackColor={{
                          false: theme.controlBackgroundPressed,
                          true: theme.accentMuted,
                        }}
                        value={savedSchedule.enabled}
                      />
                    </View>
                  </View>

                  <View style={styles.summaryRows}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Time</Text>
                      <Text style={styles.summaryValue}>
                        {savedSchedule.startTime} → {savedSchedule.endTime}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Temperature</Text>
                      <Text style={styles.summaryValue}>
                        {savedSchedule.temperature}°C
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Mode</Text>
                      <Text style={styles.summaryValue}>
                        {displayMode(savedSchedule.mode)}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Horizontal</Text>
                      <Text style={styles.summaryValue}>
                        {displayAirflow(savedSchedule.horizontalAirflow)}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Vertical</Text>
                      <Text style={styles.summaryValue}>
                        {displayAirflow(savedSchedule.verticalAirflow)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.scheduleActionRow}>
                    <AppButton
                      label="Edit Schedule"
                      onPress={handleEditSchedule}
                      style={styles.actionButton}
                      variant="secondary"
                    />
                    <AppButton
                      label="Delete"
                      onPress={handleRequestDeleteSchedule}
                      style={styles.actionButton}
                      variant="danger"
                    />
                  </View>
                </Section>
              ) : null}

              {schedulerViewState === "confirmDelete" ? (
                <Section>
                  <Text style={styles.cardTitle}>Delete schedule?</Text>
                  <Text style={styles.cardSubtitle}>
                    This will remove the AC schedule. The current AC state
                    will not be changed.
                  </Text>
                  <View style={styles.scheduleActionRow}>
                    <AppButton
                      label="Cancel"
                      onPress={handleCancelDeleteSchedule}
                      style={styles.actionButton}
                      variant="secondary"
                    />
                    <AppButton
                      label="Delete"
                      onPress={handleDeleteSchedule}
                      style={styles.actionButton}
                      variant="destructive"
                    />
                  </View>
                </Section>
              ) : null}

              {schedulerViewState === "editor" && draftSchedule !== null ? (
                <>
                  <Section>
                    <Text style={styles.cardTitle}>
                      {savedSchedule === null
                        ? "Create schedule"
                        : "Edit schedule"}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      Save changes to make this automatic schedule active.
                    </Text>
                  </Section>

                  <Section>
                    <Text style={styles.cardTitle}>Time</Text>
                    <View style={styles.timeGrid}>
                      {(["start", "end"] as const).map((field) => (
                        <View key={field} style={styles.timeField}>
                          <Text style={styles.timeLabel}>
                            {field === "start" ? "Start" : "End"}
                          </Text>
                          <TouchableOpacity
                            activeOpacity={0.78}
                            accessibilityRole="button"
                            onPress={() => setActiveTimePicker(field)}
                            style={styles.timeButton}
                          >
                            <Text style={styles.timeValue}>
                              {field === "start"
                                ? draftSchedule.startTime
                                : draftSchedule.endTime}
                            </Text>
                            <Clock
                              color={theme.text}
                              size={20}
                              strokeWidth={2.3}
                            />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                    {scheduleValidationError ? (
                      <Text style={styles.validationText}>
                        {scheduleValidationError}
                      </Text>
                    ) : null}
                    {activeTimePicker && Platform.OS !== "ios" ? (
                      <DateTimePicker
                        display="default"
                        mode="time"
                        onChange={(event, selectedDate) =>
                          handleScheduleTimeChange(
                            activeTimePicker,
                            event,
                            selectedDate,
                          )
                        }
                        value={dateFromTimeString(
                          activeTimePicker === "start"
                            ? draftSchedule.startTime
                            : draftSchedule.endTime,
                        )}
                      />
                    ) : null}
                  </Section>

                  <Section>
                    <TemperatureGauge
                      isPowered
                      maxTemperature={scheduleTemperatureRange.max}
                      minTemperature={scheduleTemperatureRange.min}
                      onChangeTemperature={handleScheduleTemperatureChange}
                      size={gaugeSize}
                      temperature={draftSchedule.temperature}
                    />
                  </Section>

                  <Section>
                    <ModeSelector
                      isPowered
                      onChangeMode={handleScheduleModeChange}
                      selectedMode={draftSchedule.mode}
                    />
                  </Section>

                  <Section style={styles.airflowCard}>
                    <HorizontalAirflowSelector
                      isAuto={draftSchedule.horizontalAirflow === "auto"}
                      isPowered
                      onChangeAuto={(nextAuto) => {
                        if (!nextAuto) {
                          return;
                        }

                        setDraftSchedule((currentDraft) =>
                          currentDraft === null
                            ? currentDraft
                            : { ...currentDraft, horizontalAirflow: "auto" },
                        );
                      }}
                      onChangeLevel={(nextLevel) => {
                        setDraftSchedule((currentDraft) =>
                          currentDraft === null
                            ? currentDraft
                            : {
                              ...currentDraft,
                              horizontalAirflow: nextLevel,
                            },
                        );
                      }}
                      selectedLevel={
                        draftSchedule.horizontalAirflow === "auto"
                          ? "three"
                          : draftSchedule.horizontalAirflow
                      }
                    />
                    <VerticalAirflowSelector
                      isAuto={draftSchedule.verticalAirflow === "auto"}
                      isPowered
                      onChangeAuto={(nextAuto) => {
                        if (!nextAuto) {
                          return;
                        }

                        setDraftSchedule((currentDraft) =>
                          currentDraft === null
                            ? currentDraft
                            : { ...currentDraft, verticalAirflow: "auto" },
                        );
                      }}
                      onChangeLevel={(nextLevel) => {
                        setDraftSchedule((currentDraft) =>
                          currentDraft === null
                            ? currentDraft
                            : {
                              ...currentDraft,
                              verticalAirflow: nextLevel,
                            },
                        );
                      }}
                      selectedLevel={
                        draftSchedule.verticalAirflow === "auto"
                          ? "one"
                          : draftSchedule.verticalAirflow
                      }
                    />
                  </Section>

                  <View style={styles.scheduleActionRow}>
                    <AppButton
                      label="Cancel"
                      onPress={handleCancelScheduleEditing}
                      style={styles.actionButton}
                      variant="secondary"
                    />
                    <AppButton
                      label="Save Schedule"
                      onPress={handleSaveSchedule}
                      style={styles.actionButton}
                      vibe="strong"
                    />
                  </View>
                </>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      {activeTimePicker && Platform.OS === "ios" && draftSchedule !== null ? (
        <Modal
          animationType="fade"
          transparent
          visible
          onRequestClose={() => setActiveTimePicker(null)}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setActiveTimePicker(null)}
            style={styles.timePickerBackdrop}
          >
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={styles.timePickerPanel}
            >
              <DateTimePicker
                display="spinner"
                locale="en_US"
                mode="time"
                onChange={(event, selectedDate) =>
                  handleScheduleTimeChange(
                    activeTimePicker,
                    event,
                    selectedDate,
                  )
                }
                value={
                  dateFromTimeString(
                    activeTimePicker === "start"
                      ? draftSchedule.startTime
                      : draftSchedule.endTime,
                  )
                }
                textColor={theme.text}
                themeVariant="dark"
                style={styles.timePicker}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </ScreenView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingBottom: SCREEN_BOTTOM_SAFE_PADDING + theme.spacing.xxl,
  },
  body: {
    gap: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  tabs: {
    // backgroundColor: theme.surfaceLow,
    // borderColor: theme.borderStrong,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    padding: 6,
  },
  tab: {
    alignItems: "center",
    borderRadius: 14,
    flex: 1,
    height: 44,
    justifyContent: "center",
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    position: 'relative',
  },
  tabActive: {
    backgroundColor: theme.accentSubtle,
    borderColor: theme.borderActive,
    borderWidth: 1,
  },
  tabText: {
    color: theme.textSecondary,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
  },
  tabTextActive: {
    color: theme.accent,
  },
  airflowCard: {
    gap: theme.spacing.lg,
  },
  liveControlSections: {
    gap: theme.spacing.md,
  },
  emptyScheduleCard: {
    alignItems: "flex-start",
  },
  cardTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0,
  },
  cardSubtitle: {
    color: theme.textSecondary,
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0,
    lineHeight: 21,
  },
  summaryHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
  },
  summaryTitleGroup: {
    flex: 1,
    gap: theme.spacing.xs,
    minWidth: 0,
  },
  scheduleSwitchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  switchLabel: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
  },
  summaryRows: {
    gap: theme.spacing.md,
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryLabel: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0,
  },
  summaryValue: {
    color: theme.text,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "right",
  },
  scheduleActionRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  validationText: {
    color: theme.powerAccent,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
  },
  connectionStatus: {
    color: theme.textSecondary,
    fontSize: theme.typography.body,
    fontWeight: "700",
    letterSpacing: 0,
    textAlign: "center",
  },
  timeGrid: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  timeField: {
    flex: 1,
    gap: theme.spacing.sm,
    minWidth: 0,
  },
  timeLabel: {
    color: theme.textSecondary,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0,
  },
  timeButton: {
    alignItems: "center",
    backgroundColor: theme.controlBackground,
    borderColor: theme.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    height: 48,
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
  },
  timeValue: {
    color: theme.textSecondary,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0,
  },
  timePickerBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.sm,
  },
  timePickerPanel: {
    alignItems: "center",
    backgroundColor: theme.paperBackground,
    borderColor: theme.borderStrong,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: theme.spacing.sm,
    width: "100%",
  },
  timePicker: {
    alignSelf: "center",
    minWidth: 360,
    width: "100%",
  },
});
