import * as Haptics from "expo-haptics";
import {
  AirVent,
  ArrowDown,
  ArrowRight,
  Bell,
  ChevronRight,
  DropletOff,
  Fan,
  Flame,
  House,
  Lightbulb,
  Monitor,
  MonitorOff,
  Moon,
  Plus,
  Snowflake,
  Sparkles,
  Tally1,
  Tally2,
  Tally3,
  Tally4,
  Tally5,
  Tv,
} from "lucide-react-native";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  AirflowIcon,
  horizontalAirflowOptions,
  type AirflowOption,
  verticalAirflowOptions,
} from "../components/AirflowSelectors";
import { BOTTOM_NAV_CLEARANCE } from "../components/BottomNav";
import { CardPowerButton, DeviceGridCard } from "../components/DeviceGridCard";
import { ScreenView } from "../components/ScreenView";
import { useDeviceConnection } from "../context/DeviceConnectionContext";
import {
  LIVING_ROOM_AC_DEVICE_ID,
  LIVING_ROOM_AC_SCHEDULE_ID,
  useHomeData,
} from "../context/HomeDataContext";
import type {
  MainScrollDirection,
  MainTabScreenProps,
} from "../navigation/types";
import { getAcSchedule } from "../storage/acScheduleStorage";
import { theme } from "../theme/theme";
import type { AcSchedule } from "../types/acSchedule";
import type { DeviceStateSnapshot, EspAirflow } from "../types/device";
import type { HomeDevice } from "../types/home";

const iconByDeviceType = {
  ac: AirVent,
  light: Lightbulb,
  tv: Tv,
};

type HeroStatusIcon = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

const modeHeroStatusByMode: Record<
  DeviceStateSnapshot["ac"]["mode"],
  { icon: HeroStatusIcon; label: string }
> = {
  auto: { icon: Sparkles, label: "Auto" },
  cool: { icon: Snowflake, label: "Cold" },
  dry: { icon: DropletOff, label: "Dry" },
  fan: { icon: Fan, label: "Fan" },
  heat: { icon: Flame, label: "Heat" },
};

const fanHeroStatusBySpeed: Record<
  DeviceStateSnapshot["ac"]["fan"],
  { icon: HeroStatusIcon; label: string }
> = {
  "1": { icon: Tally1, label: "Fan 1" },
  "2": { icon: Tally2, label: "Fan 2" },
  "3": { icon: Tally3, label: "Fan 3" },
  "4": { icon: Tally4, label: "Fan 4" },
  "5": { icon: Tally5, label: "Fan 5" },
  auto: { icon: Fan, label: "Auto" },
};

const airflowOptionIdByEspAirflow: Record<EspAirflow, AirflowOption> = {
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  auto: "auto",
};

const optionForEspAirflow = (
  options: typeof verticalAirflowOptions,
  airflow: EspAirflow,
) => {
  const optionId = airflowOptionIdByEspAirflow[airflow];

  return (
    options.find((option) => option.id === optionId) ?? options[0]!
  );
};

