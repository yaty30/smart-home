import * as Haptics from "expo-haptics";
import {
  AirVent,
  Lightbulb,
  Plus,
  Power,
  PowerOff,
  Settings,
  Tv,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
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
import { useDeviceConnection } from "../context/DeviceConnectionContext";
import { theme } from "../theme/theme";

type RoomId = "living" | "bedroom" | "study";
type DeviceType = "ac" | "light" | "tv";
type DeviceFilter = "all" | RoomId;

type Room = {
  id: RoomId;
  name: string;
  temperature: number;
};

type HomeDevice = {
  id: string;
  name: string;
  type: DeviceType;
  roomId: RoomId;
  powered: boolean;
  onDetail: string;
};

type HomeScreenProps = {
  onOpenAirConditioner: () => void;
};

const rooms: Room[] = [
  { id: "living", name: "Living Room", temperature: 24 },
  { id: "bedroom", name: "Master Bedroom", temperature: 25 },
  { id: "study", name: "Study Room", temperature: 23 },
];

const roomFilters: { id: DeviceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "living", label: "Living Room" },
  { id: "bedroom", label: "Master Bedroom" },
  { id: "study", label: "Study Room" },
];

const roomNameById = rooms.reduce<Record<RoomId, string>>(
  (roomMap, room) => ({
    ...roomMap,
    [room.id]: room.name,
  }),
  {
    living: "Living Room",
    bedroom: "Master Bedroom",
    study: "Study Room",
  },
);

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

const initialDevices: HomeDevice[] = [
  {
    id: "living-ac",
    name: "Air Conditioner",
    onDetail: "24°C · Cool",
    powered: true,
    roomId: "living",
    type: "ac",
  },
  {
    id: "living-light",
    name: "Light",
    onDetail: "On · 70%",
    powered: false,
    roomId: "living",
    type: "light",
  },
  {
    id: "living-tv",
    name: "TV",
    onDetail: "On · HDMI 1",
    powered: false,
    roomId: "living",
    type: "tv",
  },
  {
    id: "bedroom-ac",
    name: "Air Conditioner",
    onDetail: "25°C · Cool",
    powered: false,
    roomId: "bedroom",
    type: "ac",
  },
  {
    id: "bedroom-light",
    name: "Light",
    onDetail: "On · 70%",
    powered: false,
    roomId: "bedroom",
    type: "light",
  },
  {
    id: "study-ac",
    name: "Air Conditioner",
    onDetail: "23°C · Cool",
    powered: true,
    roomId: "study",
    type: "ac",
  },
  {
    id: "study-light",
    name: "Light",
    onDetail: "On · 70%",
    powered: true,
    roomId: "study",
    type: "light",
  },
];

const getDeviceStatus = (device: HomeDevice) => {
  return device.powered ? device.onDetail : "Off";
};

const getRoomChips = (devices: HomeDevice[], roomId: RoomId) => {
  const activeDevices = devices.filter(
    (device) => device.roomId === roomId && device.powered,
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

export function HomeScreen({ onOpenAirConditioner }: HomeScreenProps) {
  const { deviceState, updateDeviceState } = useDeviceConnection();
  const [selectedFilter, setSelectedFilter] = useState<DeviceFilter>("all");
  const [localDevices, setLocalDevices] = useState<HomeDevice[]>(() =>
    initialDevices.filter((device) => device.id !== "living-ac"),
  );
  const livingRoomAcDevice = useMemo<HomeDevice>(() => {
    const fallbackDevice = initialDevices.find(
      (device) => device.id === "living-ac",
    ) as HomeDevice;

    if (deviceState === null) {
      return fallbackDevice;
    }

    return {
      ...fallbackDevice,
      onDetail: `${deviceState.ac.temperature}°C · ${formatAcMode(
        deviceState.ac.mode,
      )}`,
      powered: deviceState.ac.power,
    };
  }, [deviceState]);
  const devices = useMemo(
    () => [livingRoomAcDevice, ...localDevices],
    [livingRoomAcDevice, localDevices],
  );

  const filteredDevices = useMemo(() => {
    if (selectedFilter === "all") {
      return devices;
    }

    return devices.filter((device) => device.roomId === selectedFilter);
  }, [devices, selectedFilter]);

  const triggerPressHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSelectFilter = useCallback(
    (filter: DeviceFilter) => {
      triggerPressHaptic();
      setSelectedFilter(filter);
    },
    [triggerPressHaptic],
  );

  const handleToggleDevice = useCallback(
    (deviceId: string) => {
      triggerPressHaptic();

      if (deviceId === "living-ac") {
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

      setLocalDevices((currentDevices) =>
        currentDevices.map((device) =>
          device.id === deviceId
            ? { ...device, powered: !device.powered }
            : device,
        ),
      );
    },
    [triggerPressHaptic, updateDeviceState],
  );

  const handleOpenDevice = useCallback(
    (device: HomeDevice) => {
      triggerPressHaptic();

      if (device.type === "ac") {
        onOpenAirConditioner();
        return;
      }

      setLocalDevices((currentDevices) =>
        currentDevices.map((currentDevice) =>
          currentDevice.id === device.id
            ? { ...currentDevice, powered: !currentDevice.powered }
            : currentDevice,
        ),
      );
    },
    [onOpenAirConditioner, triggerPressHaptic],
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
          <TouchableOpacity
            activeOpacity={0.76}
            accessibilityLabel="Open settings"
            accessibilityRole="button"
            style={styles.headerIconButton}
          >
            <Settings color={theme.accent} size={22} strokeWidth={2.3} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Rooms</Text>
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
          contentContainerStyle={styles.roomList}
          showsHorizontalScrollIndicator={false}
        >
          {rooms.map((room) => {
            const selected = selectedFilter === room.id;
            const chips = getRoomChips(devices, room.id);

            return (
              <TouchableOpacity
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={room.id}
                onPress={() => handleSelectFilter(room.id)}
                style={[styles.roomCard, selected && styles.roomCardSelected]}
              >
                <View style={styles.roomCardHeader}>
                  <Text style={styles.roomName}>{room.name}</Text>
                  <Text style={styles.roomTemperature}>
                    {room.temperature}°
                  </Text>
                </View>
                <Text style={styles.roomDeviceCount}>
                  {devices.filter((device) => device.roomId === room.id).length} devices
                </Text>
                <View style={styles.chipRow}>
                  {chips.map((chip) => (
                    <View
                      key={`${room.id}-${chip.label}`}
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
          <TouchableOpacity
            activeOpacity={0.76}
            accessibilityRole="button"
            style={styles.addButton}
          >
            <Plus color={theme.accent} size={15} strokeWidth={2.8} />
            <Text style={styles.linkText}>Add</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          contentContainerStyle={styles.filterList}
          showsHorizontalScrollIndicator={false}
        >
          {roomFilters.map((filter) => {
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
                <Text style={styles.deviceRoom}>
                  {roomNameById[device.roomId]}
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
  roomList: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  roomCard: {
    backgroundColor: theme.surfaceLow,
    borderColor: theme.border,
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 140,
    padding: theme.spacing.lg,
    width: 178,
  },
  roomCardSelected: {
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
  roomCardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "space-between",
  },
  roomName: {
    color: theme.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 19,
  },
  roomTemperature: {
    color: theme.accent,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 28,
  },
  roomDeviceCount: {
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
  deviceRoom: {
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
});
