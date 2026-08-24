import * as Haptics from "expo-haptics";
import {
  AirVent,
  Lightbulb,
  Monitor,
  MonitorOff,
  Plus,
  Power,
  PowerOff,
  Settings,
  Tv,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  SCREEN_BOTTOM_SAFE_PADDING,
  ScreenView,
} from "../components/ScreenView";
import { sceneIconById } from "../components/sceneIcons";
import { useDeviceConnection } from "../context/DeviceConnectionContext";
import {
  LIVING_ROOM_AC_DEVICE_ID,
  LIVING_ROOM_AC_SCHEDULE_ID,
  useHomeData,
} from "../context/HomeDataContext";
import type { RootStackScreenProps } from "../navigation/types";
import { getAcSchedule } from "../storage/acScheduleStorage";
import { theme } from "../theme/theme";
import type { AcSchedule } from "../types/acSchedule";
import type { DeviceStateSnapshot } from "../types/device";
import type { HomeDevice } from "../types/home";

const iconByDeviceType = {
  ac: AirVent,
  light: Lightbulb,
  tv: Tv,
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

const getSceneChips = (devices: HomeDevice[], sceneId: string) => {
  const activeDevices = devices.filter(
    (device) => device.sceneId === sceneId && device.powered,
  );

  if (activeDevices.length === 0) {
    return [{ active: false, label: "All Off" }];
  }

  return activeDevices.map((device) => {
    if (device.type === "ac") {
      return { active: true, label: "AC On" };
    }

    if (device.type === "light") {
      return { active: true, label: "Light On" };
    }

    return { active: true, label: "TV On" };
  });
};

export function HomeScreen({ navigation }: RootStackScreenProps<"Home">) {
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
    if (selectedFilter === "all") {
      return devices;
    }

    return devices.filter((device) => device.sceneId === selectedFilter);
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
        `[Device] Dropped command because ESP32 is offline: screen=${
          nextScreenOn ? "on" : "off"
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

  return (
    <ScreenView>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <View style={styles.header}>
          <View style={styles.titleGroup}>
            <Text style={styles.greeting}>Good afternoon</Text>
            <Text style={styles.title}>SmartHome</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              activeOpacity={0.76}
              accessibilityLabel="Open settings"
              accessibilityRole="button"
              style={styles.headerIconButton}
            >
              <Settings color={theme.accent} size={22} strokeWidth={2.3} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.76}
              accessibilityLabel="Add scene or device"
              accessibilityRole="button"
              onPress={openAddMenu}
              style={styles.headerIconButton}
            >
              <Plus color={theme.accent} size={24} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Scenes</Text>
          <TouchableOpacity
            activeOpacity={0.76}
            accessibilityRole="button"
            onPress={() => handleSelectFilter("all")}
          >
            <Text style={styles.linkText}>View all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          contentContainerStyle={styles.sceneList}
          showsHorizontalScrollIndicator={false}
        >
          {scenes.map((scene) => {
            const selected = selectedFilter === scene.id;
            const chips = getSceneChips(devices, scene.id);
            const SceneIcon = sceneIconById[scene.icon];

            return (
              <TouchableOpacity
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={scene.id}
                onPress={() => handleSelectFilter(scene.id)}
                style={[styles.sceneCard, selected && styles.sceneCardSelected]}
              >
                <View style={styles.sceneCardHeader}>
                  <View style={styles.sceneTitleGroup}>
                    <SceneIcon
                      color={selected ? theme.accent : theme.textSecondary}
                      size={18}
                      strokeWidth={2.3}
                    />
                    <Text style={styles.sceneName}>{scene.name}</Text>
                  </View>
                  <Text style={styles.sceneTemperature}>
                    {scene.temperature}°
                  </Text>
                </View>
                <Text style={styles.sceneDeviceCount}>
                  {devices.filter((device) => device.sceneId === scene.id).length} devices
                </Text>
                <View style={styles.chipRow}>
                  {chips.map((chip) => (
                    <View
                      key={`${scene.id}-${chip.label}`}
                      style={[styles.chip, chip.active && styles.chipActive]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          chip.active && styles.chipTextActive,
                        ]}
                      >
                        {chip.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Devices</Text>
          <View style={styles.sectionActions}>
            <TouchableOpacity
              activeOpacity={0.76}
              accessibilityLabel={
                screenOn ? "Turn screen off" : "Turn screen on"
              }
              accessibilityRole="switch"
              accessibilityState={{
                checked: screenOn,
                disabled: !canControlDisplay,
              }}
              disabled={!canControlDisplay}
              onPress={handleScreenPowerChange}
              style={[
                styles.screenToggleButton,
                screenOn && styles.screenToggleButtonActive,
                !canControlDisplay && styles.screenToggleButtonDisabled,
              ]}
            >
              {screenOn ? (
                <Monitor
                  color={theme.accentStrong}
                  size={17}
                  strokeWidth={2.4}
                />
              ) : (
                <MonitorOff
                  color={theme.textSecondary}
                  size={17}
                  strokeWidth={2.4}
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.76}
              accessibilityRole="button"
              onPress={openAddMenu}
              style={styles.addButton}
            >
              <Plus color={theme.accent} size={15} strokeWidth={2.8} />
              <Text style={styles.linkText}>Add</Text>
            </TouchableOpacity>
          </View>
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
                activeOpacity={0.78}
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

        <View style={styles.deviceGrid}>
          {filteredDevices.map((device) => {
            const Icon = iconByDeviceType[device.type];
            const powered = device.powered;
            const PowerIcon = powered ? PowerOff : Power;

            return (
              <TouchableOpacity
                activeOpacity={0.82}
                accessibilityRole="button"
                key={device.id}
                onPress={() => handleOpenDevice(device)}
                style={[styles.deviceCard, powered && styles.deviceCardOn]}
              >
                <View style={styles.deviceCardTop}>
                  <View
                    style={[
                      styles.deviceIconFrame,
                      powered && styles.deviceIconFrameOn,
                    ]}
                  >
                    <Icon
                      color={powered ? theme.accent : theme.textSecondary}
                      size={23}
                      strokeWidth={2.2}
                    />
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.74}
                    accessibilityLabel={`Toggle ${device.name}`}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: powered }}
                    onPress={(event) => {
                      event.stopPropagation();
                      handleToggleDevice(device.id);
                    }}
                    style={[
                      styles.devicePowerButton,
                      powered
                        ? styles.devicePowerButtonShutdown
                        : styles.devicePowerButtonOn,
                    ]}
                  >
                    <PowerIcon
                      color={powered ? theme.powerAccent : theme.accent}
                      size={18}
                      strokeWidth={2.5}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.deviceName}>{device.name}</Text>
                <Text style={styles.deviceScene}>
                  {sceneNameById[device.sceneId] ?? "Unassigned"}
                </Text>
                <Text
                  style={[
                    styles.deviceStatus,
                    powered && styles.deviceStatusOn,
                  ]}
                >
                  {getDeviceStatus(device)}
                </Text>
              </TouchableOpacity>
            );
          })}
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
    paddingBottom: SCREEN_BOTTOM_SAFE_PADDING + theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xl,
  },
  titleGroup: {
    gap: theme.spacing.xs,
  },
  greeting: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
  },
  title: {
    color: theme.text,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 42,
  },
  headerActions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  headerIconButton: {
    alignItems: "center",
    backgroundColor: theme.surfaceLow,
    borderColor: theme.borderStrong,
    borderRadius: 18,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    width: 50,
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
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 0,
  },
  sectionActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  linkText: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
  },
  addButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
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
  sceneList: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  sceneCard: {
    backgroundColor: theme.surfaceLow,
    borderColor: theme.border,
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 140,
    padding: theme.spacing.lg,
    width: 178,
  },
  sceneCardSelected: {
    backgroundColor: theme.surfaceWarm,
    borderColor: theme.borderActive,
    shadowColor: theme.accent,
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 18,
  },
  sceneCardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "space-between",
  },
  sceneTitleGroup: {
    flex: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  sceneName: {
    color: theme.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 19,
  },
  sceneTemperature: {
    color: theme.accent,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 28,
  },
  sceneDeviceCount: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  chip: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
  },
  chipText: {
    color: theme.textSecondary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 12,
  },
  chipTextActive: {
    color: theme.accent,
  },
  filterList: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  filterPill: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  filterPillSelected: {
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
  },
  filterPillText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
  },
  filterPillTextSelected: {
    color: theme.accent,
  },
  deviceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  deviceCard: {
    backgroundColor: theme.surfaceLow,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 174,
    padding: theme.spacing.md,
    width: "48.2%",
  },
  deviceCardOn: {
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
  deviceCardTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  deviceIconFrame: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 17,
    borderWidth: 1,
    height: 45,
    justifyContent: "center",
    width: 45,
  },
  deviceIconFrameOn: {
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
  },
  devicePowerButton: {
    alignItems: "center",
    backgroundColor: theme.surfaceLow,
    borderColor: theme.border,
    borderRadius: 15,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  devicePowerButtonOn: {
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
  },
  devicePowerButtonShutdown: {
    backgroundColor: theme.powerAccentMuted,
    borderColor: theme.powerAccent,
  },
  deviceName: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 19,
  },
  deviceScene: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: theme.spacing.xs,
  },
  deviceStatus: {
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: theme.spacing.md,
  },
  deviceStatusOn: {
    color: theme.accent,
  },
  scheduleCard: {
    backgroundColor: theme.surfaceLow,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 24,
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
