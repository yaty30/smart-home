import * as Haptics from "expo-haptics";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  AirVent,
  ChevronDown,
  Clock,
  Ellipsis,
  Moon,
  Power,
  PowerOff,
} from "lucide-react-native";
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
import { ArcTemperatureGauge } from "../components/ArcTemperatureGauge";
import { CollapsibleView } from "../components/CollapsibleView";
import { FanSpeedControl } from "../components/FanSpeedControl";
import { DisplayControls } from "../components/DisplayControls";
import { ModeSelector } from "../components/ModeSelector";
import { SCREEN_BOTTOM_SAFE_PADDING, ScreenView } from "../components/ScreenView";
import { Section } from "../components/Section";
import { useDeviceConnection } from "../context/DeviceConnectionContext";
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
import type { DeviceStateSnapshot, EspAirflow, EspFanSpeed } from "../types/device";
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

const DEVICE_COMMAND_TIMEOUT_MS = 1500;
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

const modePills: { id: AirConditionerMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "cold", label: "Cold" },
  { id: "dry", label: "Dry" },
  { id: "heat", label: "Heat" },
];

const formatTimePart = (value: number) => String(value).padStart(2, "0");

const formatTime12h = (time: string) => {
  const [hoursPart = "0", minutesPart = "0"] = time.split(":");
  const hours = Number(hoursPart);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${String(hour12).padStart(2, "0")}:${minutesPart.padStart(
    2,
    "0",
  )} ${suffix}`;
};

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

type AirConditionerScreenProps = {
  onBackPress: () => void;
};

export function AirConditionerScreen({ onBackPress }: AirConditionerScreenProps) {
  const {
    deviceConnectionStatus,
    debugMode,
    deviceState,
    isDeviceConnected,
    pairedDevice,
    reportDeviceUnreachable,
    updateDeviceState,
  } = useDeviceConnection();
  const { width } = useWindowDimensions();
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
    return Math.min(width - theme.spacing.xl * 5, 300);
  }, [width]);

  const temperatureRange = useMemo(() => {
    return temperatureRangeForMode(mode);
  }, [mode]);
  const scheduleTemperatureRange = useMemo(() => {
    return temperatureRangeForMode(draftSchedule?.mode ?? "cold");
  }, [draftSchedule?.mode]);
  const canControlDevice =
    isDeviceConnected && pairedDevice !== null && deviceState !== null;
  const liveControlsEnabled = canControlDevice && power;
  const quietControlEnabled = canControlDevice && power;
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
      if (pairedDevice === null) {
        setSavedSchedule(null);
        setDraftSchedule(null);
        setSchedulerViewState("empty");
        return;
      }

      const storedSchedule = await getAcSchedule(pairedDevice);

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
  }, [pairedDevice]);

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

  const updateDisplaySnapshot = useCallback(
    (displayPatch: Partial<DeviceStateSnapshot["display"]>) => {
      updateDeviceState((currentState) =>
        currentState === null
          ? currentState
          : {
            ...currentState,
            display: {
              ...currentState.display,
              ...displayPatch,
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

  const sendDisplayCommand = useCallback(
    async (params: Record<string, string>) => {
      const description = Object.entries(params)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(",");

      if (!canControlDevice || pairedDevice === null) {
        logDroppedCommand(description);
        return false;
      }

      if (debugMode) {
        console.log(`[Device] Debug display command accepted: ${description}`);
        return true;
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
    [
      canControlDevice,
      debugMode,
      logDroppedCommand,
      pairedDevice,
      reportDeviceUnreachable,
    ],
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
      const nextSnapshot = nextPower
        ? { power: nextPower }
        : { power: nextPower, quiet: false };

      if (!nextPower) {
        setQuiet(false);
      }

      updateAcSnapshot(nextSnapshot);
      void sendAcCommand({
        power: nextPower ? "on" : "off",
        ...(nextPower ? {} : { quiet: "off" }),
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
    onBackPress();
  }, [onBackPress, triggerPressHaptic]);

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

  const handleQuietChange = useCallback(
    (nextQuiet: boolean) => {
      if (!quietControlEnabled) {
        logDroppedCommand(`quiet=${nextQuiet ? "on" : "off"}`);
        return;
      }

      triggerPressHaptic();
      setQuiet(nextQuiet);
      updateAcSnapshot({ quiet: nextQuiet });
      void sendAcCommand({ quiet: nextQuiet ? "on" : "off" });
    },
    [
      logDroppedCommand,
      quietControlEnabled,
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

    if (pairedDevice === null) {
      setScheduleValidationError("Device is not available.");
      return;
    }

    triggerPressHaptic();
    await saveAcSchedule(pairedDevice, draftSchedule);
    setSavedSchedule(draftSchedule);
    setDraftSchedule(null);
    setScheduleValidationError(null);
    setActiveTimePicker(null);
    setSchedulerViewState("summary");
  }, [draftSchedule, pairedDevice, triggerPressHaptic]);

  const handleToggleScheduleEnabled = useCallback(
    async (nextEnabled: boolean) => {
      if (savedSchedule === null || pairedDevice === null) {
        return;
      }

      triggerPressHaptic();
      const nextSchedule = {
        ...savedSchedule,
        enabled: nextEnabled,
      };
      await saveAcSchedule(pairedDevice, nextSchedule);
      setSavedSchedule(nextSchedule);
    },
    [pairedDevice, savedSchedule, triggerPressHaptic],
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
    if (pairedDevice === null) {
      return;
    }

    triggerPressHaptic();
    await removeAcSchedule(pairedDevice);
    setSavedSchedule(null);
    setDraftSchedule(null);
    setScheduleValidationError(null);
    setActiveTimePicker(null);
    setSchedulerViewState("empty");
  }, [pairedDevice, triggerPressHaptic]);

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
          eyebrow="Living Room"
          isScrolled={isHeaderScrolled}
          onBackPress={handleBackPress}
          title="Air Conditioner"
          rightAccessory={
            <View style={styles.headerMenuButton}>
              <Ellipsis color={theme.text} size={20} strokeWidth={2.2} />
            </View>
          }
        />

        <View style={styles.body}>
          {!canControlDevice ? (
            <Text style={styles.connectionStatus}>{unavailableStatusText}</Text>
          ) : null}

          <Animated.View style={[styles.modePillRow, liveLabelDimStyle]}>
            {modePills.map((modeOption) => {
              const selected = mode === modeOption.id;

              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: !liveControlsEnabled,
                    selected,
                  }}
                  disabled={!liveControlsEnabled}
                  key={modeOption.id}
                  onPress={() => handleModeChange(modeOption.id)}
                  style={[styles.modePill, selected && styles.modePillSelected]}
                >
                  <Text
                    style={[
                      styles.modePillText,
                      selected && styles.modePillTextSelected,
                    ]}
                  >
                    {modeOption.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>

          <Section>
            <View style={styles.temperatureHeader}>
              <View style={styles.temperatureTitleGroup}>
                <View style={styles.temperatureTitleContainer}>
                  <AirVent color={theme.text} />
                  <Text style={styles.cardTitle}>Air Conditioner</Text>
                </View>
                <Text style={styles.cardSubtitle}>
                  Living Room · {power ? "On" : "Off"}
                </Text>
              </View>
              <View style={styles.temperatureActions}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  accessibilityLabel="Toggle quiet mode"
                  accessibilityRole="switch"
                  accessibilityState={{
                    checked: quiet,
                    disabled: !quietControlEnabled,
                  }}
                  disabled={!quietControlEnabled}
                  onPress={() => handleQuietChange(!quiet)}
                  style={[
                    styles.quietButton,
                    quiet ? styles.quietButtonOn : styles.quietButtonOff,
                    !quietControlEnabled && styles.powerCornerButtonDisabled,
                  ]}
                >
                  <Moon
                    color={quiet ? theme.quietAccent : theme.text}
                    size={20}
                    strokeWidth={2.4}
                  />
                </TouchableOpacity>
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
                    styles.powerCornerButton,
                    power
                      ? styles.powerCornerButtonOn
                      : styles.powerCornerButtonOff,
                    !canControlDevice && styles.powerCornerButtonDisabled,
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
              </View>
            </View>

            <ArcTemperatureGauge
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

          <CollapsibleView visible={power}>
            <View style={styles.liveControlSections}>
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

          <View style={styles.scheduleTitleRow}>
            <Text style={styles.sectionTitle}>Schedule</Text>
            {savedSchedule !== null && schedulerViewState !== "editor" ? (
              <Switch
                accessibilityLabel="Toggle AC schedule"
                ios_backgroundColor={theme.controlBackground}
                onValueChange={handleToggleScheduleEnabled}
                thumbColor={
                  savedSchedule.enabled ? theme.accent : theme.textSecondary
                }
                trackColor={{
                  false: theme.controlBackgroundPressed,
                  true: theme.accentMuted,
                }}
                value={savedSchedule.enabled}
              />
            ) : null}
          </View>

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
              <Text style={styles.cardSubtitle}>
                {savedSchedule.enabled ? "Runs every day" : "Schedule paused"}
              </Text>

              <View style={styles.timeGrid}>
                {(["start", "end"] as const).map((field) => (
                  <TouchableOpacity
                    activeOpacity={0.78}
                    accessibilityRole="button"
                    key={field}
                    onPress={() => {
                      handleEditSchedule();
                      setActiveTimePicker(field);
                    }}
                    style={styles.summaryTimeField}
                  >
                    <Text style={styles.timeLabel}>
                      {field === "start" ? "Start at" : "End at"}
                    </Text>
                    <View style={styles.summaryTimeValueRow}>
                      <Text style={styles.summaryTimeValue}>
                        {formatTime12h(
                          field === "start"
                            ? savedSchedule.startTime
                            : savedSchedule.endTime,
                        )}
                      </Text>
                      <ChevronDown
                        color={theme.textSecondary}
                        size={17}
                        strokeWidth={2.4}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.summaryRows}>
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
                <ArcTemperatureGauge
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

          {isDeviceConnected && deviceState?.display.pairingMode !== true ? (
            <Section>
              <DisplayControls
                canControlQr
                isDisabled={!canControlDevice}
                onChangeQrVisible={handleQrVisibilityChange}
                qrVisible={qrVisible}
              />
            </Section>
          ) : null}
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
    paddingBottom: SCREEN_BOTTOM_SAFE_PADDING + theme.spacing.xl,
  },
  body: {
    gap: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  headerMenuButton: {
    alignItems: "center",
    backgroundColor: theme.surfaceLow,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  modePillRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  modePill: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: theme.accentMuted,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 12,
  },
  modePillSelected: {
    // backgroundColor: theme.accentStrong,
    borderColor: theme.accentSolid,
  },
  modePillText: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0,
  },
  modePillTextSelected: {
    color: theme.accentStrong
  },
  temperatureHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
  },
  temperatureTitleGroup: {
    flex: 1,
    gap: theme.spacing.xs,
    minWidth: 0,
  },
  temperatureTitleContainer: {
    display: 'flex',
    flexDirection: 'row',
    gap: 6
  },
  temperatureActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  quietButton: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  quietButtonOn: {
    backgroundColor: theme.quietAccentMuted,
    borderColor: theme.quietAccent,
  },
  quietButtonOff: {
    backgroundColor: theme.controlBackground,
    borderColor: theme.border,
  },
  powerCornerButton: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  powerCornerButtonOn: {
    backgroundColor: theme.powerAccentMuted,
    borderColor: "rgba(255, 106, 88, 0.58)",
  },
  powerCornerButtonOff: {
    backgroundColor: theme.surfaceWarm,
    borderColor: theme.borderActive,
  },
  powerCornerButtonDisabled: {
    opacity: 0.44,
  },
  scheduleTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: theme.spacing.sm,
    minHeight: 32,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0,
  },
  summaryTimeField: {
    backgroundColor: theme.controlBackground,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: theme.spacing.xs,
    minWidth: 0,
    padding: theme.spacing.md,
  },
  summaryTimeValueRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryTimeValue: {
    color: theme.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0,
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
