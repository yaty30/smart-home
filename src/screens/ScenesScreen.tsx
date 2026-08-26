import * as Haptics from "expo-haptics";
import {
  LinearGradient as ExpoLinearGradient,
  type LinearGradientProps,
} from "expo-linear-gradient";
import { AirVent, Ellipsis, Lightbulb, Tv } from "lucide-react-native";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { BOTTOM_NAV_CLEARANCE } from "../components/BottomNav";
import { ScreenView } from "../components/ScreenView";
import { bannerBySceneId } from "../components/sceneBanners";
import { sceneIconById } from "../components/sceneIcons";
import { useDeviceConnection } from "../context/DeviceConnectionContext";
import {
  LIVING_ROOM_AC_DEVICE_ID,
  useHomeData,
} from "../context/HomeDataContext";
import type {
  MainScrollDirection,
  MainTabScreenProps,
} from "../navigation/types";
import { theme } from "../theme/theme";
import type { HomeDevice, HomeDeviceType } from "../types/home";

const iconByDeviceType: Record<
  HomeDeviceType,
  ComponentType<{ color?: string; size?: number; strokeWidth?: number }>
> = {
  ac: AirVent,
  light: Lightbulb,
  tv: Tv,
};

const GradientView =
  ExpoLinearGradient as unknown as ComponentType<LinearGradientProps>;

const livingRoomAcFallback: HomeDevice = {
  id: LIVING_ROOM_AC_DEVICE_ID,
  name: "Air Conditioner",
  onDetail: "24°C · Cool",
  powered: true,
  sceneId: "living",
  type: "ac",
};

const sceneBannerSources = Object.values(bannerBySceneId);

export function ScenesScreen({
  navigation,
  onScrollDirectionChange,
}: MainTabScreenProps) {
  const { deviceState } = useDeviceConnection();
  const { devices: sceneDevices, scenes } = useHomeData();
  const latestScrollY = useRef(0);

  useEffect(() => {
    sceneBannerSources.forEach((banner) => {
      const { uri } = Image.resolveAssetSource(banner);

      if (uri !== undefined && uri.length > 0) {
        void Image.prefetch(uri);
      }
    });
  }, []);

  const livingRoomAcDevice = useMemo<HomeDevice>(() => {
    if (deviceState === null) {
      return livingRoomAcFallback;
    }

    return {
      ...livingRoomAcFallback,
      powered: deviceState.ac.power,
    };
  }, [deviceState]);

  const devices = useMemo(
    () => [livingRoomAcDevice, ...sceneDevices],
    [livingRoomAcDevice, sceneDevices],
  );

  const triggerPressHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleOpenScene = useCallback(
    (sceneId: string) => {
      triggerPressHaptic();
      navigation.navigate("SceneDetail", { sceneId });
    },
    [navigation, triggerPressHaptic],
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
      >
        <View style={styles.header}>
          <Text style={styles.title}>Scenes</Text>
          <View style={styles.headerMenuButton}>
            <Ellipsis color={theme.text} size={20} strokeWidth={2.2} />
          </View>
        </View>

        <View style={styles.grid}>
          {scenes.map((scene) => {
            const sceneDevicesForCard = devices.filter(
              (device) => device.sceneId === scene.id,
            );
            const uniqueTypes = sceneDevicesForCard.reduce<HomeDeviceType[]>(
              (types, device) => {
                if (!types.includes(device.type)) {
                  types.push(device.type);
                }

                return types;
              },
              [],
            );
            const banner = bannerBySceneId[scene.id];
            const SceneIcon = sceneIconById[scene.icon];

            return (
              <TouchableOpacity
                activeOpacity={0.84}
                accessibilityRole="button"
                key={scene.id}
                onPress={() => handleOpenScene(scene.id)}
                style={styles.card}
              >
                {banner !== undefined ? (
                  <Image
                    accessibilityIgnoresInvertColors
                    resizeMode="cover"
                    source={banner}
                    style={styles.cardImage}
                  />
                ) : (
                  <GradientView
                    colors={theme.gradients.panel}
                    end={{ x: 0.86, y: 1 }}
                    start={{ x: 0.14, y: 0 }}
                    style={[styles.cardImage, styles.cardImageFallback]}
                  >
                    <SceneIcon color={theme.accent} size={36} strokeWidth={1.7} />
                  </GradientView>
                )}

                <Text numberOfLines={1} style={styles.cardName}>
                  {scene.name}
                </Text>

                <View style={styles.iconRow}>
                  {uniqueTypes.map((type) => {
                    const DeviceIcon = iconByDeviceType[type];

                    return (
                      <DeviceIcon
                        color={theme.accentSolid}
                        key={`${scene.id}-${type}`}
                        size={18}
                        strokeWidth={2.2}
                      />
                    );
                  })}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View pointerEvents="none" style={styles.preloadLayer}>
        {sceneBannerSources.map((banner, index) => (
          <Image
            accessibilityIgnoresInvertColors
            key={index}
            source={banner}
            style={styles.preloadedImage}
          />
        ))}
      </View>
    </ScreenView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: BOTTOM_NAV_CLEARANCE + theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xl,
    width: "100%",
  },
  title: {
    color: theme.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
  },
  headerMenuButton: {
    alignItems: "center",
    backgroundColor: theme.surfaceLow,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.surfaceLow,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: theme.radiusLarge,
    borderWidth: 1,
    padding: theme.spacing.sm,
    width: "48.2%",
  },
  cardImage: {
    borderRadius: theme.radiusMedium,
    height: 118,
    width: "100%",
  },
  cardImageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardName: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
  iconRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    paddingTop: theme.spacing.md,
  },
  preloadLayer: {
    height: 1,
    opacity: 0,
    position: "absolute",
    width: 1,
  },
  preloadedImage: {
    height: 1,
    width: 1,
  },
});
