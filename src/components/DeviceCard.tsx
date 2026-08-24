import { AirVent, Power, PowerOff, Trash2 } from "lucide-react-native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useDeviceConnection } from "../context/DeviceConnectionContext";
import { theme } from "../theme/theme";
import type { HomeDevice } from "../types/home";

const iconByDeviceType = {
  ac: AirVent,
};

const formatAcMode = (mode: string) => {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
};

type DeviceCardProps = {
  device: HomeDevice;
  sceneName?: string;
  isDeleteVisible: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onTogglePower: () => void;
  onRequestDelete: () => void;
};

/** Long press for 2 seconds to reveal a floating delete button next to a card. */
export const DEVICE_CARD_LONG_PRESS_MS = 2000;

export function DeviceCard({
  device,
  isDeleteVisible,
  onLongPress,
  onPress,
  onRequestDelete,
  onTogglePower,
  sceneName,
}: DeviceCardProps) {
  const { getRuntime } = useDeviceConnection();
  const { state, status } = getRuntime(device.id);
  const Icon = iconByDeviceType[device.type];
  const powered = state?.ac.power ?? false;
  const PowerIcon = powered ? PowerOff : Power;
  const statusText =
    state === null
      ? status === "connecting"
        ? "Connecting..."
        : "Offline"
      : powered
        ? `${state.ac.temperature}°C · ${formatAcMode(state.ac.mode)}`
        : "Off";

  return (
    <View style={styles.cardWrap}>
      <TouchableOpacity
        activeOpacity={0.82}
        accessibilityRole="button"
        delayLongPress={DEVICE_CARD_LONG_PRESS_MS}
        onLongPress={onLongPress}
        onPress={onPress}
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
            accessibilityState={{ checked: powered, disabled: state === null }}
            disabled={state === null}
            onPress={(event) => {
              event.stopPropagation();
              onTogglePower();
            }}
            style={[
              styles.devicePowerButton,
              powered
                ? styles.devicePowerButtonShutdown
                : styles.devicePowerButtonOn,
              state === null && styles.devicePowerButtonDisabled,
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
        {sceneName !== undefined ? (
          <Text style={styles.deviceScene}>{sceneName}</Text>
        ) : null}
        <Text style={[styles.deviceStatus, powered && styles.deviceStatusOn]}>
          {statusText}
        </Text>
      </TouchableOpacity>

      {isDeleteVisible ? (
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityLabel={`Delete ${device.name}`}
          accessibilityRole="button"
          onPress={onRequestDelete}
          style={styles.floatingDelete}
        >
          <Trash2 color={theme.powerAccent} size={18} strokeWidth={2.5} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    position: "relative",
    width: "48.2%",
  },
  deviceCard: {
    backgroundColor: theme.surfaceLow,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 174,
    padding: theme.spacing.md,
    width: "100%",
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
  devicePowerButtonDisabled: {
    opacity: 0.45,
  },
  deviceName: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 19,
  },
  deviceScene: {
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
  floatingDelete: {
    alignItems: "center",
    backgroundColor: theme.powerAccentMuted,
    borderColor: theme.powerAccent,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    elevation: 6,
    height: 40,
    justifyContent: "center",
    position: "absolute",
    right: -10,
    shadowColor: "#000000",
    shadowOffset: {
      height: 6,
      width: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    top: -12,
    width: 40,
    zIndex: 20,
  },
});
