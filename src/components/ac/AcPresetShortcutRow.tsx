import { Snowflake } from "lucide-react-native";
import { useMemo } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { MODE_ICONS } from "../../constants/acModes";
import type { DeviceState } from "../../domain/device";
import { type Theme, useTheme } from "../../theme/theme";
import type { AcPreset } from "../../types/acPreset";
import { AcStatePills } from "../AcStatePills";

type AcPresetShortcutRowProps = {
  presets: AcPreset[];
  onDeletePreset: (id: string) => void;
  onPressPreset: (preset: AcPreset) => void;
};

const presetState = (preset: AcPreset): DeviceState => ({
  fanSpeed:
    preset.fanSpeed === "auto" ? "auto" : String(preset.fanSpeed),
  mode: preset.mode,
  power: true,
  powerful: preset.powerful,
  quiet: preset.quiet,
  swingHorizontal: preset.horizontalAirflow,
  swingVertical: preset.verticalAirflow,
  syncStatus: "synced",
  temperature: preset.temperature,
});

export function AcPresetShortcutRow({
  presets,
  onDeletePreset,
  onPressPreset,
}: AcPresetShortcutRowProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const modeIcons = useMemo(() => MODE_ICONS(theme), [theme]);

  if (presets.length === 0) {
    return null;
  }

  const confirmDelete = (preset: AcPreset) => {
    Alert.alert("Delete Preset?", `"${preset.name}" will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => onDeletePreset(preset.id),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        contentContainerStyle={styles.list}
        showsHorizontalScrollIndicator={false}
      >
        {presets.map((preset) => {
          return (
            <TouchableOpacity
              activeOpacity={0.78}
              accessibilityHint="Long press to delete"
              accessibilityLabel={`Apply ${preset.name} preset`}
              accessibilityRole="button"
              key={preset.id}
              onLongPress={() => confirmDelete(preset)}
              onPress={() => onPressPreset(preset)}
              style={styles.card}
            >
              <View style={styles.cardHeader}>
                <View style={styles.titleGroup}>
                  <Text numberOfLines={1} style={styles.name}>
                    {preset.name}
                  </Text>
                </View>
              </View>

              <AcStatePills state={presetState(preset)} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      marginHorizontal: -theme.spacing.lg,
    },
    list: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 2,
    },
    card: {
      backgroundColor: theme.surfaceWarm,
      borderColor: theme.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: theme.spacing.sm,
      minHeight: 85,
      padding: 12,
      width: 194,
    },
    cardHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: theme.spacing.sm,
      justifyContent: "space-between",
      minWidth: 0,
    },
    titleGroup: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: theme.spacing.sm,
      minWidth: 0,
      paddingHorizontal: theme.spacing.xs
    },
    iconBubble: {
      alignItems: "center",
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    name: {
      color: theme.text,
      flex: 1,
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: 0,
    },
    powerBadge: {
      backgroundColor: theme.accentMuted,
      borderColor: theme.borderActive,
      borderRadius: theme.radiusSmall,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    powerBadgeText: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0,
    },
  });
