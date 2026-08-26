import * as Haptics from "expo-haptics";
import {
  LinearGradient as ExpoLinearGradient,
  type LinearGradientProps,
} from "expo-linear-gradient";
import { AirVent, Lightbulb, Tv } from "lucide-react-native";
import type { ComponentType } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ACHeader } from "../components/ACHeader";
import { DeviceGridCard } from "../components/DeviceGridCard";
import { SCREEN_BOTTOM_SAFE_PADDING, ScreenView } from "../components/ScreenView";
import { bannerBySceneId } from "../components/sceneBanners";
import { sceneIconById } from "../components/sceneIcons";
import { useDeviceConnection } from "../context/DeviceConnectionContext";
import {
  LIVING_ROOM_AC_DEVICE_ID,
  useHomeData,
} from "../context/HomeDataContext";
import type { RootStackScreenProps } from "../navigation/types";
import { theme } from "../theme/theme";
import type { HomeDevice } from "../types/home";

const iconByDeviceType = {
  ac: AirVent,
  light: Lightbulb,
  tv: Tv,
};

const GradientView =
  ExpoLinearGradient as unknown as ComponentType<LinearGradientProps>;

const formatAcMode = (mode: string) => {
  if (mode === "cool") {
    return "Cool";
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
};

const livingRoomAcFallback: HomeDevice = {
  id: LIVING_ROOM_AC_DEVICE_ID,
  name: "Air Conditioner",
  onDetail: "24°C · Cool",
  powered: true,
  sceneId: "living",
  type: "ac",
};

export function SceneDetailScreen({
  navigation,
  route,
}: RootStackScreenProps<"SceneDetail">) {
  const { sceneId } = route.params;
  const { deviceState, disconnectDevice, updateDeviceState } =
    useDeviceConnection();
  const {
    devices: sceneDevices,
    removeDevice,
    scenes,
    toggleDevice,
  } = useHomeData();
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const latestHeaderScrolled = useRef(false);

  const scene = useMemo(
    () => scenes.find((candidate) => candidate.id === sceneId) ?? null,
    [sceneId, scenes],
  );

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

  const devices = useMemo(() => {
    const allDevices =
      sceneId === "living"
        ? [livingRoomAcDevice, ...sceneDevices]
        : sceneDevices;

    return allDevices.filter((device) => device.sceneId === sceneId);
  }, [livingRoomAcDevice, sceneDevices, sceneId]);

  const banner = bannerBySceneId[sceneId];
  const SceneIcon = scene !== null ? sceneIconById[scene.icon] : null;

  const triggerPressHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleBackPress = useCallback(() => {
    triggerPressHaptic();
    navigation.goBack();
  }, [navigation, triggerPressHaptic]);

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

  const handleDeleteDevice = useCallback(
    (device: HomeDevice) => {
      triggerPressHaptic();

      Alert.alert(
        "Delete device?",
        `Delete ${device.name}? This cannot be undone.`,
        [
          { style: "cancel", text: "Cancel" },
          {
            onPress: () => {
              if (device.id === LIVING_ROOM_AC_DEVICE_ID) {
                void disconnectDevice();
                return;
              }

              removeDevice(device.id);
            },
            style: "destructive",
            text: "Delete",
          },
        ],
      );
    },
    [disconnectDevice, removeDevice, triggerPressHaptic],
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
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <ACHeader
          isScrolled={isHeaderScrolled}
          onBackPress={handleBackPress}
          title={scene?.name ?? "Scene"}
        />

        <View style={styles.body}>
          {banner !== undefined ? (
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="cover"
              source={banner}
              style={styles.banner}
            />
          ) : (
            <GradientView
              colors={theme.gradients.panel}
              end={{ x: 0.86, y: 1 }}
              start={{ x: 0.14, y: 0 }}
              style={[styles.banner, styles.bannerFallback]}
            >
              {SceneIcon !== null ? (
                <SceneIcon color={theme.accent} size={54} strokeWidth={1.6} />
              ) : null}
            </GradientView>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Devices</Text>
            <Text style={styles.linkText}>View all</Text>
          </View>

          <View style={styles.deviceGrid}>
            {devices.map((device) => (
              <DeviceGridCard
                icon={iconByDeviceType[device.type]}
                key={device.id}
                name={device.name}
                onDelete={() => handleDeleteDevice(device)}
                onPress={() => handleOpenDevice(device)}
                onTogglePower={() => handleToggleDevice(device.id)}
                powered={device.powered}
                statusLabel={device.powered ? device.onDetail : "Off"}
                subtitle={scene?.name ?? "Unassigned"}
              />
            ))}
          </View>

          {devices.length === 0 ? (
            <Text style={styles.emptyText}>
              No devices in this scene yet.
            </Text>
          ) : null}
        </View>
      </ScrollView>

    </ScreenView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: SCREEN_BOTTOM_SAFE_PADDING + theme.spacing.xl,
  },
  body: {
    gap: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  banner: {
    borderRadius: theme.radiusLarge,
    height: 218,
    width: "100%",
  },
  bannerFallback: {
    alignItems: "center",
    borderColor: theme.border,
    borderWidth: 1,
    justifyContent: "center",
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0,
  },
  linkText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
  },
  deviceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  emptyText: {
    color: theme.textMuted,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
    paddingVertical: theme.spacing.lg,
    textAlign: "center",
  },
});
