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
import { ConnectDeviceScreen } from "./src/screens/ConnectDeviceScreen";
import { AirConditionerScreen } from './src/screens/AirConditionerScreen';
import { theme } from './src/theme/theme';

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

  return isPaired ? <AirConditionerScreen /> : <ConnectDeviceScreen />;
}

export default function App() {
  return (
    <>
      <StatusBar
        backgroundColor={theme.root}
        barStyle="light-content"
        translucent={false}
      />
      <DeviceConnectionProvider>
        <StartupGate />
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
