import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import {
  AirVent,
  CalendarClock,
  DropletOff,
  Ellipsis,
  Flame,
  Moon,
  Power,
  PowerOff,
  Snowflake,
  Sparkles,
  Star,
  Zap,
} from "lucide-react-native";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  HorizontalAirflowSelector,
  VerticalAirflowSelector,
} from "../components/AirflowSelectors";
import { ArcTemperatureGauge } from "../components/ArcTemperatureGauge";
import { CollapsibleView } from "../components/CollapsibleView";
import { FanSpeedControl } from "../components/FanSpeedControl";
import {
  SCREEN_BOTTOM_SAFE_PADDING,
  ScreenView,
} from "../components/ScreenView";
import { Section } from "../components/Section";
import { BottomNav, BOTTOM_NAV_CLEARANCE } from "../components/BottomNav";
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
import { normalizeTemperature } from "../utils/temperatureGauge";
import { HeaderIconButton } from "../components/AppHeader";
import { useDevices } from "../store/devices";

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
const BOTTOM_NAV_ANIMATION_MS = 260;
const BOTTOM_NAV_HIDDEN_OFFSET = BOTTOM_NAV_CLEARANCE + 48;

const modeStlyes = {
  opacity: 0.86
}

const modePills = (theme: Theme): { id: AirConditionerMode; label: string, icon: ReactNode }[] => [
  { id: "auto", label: "Auto", icon: <Sparkles style={modeStlyes} size={18} color={theme.modeColors.auto} /> },
  { id: "cold", label: "Cold", icon: <Snowflake style={modeStlyes} size={18} color={theme.modeColors.cool} /> },
  { id: "dry", label: "Dry", icon: <DropletOff style={modeStlyes} size={18} color={theme.modeColors.dry} /> },
  { id: "heat", label: "Heat", icon: <Flame style={modeStlyes} size={18} color={theme.modeColors.heat} /> },
];

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
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const modePillsData = useMemo(() => modePills(theme), [theme]);
  const { width } = useWindowDimensions();
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
  const bottomNavTranslateY = useRef(
    new Animated.Value(BOTTOM_NAV_HIDDEN_OFFSET),
  ).current;
  const bottomNavOpacity = useRef(new Animated.Value(0)).current;
  const isLeavingScreen = useRef(false);
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
      return "Syncing ESP32 state";
    }

    return "Device offline";
  }, [deviceConnectionStatus, deviceState]);

  const scheduleDeviceKey =
    pairedDevice === null ? null : `${pairedDevice.host}|${pairedDevice.token}`;

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

  const animateBottomNavIn = useCallback(() => {
    bottomNavTranslateY.stopAnimation();
    bottomNavOpacity.stopAnimation();

    Animated.parallel([
      Animated.timing(bottomNavTranslateY, {
        duration: BOTTOM_NAV_ANIMATION_MS,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(bottomNavOpacity, {
        duration: BOTTOM_NAV_ANIMATION_MS,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bottomNavOpacity, bottomNavTranslateY]);

const animateBottomNavOut = useCallback(() => {
  Animated.parallel([
    Animated.timing(bottomNavTranslateY, {
      toValue: BOTTOM_NAV_HIDDEN_OFFSET,
      duration: 220,
      useNativeDriver: true,
    }),
    Animated.timing(bottomNavOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }),
  ]).start();
}, [bottomNavOpacity, bottomNavTranslateY]);

  // Paint the screen with the nav below the viewport first, then slide it in.
  useEffect(() => {
    const frame = requestAnimationFrame(animateBottomNavIn);

    return () => {
      cancelAnimationFrame(frame);
      bottomNavTranslateY.stopAnimation();
      bottomNavOpacity.stopAnimation();
    };
  }, [animateBottomNavIn, bottomNavOpacity, bottomNavTranslateY]);

  // React Navigation owns swipe-back gestures, so the normal header back handler
  // is not called when the user swipes. Listen to the navigator transition and
  // animate this screen's custom bottom nav independently.
  useEffect(() => {
    const unsubscribeTransitionStart = navigation.addListener(
      "transitionStart",
      (event: { data?: { closing?: boolean } }) => {
        if (!event.data?.closing) {
          return;
        }

        animateBottomNavOut();
      },
    );

    // Native-stack emits this on iOS when the interactive back gesture is
    // abandoned. Restore the nav because the screen remains visible.
    const unsubscribeGestureCancel = navigation.addListener(
      "gestureCancel",
      () => {
        if (!isLeavingScreen.current) {
          animateBottomNavIn();
        }
      },
    );

    return () => {
      unsubscribeTransitionStart();
      unsubscribeGestureCancel();
    };
  }, [animateBottomNavIn, animateBottomNavOut, navigation]);

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

          <Animated.View style={[styles.modePillRow, liveLabelDimStyle]}>
            {modePillsData.map((modeOption) => {
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
                  {modeOption.icon}
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
                  accessibilityLabel="Toggle powerful mode"
                  accessibilityRole="switch"
                  accessibilityState={{
                    checked: powerful,
                    disabled: !powerfulControlEnabled,
                  }}
                  disabled={!powerfulControlEnabled}
                  onPress={() => handlePowerfulChange(!powerful)}
                  style={[
                    styles.quietButton,
                    powerful ? styles.powerfulButtonOn : styles.quietButtonOff,
                    !powerfulControlEnabled && styles.powerCornerButtonDisabled,
                  ]}
                >
                  <Zap
                    color={powerful ? theme.powerfulAccent : theme.text}
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
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.bottomNavAnimationLayer,
          {
            opacity: bottomNavOpacity,
            transform: [{ translateY: bottomNavTranslateY }],
          },
        ]}
      >
        <BottomNav
          visible
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
      </Animated.View>
    </ScreenView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  bottomNavAnimationLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  content: {
    flexGrow: 1,
    paddingBottom: SCREEN_BOTTOM_SAFE_PADDING + theme.spacing.xl + BOTTOM_NAV_CLEARANCE,
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
    flexDirection: 'row',
    gap: theme.spacing.xs
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
    color: theme.accentStrong,
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
    display: "flex",
    flexDirection: "row",
    gap: 6,
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
  powerfulButtonOn: {
    backgroundColor: theme.powerfulAccentMuted,
    borderColor: theme.powerfulAccent,
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
    borderColor: theme.powerButton.borderOn,
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
    borderColor: theme.borders.soft,
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
    backgroundColor: theme.overlays.timePickerBackdrop,
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
  modeIcon: {
    opacity: 0.6
  }
});
