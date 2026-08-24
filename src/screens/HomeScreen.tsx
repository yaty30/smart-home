import * as Haptics from "expo-haptics";
import { AirVent, Plus, Settings } from "lucide-react-native";
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

import { AppButton } from "../components/AppButton";
import { DeviceCard } from "../components/DeviceCard";
import {
  SCREEN_BOTTOM_SAFE_PADDING,
  ScreenView,
} from "../components/ScreenView";
import { sceneIconById } from "../components/sceneIcons";
import { useDeviceConnection } from "../context/DeviceConnectionContext";
import { useHomeData } from "../context/HomeDataContext";
import type { RootStackScreenProps } from "../navigation/types";
import { getAcSchedule } from "../storage/acScheduleStorage";
import { theme } from "../theme/theme";
import type { HomeDevice } from "../types/home";

type ScheduleRow = {
  deviceId: string;
  deviceName: string;
  enabled: boolean;
  endTime: string;
  sceneId: string;
  startTime: string;
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

export function HomeScreen({ navigation }: RootStackScreenProps<"Home">) {
  const { devices, removeDevice, scenes } = useHomeData();
  const { getRuntime, sendAcCommand, updateAcState } = useDeviceConnection();
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [deleteVisibleId, setDeleteVisibleId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadSchedules = async () => {
      const rows = await Promise.all(
        devices.map(async (device) => {
          const schedule = await getAcSchedule(device.id).catch(() => null);

          if (schedule === null) {
            return null;
          }

          return {
            deviceId: device.id,
            deviceName: device.name,
            enabled: schedule.enabled,
            endTime: schedule.endTime,
            sceneId: device.sceneId,
            startTime: schedule.startTime,
          };
        }),
      );

      if (isActive) {
        setScheduleRows(rows.filter((row): row is ScheduleRow => row !== null));
      }
    };

    void loadSchedules();
    const unsubscribe = navigation.addListener("focus", () => {
      void loadSchedules();
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [devices, navigation]);

  const sceneNameById = useMemo(
    () =>
      scenes.reduce<Record<string, string>>(
        (sceneMap, scene) => ({ ...sceneMap, [scene.id]: scene.name }),
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

  const triggerPressHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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

  const handleOpenScene = useCallback(
    (sceneId: string) => {
      triggerPressHaptic();
      navigation.navigate("Scene", { sceneId });
    },
    [navigation, triggerPressHaptic],
  );

  const handleTogglePower = useCallback(
    (device: HomeDevice) => {
      const { state } = getRuntime(device.id);

      if (state === null) {
        console.log(
          `[Device] Dropped command because ${device.name} is offline: power`,
        );
        return;
      }

      const nextPower = !state.ac.power;
      triggerPressHaptic();
      updateAcState(device.id, { power: nextPower });
      void sendAcCommand(device.id, { power: nextPower ? "on" : "off" });
    },
    [getRuntime, sendAcCommand, triggerPressHaptic, updateAcState],
  );

  const handleOpenDevice = useCallback(
    (device: HomeDevice) => {
      setDeleteVisibleId(null);
      triggerPressHaptic();
      navigation.navigate("AirConditioner", { deviceId: device.id });
    },
    [navigation, triggerPressHaptic],
  );

  const handleRevealDelete = useCallback((device: HomeDevice) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteVisibleId(device.id);
  }, []);

  const handleRequestDeleteDevice = useCallback(
    (device: HomeDevice) => {
      Alert.alert(
        `Delete ${device.name}?`,
        "This device will be removed from your home. This action cannot be undone.",
        [
          {
            onPress: () => setDeleteVisibleId(null),
            style: "cancel",
            text: "Cancel",
          },
          {
            onPress: () => {
              removeDevice(device.id);
              setDeleteVisibleId(null);
            },
            style: "destructive",
            text: "Delete",
          },
        ],
      );
    },
    [removeDevice],
  );

  return (
    <ScreenView>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        onScrollBeginDrag={() => setDeleteVisibleId(null)}
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
            const SceneIcon = sceneIconById[scene.icon];
            const sceneDevices = devices.filter(
              (device) => device.sceneId === scene.id,
            );
            const poweredDevices = sceneDevices.filter(
              (device) => getRuntime(device.id).state?.ac.power === true,
            );
            const temperatures = poweredDevices
              .map((device) => getRuntime(device.id).state?.ac.temperature)
              .filter((value): value is number => typeof value === "number");
            const averageTemperature =
              temperatures.length === 0
                ? null
                : Math.round(
                    temperatures.reduce((total, value) => total + value, 0) /
                      temperatures.length,
                  );

            return (
              <TouchableOpacity
                activeOpacity={0.78}
                accessibilityRole="button"
                key={scene.id}
                onPress={() => handleOpenScene(scene.id)}
                style={styles.sceneCard}
              >
                <View style={styles.sceneCardHeader}>
                  <View style={styles.sceneTitleGroup}>
                    <SceneIcon
                      color={theme.textSecondary}
                      size={18}
                      strokeWidth={2.3}
                    />
                    <Text style={styles.sceneName}>{scene.name}</Text>
                  </View>
                  <Text style={styles.sceneTemperature}>
                    {averageTemperature === null ? "--" : `${averageTemperature}°`}
                  </Text>
                </View>
                <Text style={styles.sceneDeviceCount}>
                  {sceneDevices.length}{" "}
                  {sceneDevices.length === 1 ? "device" : "devices"}
                </Text>
                <View style={styles.chipRow}>
                  {poweredDevices.length === 0 ? (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>
                        {sceneDevices.length === 0 ? "No Devices" : "All Off"}
                      </Text>
                    </View>
                  ) : (
                    poweredDevices.map((device) => (
                      <View
                        key={device.id}
                        style={[styles.chip, styles.chipActive]}
                      >
                        <Text style={[styles.chipText, styles.chipTextActive]}>
                          AC On
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Devices</Text>
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

        {devices.length > 0 ? (
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
                  style={[
                    styles.filterPill,
                    selected && styles.filterPillSelected,
                  ]}
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
        ) : null}

        {devices.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyMark}>
              <AirVent color={theme.accent} size={26} strokeWidth={2.2} />
            </View>
            <Text style={styles.emptyTitle}>No devices yet</Text>
            <Text style={styles.emptyText}>
              Scan the pairing QR code on your ESP32 controller to add an air
              conditioner to a scene.
            </Text>
            <AppButton
              label="Add Device"
              onPress={() => navigation.navigate("NewDevice")}
              vibe="strong"
            />
          </View>
        ) : (
          <View style={styles.deviceGrid}>
            {filteredDevices.map((device) => (
              <DeviceCard
                device={device}
                isDeleteVisible={deleteVisibleId === device.id}
                key={device.id}
                onLongPress={() => handleRevealDelete(device)}
                onPress={() => handleOpenDevice(device)}
                onRequestDelete={() => handleRequestDeleteDevice(device)}
                onTogglePower={() => handleTogglePower(device)}
                sceneName={sceneNameById[device.sceneId] ?? "Unassigned"}
              />
            ))}
          </View>
        )}

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
              key={schedule.deviceId}
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
                style={[
                  styles.schedulePeriodText,
                  styles.scheduleColPeriod,
                  !schedule.enabled && styles.schedulePeriodTextPaused,
                ]}
              >
                {formatTime12h(schedule.startTime)} -{" "}
                {formatTime12h(schedule.endTime)}
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
  emptyCard: {
    alignItems: "center",
    backgroundColor: theme.surfaceLow,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 24,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  emptyMark: {
    alignItems: "center",
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 62,
    justifyContent: "center",
    width: 62,
  },
  emptyTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0,
  },
  emptyText: {
    color: theme.textSecondary,
    fontSize: theme.typography.label,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 21,
    textAlign: "center",
  },
  deviceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
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
  schedulePeriodTextPaused: {
    color: theme.textMuted,
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
