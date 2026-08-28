import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  useFocusEffect,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  type AppStateStatus,
  type LayoutChangeEvent,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";

import { BottomNav, type BottomNavTab } from "./src/components/BottomNav";
import type {
  RootStackParamList,
  RootStackScreenProps,
} from "./src/navigation/types";
import { HomeScreen } from "./src/screens/HomeScreen";
import { RoomsScreen } from "./src/screens/RoomsScreen";
import { RoomDetailScreen } from "./src/screens/RoomDetailScreen";
import { DeviceControlScreen } from "./src/screens/DeviceControlScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { ControllersScreen } from "./src/screens/ControllersScreen";
import { PairControllerScreen } from "./src/screens/PairControllerScreen";
import {
  ThemeProvider,
  type Theme,
  useTheme,
  useThemeMode,
} from "./src/theme/theme";
import { RoomsProvider } from "./src/store/rooms";
import { DevicesProvider, useDevices } from "./src/store/devices";
import { ControllersProvider, useControllers } from "./src/store/controllers";
import { fetchControllerStatus } from "./src/services/controllerStatusService";
import { isDebugMode } from "./src/config/debug";

const NAV_HIDE_ANIMATION_MS = 220;
const SCREEN_SLIDE_ANIMATION_MS = 100;
const STATUS_REFRESH_DEDUP_MS = 1000;
const STATUS_POLL_INTERVAL_MS = 3000;

const Stack = createNativeStackNavigator<RootStackParamList>();

type MainTabKey = Extract<BottomNavTab, "home" | "rooms" | "settings">;

const tabIndexByKey: Record<MainTabKey, number> = {
  home: 0,
  rooms: 1,
  settings: 2,
};

function MainNavigator({ navigation }: RootStackScreenProps<"Main">) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [activeTab, setActiveTab] = useState<MainTabKey>("home");
  const [navCompact, setNavCompact] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const [screenWidth, setScreenWidth] = useState(0);
  const slideProgress = useRef(new Animated.Value(tabIndexByKey.home)).current;
  const pendingNavigationTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (pendingNavigationTimeout.current !== null) {
        clearTimeout(pendingNavigationTimeout.current);
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setNavVisible(true);
      setNavCompact(false);
    }, []),
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setScreenWidth(event.nativeEvent.layout.width);
  }, []);

  const switchTab = useCallback(
    (nextTab: MainTabKey) => {
      setActiveTab(nextTab);
      setNavCompact(false);
      Animated.timing(slideProgress, {
        duration: SCREEN_SLIDE_ANIMATION_MS,
        toValue: tabIndexByKey[nextTab],
        useNativeDriver: true,
      }).start();
    },
    [slideProgress],
  );

  const navigateAway = useCallback(
    (...args: unknown[]) => {
      if (pendingNavigationTimeout.current !== null) {
        clearTimeout(pendingNavigationTimeout.current);
      }

      setNavVisible(false);
      setNavCompact(false);
      pendingNavigationTimeout.current = setTimeout(() => {
        pendingNavigationTimeout.current = null;
        (navigation.navigate as (...navigateArgs: unknown[]) => void)(...args);
      }, NAV_HIDE_ANIMATION_MS);
    },
    [navigation],
  );

  const mainNavigation = useMemo(
    () =>
      ({
        ...navigation,
        navigate: (...args: unknown[]) => {
          const [routeName] = args;

          if (routeName === "Home") {
            switchTab("home");
            return;
          }

          if (routeName === "Rooms") {
            switchTab("rooms");
            return;
          }

          navigateAway(...args);
        },
      }) as typeof navigation,
    [navigateAway, navigation, switchTab],
  );

  const translateX = Animated.multiply(slideProgress, -screenWidth);

  return (
    <View onLayout={handleLayout} style={styles.mainNavigator}>
      <Animated.View
        style={[
          styles.tabTrack,
          {
            transform: [{ translateX }],
            width: screenWidth * 3,
          },
        ]}
      >
        <View style={[styles.tabPage, { width: screenWidth }]}>
          <HomeScreen navigation={mainNavigation} />
        </View>
        <View style={[styles.tabPage, { width: screenWidth }]}>
          <RoomsScreen navigation={mainNavigation} />
        </View>
        <View style={[styles.tabPage, { width: screenWidth }]}>
          <SettingsScreen navigation={mainNavigation} />
        </View>
      </Animated.View>

      <BottomNav
        active={activeTab}
        compact={navCompact}
        onHomePress={() => switchTab("home")}
        onRoomsPress={() => switchTab("rooms")}
        onSettingsPress={() => switchTab("settings")}
        visible={navVisible}
      />
    </View>
  );
}

function AppStack() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: theme.root },
        headerShown: false,
      }}
    >
      <Stack.Screen component={MainNavigator} name="Main" />
      <Stack.Screen component={RoomDetailScreen} name="RoomDetail" />
      <Stack.Screen component={DeviceControlScreen} name="DeviceControl" />
      <Stack.Screen component={ControllersScreen} name="Controllers" />
      <Stack.Screen component={PairControllerScreen} name="PairController" />
    </Stack.Navigator>
  );
}

