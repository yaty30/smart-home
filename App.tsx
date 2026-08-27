import {
  DarkTheme,
  NavigationContainer,
  useFocusEffect,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
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
import { theme } from "./src/theme/theme";
import { RoomsProvider } from "./src/store/rooms";
import { DevicesProvider } from "./src/store/devices";
import { ControllersProvider } from "./src/store/controllers";

const NAV_HIDE_ANIMATION_MS = 220;
const SCREEN_SLIDE_ANIMATION_MS = 100;

const Stack = createNativeStackNavigator<RootStackParamList>();

type MainTabKey = Extract<BottomNavTab, "home" | "rooms" | "settings">;

const tabIndexByKey: Record<MainTabKey, number> = {
  home: 0,
  rooms: 1,
  settings: 2,
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
  return (
    <NavigationContainer theme={navigationTheme}>
      <AppStack />
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
      <RoomsProvider>
        <ControllersProvider>
          <DevicesProvider>
            <AppContent />
          </DevicesProvider>
        </ControllersProvider>
      </RoomsProvider>
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
});
