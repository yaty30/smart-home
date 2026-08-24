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

import {
  DeviceConnectionProvider,
  useDeviceConnection,
} from "./src/context/DeviceConnectionContext";
import { HomeDataProvider } from "./src/context/HomeDataContext";
import type { RootStackParamList } from "./src/navigation/types";
import { AirConditionerScreen } from "./src/screens/AirConditionerScreen";
import { ConnectDeviceScreen } from "./src/screens/ConnectDeviceScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { NewDeviceSheet } from "./src/screens/NewDeviceSheet";
import { NewSceneSheet } from "./src/screens/NewSceneSheet";
import { theme } from "./src/theme/theme";

const DEBUG_MODE = true;

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

function PairedStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: theme.root },
        headerShown: false,
      }}
    >
      <Stack.Screen component={HomeScreen} name="Home" />
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
    <>
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
