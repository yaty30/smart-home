import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DeviceConnectionProvider } from "./src/context/DeviceConnectionContext";
import { HomeDataProvider, useHomeData } from "./src/context/HomeDataContext";
import type { RootStackParamList } from "./src/navigation/types";
import { AirConditionerScreen } from "./src/screens/AirConditionerScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { NewDeviceSheet } from "./src/screens/NewDeviceSheet";
import { NewSceneSheet } from "./src/screens/NewSceneSheet";
import { SceneScreen } from "./src/screens/SceneScreen";
import { theme } from "./src/theme/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

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

function RootStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: theme.root },
        headerShown: false,
      }}
    >
      <Stack.Screen component={HomeScreen} name="Home" />
      <Stack.Screen component={SceneScreen} name="Scene" />
      <Stack.Screen component={AirConditionerScreen} name="AirConditioner" />
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
  const { isLoading } = useHomeData();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={theme.accentBright} size="large" />
          <Text style={styles.loadingText}>Loading your home...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <DeviceConnectionProvider>
      <NavigationContainer theme={navigationTheme}>
        <RootStack />
      </NavigationContainer>
    </DeviceConnectionProvider>
  );
}

export default function App() {
  return (
    <>
      <StatusBar
        backgroundColor={theme.root}
        barStyle="light-content"
        translucent={false}
      />
      <HomeDataProvider>
        <StartupGate />
      </HomeDataProvider>
    </>
  );
}

const styles = StyleSheet.create({
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
