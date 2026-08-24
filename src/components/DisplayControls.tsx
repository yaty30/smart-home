import { Cast, Monitor, QrCode } from "lucide-react-native";
import { StyleSheet, Switch, Text, View } from "react-native";

import { theme } from "../theme/theme";

type DisplayControlsProps = {
  canControlQr: boolean;
  isDisabled?: boolean;
  qrVisible: boolean;
  screenOn: boolean;
  onChangeQrVisible: (visible: boolean) => void;
  onChangeScreenOn: (screenOn: boolean) => void;
};

type DisplayToggleProps = {
  accessibilityLabel: string;
  enabled: boolean;
  icon: typeof Monitor;
  label: string;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
};

function DisplayToggle({
  accessibilityLabel,
  enabled,
  icon: Icon,
  label,
  disabled = false,
  onChange,
}: DisplayToggleProps) {
  return (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      <View style={[styles.iconFrame, enabled && styles.iconFrameActive]}>
        <Icon
          color={enabled ? theme.accent : theme.textSecondary}
          size={21}
          strokeWidth={2.2}
        />
      </View>
      <Text style={[styles.rowLabel, enabled && styles.rowLabelActive]}>
        {label}
      </Text>
      <Switch
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        ios_backgroundColor={theme.controlBackground}
        onValueChange={onChange}
        thumbColor={enabled ? theme.accent : theme.textSecondary}
        trackColor={{
          false: theme.controlBackgroundPressed,
          true: theme.accentMuted,
        }}
        value={enabled}
      />
    </View>
  );
}

export function DisplayControls({
  canControlQr,
  isDisabled = false,
  onChangeQrVisible,
  onChangeScreenOn,
  qrVisible,
  screenOn,
}: DisplayControlsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.title}>
        <Cast color={theme.text} size={18} />
        <Text style={styles.label}>Display</Text>
      </View>
      <DisplayToggle
        accessibilityLabel="Toggle ESP32 screen power"
        disabled={isDisabled}
        enabled={screenOn}
        icon={Monitor}
        label="Screen"
        onChange={onChangeScreenOn}
      />
      {canControlQr ? (
        <>
          <View style={styles.divider} />
          <DisplayToggle
            accessibilityLabel="Toggle pairing QR code visibility"
            disabled={isDisabled}
            enabled={qrVisible}
            icon={QrCode}
            label="Pairing QR"
            onChange={onChangeQrVisible}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
  },
  divider: {
    backgroundColor: theme.border,
    height: 1,
    marginLeft: 52,
  },
  iconFrame: {
    alignItems: "center",
    backgroundColor: theme.controlBackground,
    borderColor: theme.border,
    borderRadius: theme.spacing.sm,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  iconFrameActive: {
    backgroundColor: theme.accentSubtle,
    borderColor: theme.borderActive,
  },
  title: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  label: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    minHeight: 44,
  },
  rowDisabled: {
    opacity: 0.52,
  },
  rowLabel: {
    color: theme.textSecondary,
    flex: 1,
    fontSize: theme.typography.body,
    fontWeight: "700",
    letterSpacing: 0,
  },
  rowLabelActive: {
    color: theme.text,
  },
});
