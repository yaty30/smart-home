import {
  DarkTheme,
  NavigationContainer,
  useFocusEffect,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  type LayoutChangeEvent,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BottomNav, type BottomNavTab } from "./src/components/BottomNav";
import {
  DeviceConnectionProvider,
  useDeviceConnection,
} from "./src/context/DeviceConnectionContext";
import { HomeDataProvider } from "./src/context/HomeDataContext";
import type {
  RootStackParamList,
  RootStackScreenProps,
} from "./src/navigation/types";
import { AirConditionerScreen } from "./src/screens/AirConditionerScreen";
import { ConnectDeviceScreen } from "./src/screens/ConnectDeviceScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { NewDeviceSheet } from "./src/screens/NewDeviceSheet";
import { NewSceneSheet } from "./src/screens/NewSceneSheet";
import { SceneDetailScreen } from "./src/screens/SceneDetailScreen";
import { ScenesScreen } from "./src/screens/ScenesScreen";
import { theme } from "./src/theme/theme";

const DEBUG_MODE = true;
const NAV_HIDE_ANIMATION_MS = 220;
const SCREEN_SLIDE_ANIMATION_MS = 260;

const Stack = createNativeStackNavigator<RootStackParamList>();

type MainTabKey = Extract<BottomNavTab, "home" | "scenes">;

const tabIndexByKey: Record<MainTabKey, number> = {
  home: 0,
  scenes: 1,
};

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.root,
    border: theme.border,
    card: theme.root,
    primary: theme.accent,
    text: theme.text,
  },
};

function MainNavigator({ navigation }: RootStackScreenProps<"Main">) {
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
    () => ({
      ...navigation,
      navigate: (...args: unknown[]) => {
        const [routeName] = args;

        if (routeName === "Home") {
          switchTab("home");
          return;
        }

        if (routeName === "Scenes") {
          switchTab("scenes");
          return;
        }

        navigateAway(...args);
      },
    }),
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
            width: screenWidth * 2,
          },
        ]}
      >
        <View style={[styles.tabPage, { width: screenWidth }]}>
          <HomeScreen
            navigation={mainNavigation}
            onScrollDirectionChange={(direction) =>
              setNavCompact(direction === "down")
            }
          />
        </View>
        <View style={[styles.tabPage, { width: screenWidth }]}>
          <ScenesScreen
            navigation={mainNavigation}
            onScrollDirectionChange={(direction) =>
              setNavCompact(direction === "down")
            }
          />
        </View>
      </Animated.View>

      <BottomNav
        active={activeTab}
        compact={navCompact}
        onHomePress={() => switchTab("home")}
        onScenesPress={() => switchTab("scenes")}
        visible={navVisible}
      />
    </View>
  );
}

function PairedStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: theme.root },
        headerShown: false,
      }}
    >
      <Stack.Screen component={MainNavigator} name="Main" />
      <Stack.Screen component={SceneDetailScreen} name="SceneDetail" />
      <Stack.Screen name="AirConditioner">
        {({ navigation }) => (
          <AirConditionerScreen onBackPress={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Group
        screenOptions={{
          contentStyle: { backgroundColor: theme.paperBackground },
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetCornerRadius: 28,
          sheetGrabberVisible: true,
        }}
      >
        <Stack.Screen component={NewSceneSheet} name="NewScene" />
        <Stack.Screen component={NewDeviceSheet} name="NewDevice" />
      </Stack.Group>
    </Stack.Navigator>
  );
}

function StartupGate() {
  const { isLoading, isPaired } = useDeviceConnection();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={theme.accentBright} size="large" />
          <Text style={styles.loadingText}>Checking device connection...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isPaired) {
    return <ConnectDeviceScreen />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <PairedStack />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <View style={styles.appRoot}>
      <StatusBar
        backgroundColor={theme.root}
        barStyle="light-content"
        translucent={false}
      />
      <DeviceConnectionProvider debugMode={DEBUG_MODE}>
        <HomeDataProvider>
          <StartupGate />
        </HomeDataProvider>
      </DeviceConnectionProvider>
    </View>
  );
}

const styles = StyleSheet.create({
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
  safeArea: {
    backgroundColor: theme.root,
    flex: 1,
  },
  loadingScreen: {
    alignItems: "center",
    backgroundColor: theme.root,
    flex: 1,
    gap: theme.spacing.lg,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  loadingText: {
    color: theme.textSecondary,
    fontSize: theme.typography.body,
    fontWeight: "700",
    letterSpacing: 0,
    textAlign: "center",
  },
});