const formatAcMode = (mode: string) => {
  if (mode === "cool") {
    return "Cool";
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
};

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

const getGreeting = () => {
  const hours = new Date().getHours();

  if (hours < 12) {
    return "Good morning";
  }

  if (hours < 18) {
    return "Good afternoon";
  }

  return "Good evening";
};

const livingRoomAcFallback: HomeDevice = {
  id: LIVING_ROOM_AC_DEVICE_ID,
  name: "Air Conditioner",
  onDetail: "24°C · Cool",
  powered: true,
  sceneId: "living",
  type: "ac",
};

const DISPLAY_COMMAND_TIMEOUT_MS = 1500;

const getDeviceStatus = (device: HomeDevice) => {
  return device.powered ? device.onDetail : "Off";
};

export function HomeScreen({
  navigation,
  onScrollDirectionChange,
}: MainTabScreenProps) {
  const {
    debugMode,
    deviceState,
    isDeviceConnected,
    pairedDevice,
    reportDeviceUnreachable,
    updateDeviceState,
  } = useDeviceConnection();
  const {
    devices: sceneDevices,
    scenes,
    schedules,
    toggleDevice,
  } = useHomeData();
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [livingAcSchedule, setLivingAcSchedule] = useState<AcSchedule | null>(
    null,
  );
  const latestScrollY = useRef(0);

  useEffect(() => {
    let isActive = true;

    const loadLivingAcSchedule = () => {
      if (pairedDevice === null) {
        return;
      }

      getAcSchedule(pairedDevice)
        .then((schedule) => {
          if (isActive) {
            setLivingAcSchedule(schedule);
          }
        })
        .catch(() => {
          // Keep the seeded schedule when storage is unavailable.
        });
    };

    loadLivingAcSchedule();
    const unsubscribe = navigation.addListener("focus", loadLivingAcSchedule);

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [navigation, pairedDevice]);

  const livingRoomAcDevice = useMemo<HomeDevice>(() => {
    if (deviceState === null) {
      return livingRoomAcFallback;
    }

    return {
      ...livingRoomAcFallback,
      onDetail: `${deviceState.ac.temperature}°C · ${formatAcMode(
        deviceState.ac.mode,
      )}`,
      powered: deviceState.ac.power,
    };
  }, [deviceState]);

  const devices = useMemo(
    () => [livingRoomAcDevice, ...sceneDevices],
    [livingRoomAcDevice, sceneDevices],
  );

  const sceneNameById = useMemo(
    () =>
      scenes.reduce<Record<string, string>>(
        (sceneMap, scene) => ({
          ...sceneMap,
          [scene.id]: scene.name,
        }),
        {},
      ),
    [scenes],
  );

  const sceneFilters = useMemo(
    () => [
      { id: "all", label: "All" },
      ...scenes.map((scene) => ({ id: scene.id, label: scene.name })),
    ],
    [scenes],
  );

  const filteredDevices = useMemo(() => {
    const gridDevices = devices.filter(
      (device) => device.id !== LIVING_ROOM_AC_DEVICE_ID,
    );

    if (selectedFilter === "all") {
      return gridDevices;
    }

    return gridDevices.filter((device) => device.sceneId === selectedFilter);
  }, [devices, selectedFilter]);

  const scheduleRows = useMemo(
    () =>
      schedules.map((schedule) => {
        if (
          schedule.id === LIVING_ROOM_AC_SCHEDULE_ID &&
          livingAcSchedule !== null
        ) {
          return {
            ...schedule,
            endTime: livingAcSchedule.endTime,
            startTime: livingAcSchedule.startTime,
          };
        }

        return schedule;
      }),
    [livingAcSchedule, schedules],
  );

  const canControlDisplay =
    isDeviceConnected && pairedDevice !== null && deviceState !== null;
  const screenOn = deviceState?.display.screenOn ?? false;
  const acMode = deviceState?.ac.mode ?? "cool";
  const fanSpeed = deviceState?.ac.fan ?? "auto";
  const quietOn = livingRoomAcDevice.powered && deviceState?.ac.quiet === true;
  const verticalAirflow = deviceState?.ac.swingVertical ?? "auto";
  const horizontalAirflow = deviceState?.ac.swingHorizontal ?? "auto";
  const heroStatusItems = useMemo(
    () => {
      const verticalOption = optionForEspAirflow(
        verticalAirflowOptions,
        verticalAirflow,
      );
      const horizontalOption = optionForEspAirflow(
        horizontalAirflowOptions,
        horizontalAirflow,
      );

      return [
        {
          ...modeHeroStatusByMode[acMode],
          id: "mode",
          type: "icon" as const,
        },
        {
          ...fanHeroStatusBySpeed[fanSpeed],
          id: "fan",
          type: "icon" as const,
        },
        {
          iconRotation: horizontalOption.iconRotation ?? 0,
          iconType: horizontalOption.iconType ?? 3,
          id: "horizontal-airflow",
          isAuto: horizontalAirflow === "auto",
          label: "Horizontal",
          type: "airflow" as const,
        },
        {
          iconRotation: verticalOption.iconRotation ?? 0,
          iconType: verticalOption.iconType ?? 3,
          id: "vertical-airflow",
          isAuto: verticalAirflow === "auto",
          label: "Vertical",
          type: "airflow" as const,
        },
      ];
    },
    [acMode, fanSpeed, horizontalAirflow, verticalAirflow],
  );

  const triggerPressHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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

  const sendDisplayCommand = useCallback(
    async (params: Record<string, string>) => {
      const description = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join(",");

      if (!canControlDisplay || pairedDevice === null) {
        console.log(
          `[Device] Dropped command because ESP32 is offline: ${description}`,
        );
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
        DISPLAY_COMMAND_TIMEOUT_MS,
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
    [canControlDisplay, debugMode, pairedDevice, reportDeviceUnreachable],
  );

  const handleScreenPowerChange = useCallback(() => {
    const nextScreenOn = !screenOn;

    if (!canControlDisplay) {
      console.log(
        `[Device] Dropped command because ESP32 is offline: screen=${nextScreenOn ? "on" : "off"
        }`,
      );
      return;
    }

    triggerPressHaptic();
    updateDisplaySnapshot({ screenOn: nextScreenOn });
    void sendDisplayCommand({ screen: nextScreenOn ? "on" : "off" });
  }, [
    canControlDisplay,
    screenOn,
    sendDisplayCommand,
    triggerPressHaptic,
    updateDisplaySnapshot,
  ]);

  const openAddMenu = useCallback(() => {
    triggerPressHaptic();

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: 0,
          options: ["Cancel", "New Scene", "New Device"],
          userInterfaceStyle: "dark",
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            navigation.navigate("NewScene");
          } else if (buttonIndex === 2) {
            navigation.navigate("NewDevice");
          }
        },
      );
      return;
    }

    Alert.alert("Add", undefined, [
      {
        onPress: () => navigation.navigate("NewScene"),
        text: "New Scene",
      },
      {
        onPress: () => navigation.navigate("NewDevice"),
        text: "New Device",
      },
      { style: "cancel", text: "Cancel" },
    ]);
  }, [navigation, triggerPressHaptic]);

  const handleSelectFilter = useCallback(
    (filter: string) => {
      triggerPressHaptic();
      setSelectedFilter(filter);
    },
    [triggerPressHaptic],
  );

  const handleOpenScene = useCallback(() => {
    if (selectedFilter === "all") {
      return;
    }

    triggerPressHaptic();
    navigation.navigate("SceneDetail", { sceneId: selectedFilter });
  }, [navigation, selectedFilter, triggerPressHaptic]);

  const handleToggleDevice = useCallback(
    (deviceId: string) => {
      triggerPressHaptic();

      if (deviceId === LIVING_ROOM_AC_DEVICE_ID) {
        updateDeviceState((currentState) =>
          currentState === null
            ? currentState
            : {
              ...currentState,
              ac: {
                ...currentState.ac,
                power: !currentState.ac.power,
              },
            },
        );
        return;
      }

      toggleDevice(deviceId);
    },
    [toggleDevice, triggerPressHaptic, updateDeviceState],
  );

  const handleOpenDevice = useCallback(
    (device: HomeDevice) => {
      triggerPressHaptic();

      if (device.type === "ac") {
        navigation.navigate("AirConditioner");
        return;
      }

      toggleDevice(device.id);
    },
    [navigation, toggleDevice, triggerPressHaptic],
  );

  const handleMainScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextScrollY = Math.max(event.nativeEvent.contentOffset.y, 0);
      const scrollDelta = nextScrollY - latestScrollY.current;

      if (nextScrollY <= 0) {
        latestScrollY.current = nextScrollY;
        onScrollDirectionChange?.("up");
        return;
      }

      if (Math.abs(scrollDelta) < 6) {
        return;
      }

      const direction: MainScrollDirection = scrollDelta > 0 ? "down" : "up";
      latestScrollY.current = nextScrollY;
      onScrollDirectionChange?.(direction);
    },
    [onScrollDirectionChange],
  );

  return (
    <ScreenView>
      <ScrollView
        alwaysBounceVertical
        contentContainerStyle={styles.content}
        onScroll={handleMainScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <View style={styles.header}>
          <View style={styles.identityGroup}>
            <View style={styles.avatar}>
              <House color={theme.accent} size={22} strokeWidth={2.3} />
            </View>
            <View style={styles.greetingGroup}>
              <Text style={styles.greetingName}>Hi there</Text>
              <Text style={styles.greeting}>{getGreeting()}</Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.76}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
            style={styles.headerIconButton}
          >
            <Bell color={theme.text} size={20} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          contentContainerStyle={styles.filterList}
          showsHorizontalScrollIndicator={false}
        >
          {sceneFilters.map((filter) => {
            const selected = selectedFilter === filter.id;

            return (
              <TouchableOpacity
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={filter.id}
                onPress={() => handleSelectFilter(filter.id)}
                style={[styles.filterPill, selected && styles.filterPillSelected]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    selected && styles.filterPillTextSelected,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {selectedFilter !== "all" ? (
          <TouchableOpacity
            activeOpacity={0.76}
            accessibilityRole="button"
            onPress={handleOpenScene}
            style={styles.sceneLinkRow}
          >
            <Text style={styles.sceneLinkTitle}>
              {sceneNameById[selectedFilter] ?? "Scene"}
            </Text>
            <View style={styles.sceneLinkAction}>
              <Text style={styles.linkText}>Open scene</Text>
              <ChevronRight color={theme.accent} size={16} strokeWidth={2.6} />
            </View>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Open air conditioner controls"
          onPress={() => handleOpenDevice(livingRoomAcDevice)}
          style={[styles.heroCard, livingRoomAcDevice.powered ? styles.heroCardOn : {}]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleGroup}>
              <Text style={styles.heroTitle}>{livingRoomAcDevice.name}</Text>
              <Text style={styles.heroSubtitle}>
                Connected to {sceneNameById[livingRoomAcDevice.sceneId]}
              </Text>
            </View>
            <View style={styles.heroActions}>
              {quietOn ? (
                <View
                  accessibilityLabel="Quiet mode is on"
                  style={styles.heroQuietIndicator}
                >
                  <Moon
                    color={theme.quietAccent}
                    size={18}
                    strokeWidth={2.4}
                  />
                </View>
              ) : null}
              <CardPowerButton
                accessibilityLabel="Toggle air conditioner"
                isOn={livingRoomAcDevice.powered}
                onToggle={(event) => {
                  event.stopPropagation();
                  handleToggleDevice(livingRoomAcDevice.id);
                }}
              />
            </View>
          </View>

          <View style={styles.heroIllustration}>
            <View
              style={[
                styles.heroIconHalo,
                livingRoomAcDevice.powered && styles.heroIconHaloOn,
              ]}
            >
              <AirVent
                color={
                  livingRoomAcDevice.powered ? theme.accent : theme.textMuted
                }
                size={62}
                strokeWidth={1.6}
              />
            </View>
            <Text
              style={[
                styles.heroStatus,
                livingRoomAcDevice.powered && styles.heroStatusOn,
              ]}
            >
              {getDeviceStatus(livingRoomAcDevice)}
            </Text>
          </View>

          <View style={styles.heroModeRow}>
            {heroStatusItems.map((statusItem) => {
              return (
                <View key={statusItem.id} style={styles.heroModeItem}>
                  <View
                    style={[
                      styles.heroModeCircle,
                      livingRoomAcDevice.powered && styles.heroModeCircleActive,
                    ]}
                  >
                    {statusItem.type === "airflow" ? (
                      <View style={styles.heroAirflowIcon}>
                        <View style={{ transform: `rotate(${statusItem.isAuto ? 0 : statusItem.iconRotation}deg)` }}>
                          {statusItem.isAuto ? <Text style={{fontSize: 20, fontWeight: '700', color: theme.accentBright}}>A</Text> :
                            statusItem.id === "vertical-airflow" ?
                              <ArrowRight color={theme.accentBright} />
                              :
                              <ArrowDown color={theme.accentBright}/>
                          }
                        </View>
                      </View>
                    ) : (
                      (() => {
                        const StatusIcon = statusItem.icon;

                        return (
                          <StatusIcon
                            color={theme.accentBright}
                            size={19}
                            strokeWidth={2.2}
                          />
                        );
                      })()
                    )}
                  </View>
                  <Text
                    style={[
                      styles.heroModeLabel,
                      livingRoomAcDevice.powered && styles.heroModeLabelActive,
                    ]}
                  >
                    {statusItem.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Manage your device</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityLabel="Add scene or device"
            accessibilityRole="button"
            onPress={openAddMenu}
            style={styles.addButton}
          >
            <Plus color={theme.textOnAccent} size={20} strokeWidth={2.6} />
          </TouchableOpacity>
        </View>

        <View style={styles.deviceGrid}>
          {filteredDevices.map((device) => (
            <DeviceGridCard
              icon={iconByDeviceType[device.type]}
              key={device.id}
              name={device.name}
              onPress={() => handleOpenDevice(device)}
              onTogglePower={() => handleToggleDevice(device.id)}
              powered={device.powered}
              statusLabel={getDeviceStatus(device)}
              subtitle={sceneNameById[device.sceneId] ?? "Unassigned"}
            />
          ))}
        </View>

        <View style={[styles.sectionHeader, styles.schedulesSectionHeader]}>
          <Text style={styles.sectionTitle}>Schedules</Text>
        </View>

        <View style={styles.scheduleCard}>
          <View style={styles.scheduleHeaderRow}>
            <Text style={[styles.scheduleHeaderText, styles.scheduleColScene]}>
              Scene
            </Text>
            <Text style={[styles.scheduleHeaderText, styles.scheduleColDevice]}>
              Device
            </Text>
            <Text style={[styles.scheduleHeaderText, styles.scheduleColPeriod]}>
              Period
            </Text>
          </View>

          {scheduleRows.map((schedule, index) => (
            <View
              key={schedule.id}
              style={[
                styles.scheduleRow,
                index === scheduleRows.length - 1 && styles.scheduleRowLast,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.scheduleSceneText, styles.scheduleColScene]}
              >
                {sceneNameById[schedule.sceneId] ?? "Unassigned"}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.scheduleDeviceText, styles.scheduleColDevice]}
              >
                {schedule.deviceName}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.schedulePeriodText, styles.scheduleColPeriod]}
              >
                {formatTime12h(schedule.startTime)} - {formatTime12h(schedule.endTime)}
              </Text>
            </View>
          ))}

          {scheduleRows.length === 0 ? (
            <Text style={styles.scheduleEmptyText}>No schedules yet.</Text>
          ) : null}
        </View>
      </ScrollView>

    </ScreenView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: BOTTOM_NAV_CLEARANCE + theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xl,
  },
  identityGroup: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: theme.surfaceWarm,
    borderColor: theme.borderStrong,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  greetingGroup: {
    gap: 2,
  },
  greetingName: {
    color: theme.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0,
  },
  greeting: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
  },
  headerIconButton: {
    alignItems: "center",
    backgroundColor: theme.surfaceLow,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  filterList: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  filterPill: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 11,
  },
  filterPillSelected: {
    backgroundColor: theme.accentSolid,
    borderColor: theme.accentSolid,
  },
  filterPillText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
  },
  filterPillTextSelected: {
    color: theme.textOnAccent,
  },
  sceneLinkRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  sceneLinkTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0,
  },
  sceneLinkAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  linkText: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
  },
  heroCardOn: {
    backgroundColor: theme.surfaceWarm,
    borderColor: theme.borderStrong,
    shadowColor: theme.accent,
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  heroCard: {
    backgroundColor: theme.surfaceLow,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  heroTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
  },
  heroTitleGroup: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  heroActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  heroQuietIndicator: {
    alignItems: "center",
    backgroundColor: theme.quietAccentMuted,
    borderColor: theme.quietAccent,
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  heroTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0,
  },
  heroSubtitle: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
  },
  heroIllustration: {
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xl,
  },
  heroIconHalo: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 118,
    justifyContent: "center",
    width: 118,
  },
  heroIconHaloOn: {
    backgroundColor: theme.accentSubtle,
    borderColor: theme.borderStrong,
  },
  heroStatus: {
    color: theme.textMuted,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0,
  },
  heroStatusOn: {
    color: theme.accent,
  },
  heroFooterHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  heroFooterLabel: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  screenToggleButton: {
    alignItems: "center",
    backgroundColor: theme.surfaceLow,
    borderColor: theme.border,
    borderRadius: 13,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  screenToggleButtonActive: {
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
  },
  screenToggleButtonDisabled: {
    opacity: 0.45,
  },
  heroModeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroModeItem: {
    alignItems: "center",
    gap: theme.spacing.sm,
    width: 64,
  },
  heroModeCircle: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  heroModeCircleActive: {
    backgroundColor: theme.powerAccentMuted,
    borderColor: theme.accentSolid,
  },
  heroAirflowIcon: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    position: "relative",
  },
  heroAirflowAuto: {
    backgroundColor: theme.controlBackground,
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 7,
    borderWidth: 1,
    color: theme.textSecondary,
    fontSize: 9,
    fontWeight: "900",
    height: 14,
    letterSpacing: 0,
    lineHeight: 12,
    minWidth: 14,
    overflow: "hidden",
    position: "absolute",
    right: -9,
    textAlign: "center",
    top: -10,
  },
  heroAirflowAutoActive: {
    backgroundColor: theme.textOnAccent,
    borderColor: theme.textOnAccent,
    color: theme.accentSolid,
  },
  heroModeLabel: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0,
  },
  heroModeLabelActive: {
    color: theme.accent,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  schedulesSectionHeader: {
    marginTop: theme.spacing.xl,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0,
  },
  addButton: {
    alignItems: "center",
    backgroundColor: theme.accentSolid,
    borderRadius: theme.radiusRound,
    height: 40,
    justifyContent: "center",
    shadowColor: theme.accentSolid,
    shadowOffset: {
      height: 4,
      width: 0,
    },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    width: 40,
  },
  deviceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  scheduleCard: {
    backgroundColor: theme.surfaceLow,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  scheduleHeaderRow: {
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  scheduleHeaderText: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  scheduleRow: {
    alignItems: "center",
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  scheduleRowLast: {
    borderBottomWidth: 0,
  },
  scheduleColScene: {
    flex: 1,
  },
  scheduleColDevice: {
    flex: 1,
  },
  scheduleColPeriod: {
    flex: 1.35,
    textAlign: "right",
  },
  scheduleSceneText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
  },
  scheduleDeviceText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
  },
  schedulePeriodText: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
  },
  scheduleEmptyText: {
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
    paddingVertical: theme.spacing.md,
    textAlign: "center",
  },
});