function AppContent() {
  const theme = useTheme();
  const { mode } = useThemeMode();
  const navigationTheme = useMemo(() => {
    const baseTheme = mode === "light" ? DefaultTheme : DarkTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background: theme.root,
        border: theme.border,
        card: theme.root,
        primary: theme.accent,
        text: theme.text,
      },
    };
  }, [mode, theme]);

  return (
    <NavigationContainer theme={navigationTheme}>
      <AppStack />
    </NavigationContainer>
  );
}

function DeviceStatusSynchronizer() {
  const {
    controllers,
    isLoading: controllersLoading,
    updateControllerConnectionStatus,
  } = useControllers();
  const {
    applyControllerDeviceStatus,
    isLoading: devicesLoading,
    markControllerDevicesOffline,
    markControllerDevicesSyncing,
  } = useDevices();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const controllersRef = useRef(controllers);
  const loadingRef = useRef(controllersLoading || devicesLoading);
  const lastRefreshStartedAt = useRef(0);
  const refreshInFlight = useRef(false);
  const refreshGeneration = useRef(0);

  useEffect(() => {
    controllersRef.current = controllers;
  }, [controllers]);

  useEffect(() => {
    loadingRef.current = controllersLoading || devicesLoading;
  }, [controllersLoading, devicesLoading]);

  const refreshAllControllerStatus = useCallback(() => {
    if (isDebugMode || loadingRef.current || refreshInFlight.current) {
      return;
    }

    const now = Date.now();
    if (now - lastRefreshStartedAt.current < STATUS_REFRESH_DEDUP_MS) {
      return;
    }

    const refreshableControllers = controllersRef.current.filter(
      (controller) => controller.ip.length > 0 && controller.token.length > 0,
    );

    if (refreshableControllers.length === 0) {
      return;
    }

    lastRefreshStartedAt.current = now;
    refreshInFlight.current = true;
    refreshGeneration.current += 1;
    const currentGeneration = refreshGeneration.current;

    const refreshes = refreshableControllers.map(async (controller) => {
      if (
        controller.connectionStatus === undefined ||
        controller.connectionStatus === "unknown"
      ) {
        updateControllerConnectionStatus(controller.id, "connecting");
        markControllerDevicesSyncing(controller.id);
      }

      try {
        const snapshot = await fetchControllerStatus(controller);
        if (currentGeneration !== refreshGeneration.current) {
          return;
        }
        applyControllerDeviceStatus(controller.id, snapshot);
        updateControllerConnectionStatus(controller.id, "online");
      } catch (error) {
        if (currentGeneration !== refreshGeneration.current) {
          throw error;
        }
        markControllerDevicesOffline(controller.id);
        updateControllerConnectionStatus(controller.id, "offline");
        throw error;
      }
    });

    void Promise.allSettled(refreshes).finally(() => {
      if (currentGeneration === refreshGeneration.current) {
        refreshInFlight.current = false;
      }
    });
  }, [
    applyControllerDeviceStatus,
    markControllerDevicesOffline,
    markControllerDevicesSyncing,
    updateControllerConnectionStatus,
  ]);

  const controllerConfigKey = useMemo(
    () =>
      controllers
        .map((controller) => `${controller.id}|${controller.ip}|${controller.token}`)
        .join(";"),
    [controllers],
  );

  useEffect(() => {
    if (!isDebugMode && !controllersLoading && !devicesLoading) {
      refreshAllControllerStatus();
    }
  }, [
    controllerConfigKey,
    controllersLoading,
    devicesLoading,
    refreshAllControllerStatus,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appState.current;
      appState.current = nextState;

      if (nextState === "active" && previousState !== "active") {
        refreshAllControllerStatus();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshAllControllerStatus]);

  useEffect(() => {
    if (isDebugMode || controllersLoading || devicesLoading) {
      return undefined;
    }

    const interval = setInterval(
      refreshAllControllerStatus,
      STATUS_POLL_INTERVAL_MS,
    );

    return () => {
      clearInterval(interval);
    };
  }, [controllersLoading, devicesLoading, refreshAllControllerStatus]);

  return null;
}

function AppRoot() {
  const theme = useTheme();
  const { mode } = useThemeMode();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.appRoot}>
      <StatusBar
        backgroundColor={theme.root}
        barStyle={mode === "light" ? "dark-content" : "light-content"}
        translucent={false}
      />
      <RoomsProvider>
        <ControllersProvider>
          <DevicesProvider>
            <DeviceStatusSynchronizer />
            <AppContent />
          </DevicesProvider>
        </ControllersProvider>
      </RoomsProvider>
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppRoot />
    </ThemeProvider>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  appRoot: {
    backgroundColor: theme.root,
    flex: 1,
  },
  mainNavigator: {
    backgroundColor: theme.root,
    flex: 1,
    overflow: "hidden",
  },
  tabTrack: {
    flex: 1,
    flexDirection: "row",
  },
  tabPage: {
    flex: 1,
  },
});
