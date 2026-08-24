import { AlertCircle, QrCode, Wifi } from "lucide-react-native";
import { useMemo } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { AppButton } from "../components/AppButton";
import {
  PairingScannerModal,
  usePairingScanner,
} from "../components/PairingScannerModal";
import { theme } from "../theme/theme";

export function ConnectDeviceScreen() {
  const {
    closeScanner,
    isScannerOpen,
    openScanner,
    permission,
    permissionError,
  } = usePairingScanner();

  const permissionMessage = useMemo(() => {
    if (permissionError !== null) {
      return permissionError;
    }

    if (permission === null || permission.granted) {
      return null;
    }

    return "Camera access is required to scan the ESP32 pairing QR code.";
  }, [permission, permissionError]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.deviceMark}>
            <Wifi color={theme.accentBright} size={34} strokeWidth={2.25} />
          </View>

          <View style={styles.copy}>
            <Text style={styles.eyebrow}>Device pairing</Text>
            <Text style={styles.title}>Connect your air conditioner</Text>
            <Text style={styles.body}>
              Scan the QR code shown by your ESP32 controller to pair this app
              with the device.
            </Text>
          </View>

          {permissionMessage !== null ? (
            <View style={styles.inlineNotice}>
              <AlertCircle
                color={theme.accentBright}
                size={18}
                strokeWidth={2.4}
              />
              <Text style={styles.inlineNoticeText}>{permissionMessage}</Text>
            </View>
          ) : null}

          <AppButton
            label="Scan QR Code"
            leftIcon={<QrCode size={22} strokeWidth={2.6} color={theme.accentStrong} />}
            onPress={() => {
              void openScanner();
            }}
            vibe="strong"
          />
        </View>
      </View>

      <PairingScannerModal onClose={closeScanner} visible={isScannerOpen} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.root,
    flex: 1,
  },
  screen: {
    alignItems: "center",
    backgroundColor: theme.root,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  content: {
    alignItems: "center",
    gap: theme.spacing.xl,
    maxWidth: 420,
    width: "100%",
  },
  deviceMark: {
    alignItems: "center",
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 82,
    justifyContent: "center",
    shadowColor: theme.accent,
    shadowOffset: {
      height: 12,
      width: 0,
    },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    width: 82,
  },
  copy: {
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  eyebrow: {
    color: theme.accentBright,
    fontSize: theme.typography.label,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: theme.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
  },
  body: {
    color: theme.textSecondary,
    fontSize: theme.typography.body,
    fontWeight: "500",
    letterSpacing: 0,
    lineHeight: 24,
    textAlign: "center",
  },
  inlineNotice: {
    alignItems: "center",
    backgroundColor: theme.accentSubtle,
    borderColor: theme.borderStrong,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    width: "100%",
  },
  inlineNoticeText: {
    color: theme.textSecondary,
    flex: 1,
    fontSize: theme.typography.label,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 20,
  },
});
