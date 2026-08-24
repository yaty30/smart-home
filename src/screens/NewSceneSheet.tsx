import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { AppButton } from "../components/AppButton";
import { sceneIconById, sceneIconOptions } from "../components/sceneIcons";
import { useHomeData } from "../context/HomeDataContext";
import type { RootStackScreenProps } from "../navigation/types";
import { theme } from "../theme/theme";
import type { SceneIconId } from "../types/home";

export function NewSceneSheet({ navigation }: RootStackScreenProps<"NewScene">) {
  const { addScene } = useHomeData();
  const [sceneName, setSceneName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<SceneIconId>("sofa");

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSave = useCallback(() => {
    const trimmedName = sceneName.trim();

    if (trimmedName.length === 0) {
      return;
    }

    addScene(trimmedName, selectedIcon);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  }, [addScene, navigation, sceneName, selectedIcon]);

  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>New Scene</Text>
        <TouchableOpacity
          activeOpacity={0.76}
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={handleClose}
          style={styles.closeButton}
        >
          <X color={theme.textSecondary} size={20} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <Text style={styles.fieldLabel}>Name</Text>
      <TextInput
        autoFocus
        onChangeText={setSceneName}
        placeholder="e.g. Dining Room"
        placeholderTextColor={theme.textMuted}
        returnKeyType="done"
        selectionColor={theme.accent}
        style={styles.textInput}
        value={sceneName}
      />

      <Text style={styles.fieldLabel}>Icon</Text>
      <View style={styles.iconGrid}>
        {sceneIconOptions.map((option) => {
          const Icon = sceneIconById[option.id];
          const selected = selectedIcon === option.id;

          return (
            <TouchableOpacity
              activeOpacity={0.78}
              accessibilityLabel={option.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.id}
              onPress={() => setSelectedIcon(option.id)}
              style={[styles.iconCell, selected && styles.iconCellSelected]}
            >
              <Icon
                color={selected ? theme.accent : theme.textSecondary}
                size={24}
                strokeWidth={2.2}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      <AppButton
        disabled={sceneName.trim().length === 0}
        label="Create Scene"
        onPress={handleSave}
        style={styles.saveButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.lg,
  },
  sheetTitle: {
    color: theme.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: theme.surfaceLow,
    borderColor: theme.border,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  fieldLabel: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
    marginBottom: theme.spacing.sm,
    textTransform: "uppercase",
  },
  textInput: {
    backgroundColor: theme.surfaceLow,
    borderColor: theme.border,
    borderRadius: 18,
    borderWidth: 1,
    color: theme.text,
    fontSize: theme.typography.body,
    fontWeight: "700",
    marginBottom: theme.spacing.lg,
    minHeight: 54,
    paddingHorizontal: theme.spacing.md,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  iconCell: {
    alignItems: "center",
    backgroundColor: theme.surfaceLow,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 18,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  iconCellSelected: {
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
  },
  saveButton: {
    alignSelf: "stretch",
  },
});
