import * as Haptics from "expo-haptics";
import { ChevronLeft, EllipsisVertical, Plus } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { AppButton } from "../components/AppButton";
import { DeviceCard } from "../components/DeviceCard";
import {
  SCREEN_BOTTOM_SAFE_PADDING,
  ScreenView,
} from "../components/ScreenView";
import { sceneIconById } from "../components/sceneIcons";
import { useDeviceConnection } from "../context/DeviceConnectionContext";
import { useHomeData } from "../context/HomeDataContext";
import type { RootStackScreenProps } from "../navigation/types";
import { theme } from "../theme/theme";
import type { HomeDevice } from "../types/home";

export function SceneScreen({
  navigation,
  route,
}: RootStackScreenProps<"Scene">) {
  const { sceneId } = route.params;
  const { devices, removeDevice, removeScene, renameScene, scenes } =
    useHomeData();
  const { getRuntime, sendAcCommand, updateAcState } = useDeviceConnection();
  const scene = scenes.find((currentScene) => currentScene.id === sceneId);
  const [deleteVisibleId, setDeleteVisibleId] = useState<string | null>(null);
  const [isRenameVisible, setIsRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState(scene?.name ?? "");

  const sceneDevices = useMemo(
    () => devices.filter((device) => device.sceneId === sceneId),
    [devices, sceneId],
  );

  // The scene may be deleted from another surface while this screen is open.
  useEffect(() => {
    if (scene === undefined) {
      navigation.goBack();
    }
  }, [navigation, scene]);

  const triggerPressHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleTogglePower = useCallback(
    (device: HomeDevice) => {
      const { state } = getRuntime(device.id);

      if (state === null) {
        return;
      }

      triggerPressHaptic();
      const nextPower = !state.ac.power;
      updateAcState(device.id, { power: nextPower });
      void sendAcCommand(device.id, { power: nextPower ? "on" : "off" });
    },
    [getRuntime, sendAcCommand, triggerPressHaptic, updateAcState],
  );

  const handleOpenDevice = useCallback(
    (device: HomeDevice) => {
      setDeleteVisibleId(null);
      triggerPressHaptic();
      navigation.navigate("AirConditioner", { deviceId: device.id });
    },
    [navigation, triggerPressHaptic],
  );

  const handleRevealDelete = useCallback(
    (device: HomeDevice) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setDeleteVisibleId(device.id);
    },
    [],
  );

  const handleRequestDeleteDevice = useCallback(
    (device: HomeDevice) => {
      Alert.alert(
        `Delete ${device.name}?`,
        "This device will be removed from your home. This action cannot be undone.",
        [
          {
            onPress: () => setDeleteVisibleId(null),
            style: "cancel",
            text: "Cancel",
          },
          {
            onPress: () => {
              removeDevice(device.id);
              setDeleteVisibleId(null);
            },
            style: "destructive",
            text: "Delete",
          },
        ],
      );
    },
    [removeDevice],
  );

  const handleConfirmDeleteScene = useCallback(() => {
    if (scenes.length <= 1) {
      Alert.alert(
        "Can't delete this scene",
        "You need at least one scene. Create another scene before deleting this one.",
      );
      return;
    }

    Alert.alert(
      `Delete ${scene?.name ?? "scene"}?`,
      "All devices in this scene will be removed. This action cannot be undone.",
      [
        { style: "cancel", text: "Cancel" },
        {
          // Removing the scene clears `scene`, and the guard effect pops the
          // screen — avoids a double goBack if we also popped here.
          onPress: () => removeScene(sceneId),
          style: "destructive",
          text: "Delete Scene",
        },
      ],
    );
  }, [removeScene, scene?.name, sceneId, scenes.length]);

  const handleOpenRename = useCallback(() => {
    setRenameValue(scene?.name ?? "");
    setIsRenameVisible(true);
  }, [scene?.name]);

  const handleSaveRename = useCallback(() => {
    const trimmedName = renameValue.trim();

    if (trimmedName.length === 0) {
      return;
    }

    renameScene(sceneId, trimmedName);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsRenameVisible(false);
  }, [renameScene, renameValue, sceneId]);

  const handleOpenMenu = useCallback(() => {
    triggerPressHaptic();

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
          options: ["Cancel", "Rename Scene", "Delete Scene"],
          userInterfaceStyle: "dark",
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleOpenRename();
          } else if (buttonIndex === 2) {
            handleConfirmDeleteScene();
          }
        },
      );
      return;
    }

    Alert.alert(scene?.name ?? "Scene", undefined, [
      { onPress: handleOpenRename, text: "Rename Scene" },
      {
        onPress: handleConfirmDeleteScene,
        style: "destructive",
        text: "Delete Scene",
      },
      { style: "cancel", text: "Cancel" },
    ]);
  }, [handleConfirmDeleteScene, handleOpenRename, scene?.name, triggerPressHaptic]);

  if (scene === undefined) {
    return <ScreenView />;
  }

  const SceneIcon = sceneIconById[scene.icon];

  return (
    <ScreenView>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        onScrollBeginDrag={() => setDeleteVisibleId(null)}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.72}
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={() => {
              triggerPressHaptic();
              navigation.goBack();
            }}
            style={styles.headerIconButton}
          >
            <ChevronLeft color={theme.accent} size={24} strokeWidth={2.4} />
          </TouchableOpacity>

          <View style={styles.headerTitleGroup}>
            <View style={styles.sceneIconFrame}>
              <SceneIcon color={theme.accent} size={18} strokeWidth={2.3} />
            </View>
            <Text numberOfLines={1} style={styles.title}>
              {scene.name}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.72}
            accessibilityLabel="Scene options"
            accessibilityRole="button"
            onPress={handleOpenMenu}
            style={styles.headerIconButton}
          >
            <EllipsisVertical color={theme.accent} size={22} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Devices</Text>
          <TouchableOpacity
            activeOpacity={0.76}
            accessibilityRole="button"
            onPress={() => navigation.navigate("NewDevice", { sceneId })}
            style={styles.addButton}
          >
            <Plus color={theme.accent} size={15} strokeWidth={2.8} />
            <Text style={styles.linkText}>Add</Text>
          </TouchableOpacity>
        </View>

        {sceneDevices.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No devices in this scene</Text>
            <Text style={styles.emptyText}>
              Add a device and assign it to {scene.name}.
            </Text>
            <AppButton
              label="Add Device"
              onPress={() => navigation.navigate("NewDevice", { sceneId })}
              vibe="strong"
            />
          </View>
        ) : (
          <View style={styles.deviceGrid}>
            {sceneDevices.map((device) => (
              <DeviceCard
                device={device}
                isDeleteVisible={deleteVisibleId === device.id}
                key={device.id}
                onLongPress={() => handleRevealDelete(device)}
                onPress={() => handleOpenDevice(device)}
                onRequestDelete={() => handleRequestDeleteDevice(device)}
                onTogglePower={() => handleTogglePower(device)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsRenameVisible(false)}
        transparent
        visible={isRenameVisible}
      >
        <Pressable
          onPress={() => setIsRenameVisible(false)}
          style={styles.modalBackdrop}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={styles.modalCard}
          >
            <Text style={styles.modalTitle}>Rename Scene</Text>
            <TextInput
              autoFocus
              onChangeText={setRenameValue}
              onSubmitEditing={handleSaveRename}
              placeholder="Scene name"
              placeholderTextColor={theme.textMuted}
              returnKeyType="done"
              selectionColor={theme.accent}
              style={styles.textInput}
              value={renameValue}
            />
            <View style={styles.modalActions}>
              <AppButton
                label="Cancel"
                onPress={() => setIsRenameVisible(false)}
                style={styles.modalButton}
                variant="secondary"
              />
              <AppButton
                disabled={renameValue.trim().length === 0}
                label="Save"
                onPress={handleSaveRename}
                style={styles.modalButton}
                vibe="strong"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: SCREEN_BOTTOM_SAFE_PADDING + theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "space-between",
    marginBottom: theme.spacing.xl,
  },
  headerIconButton: {
    alignItems: "center",
    backgroundColor: theme.surfaceLow,
    borderColor: theme.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  headerTitleGroup: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
  },
  sceneIconFrame: {
    alignItems: "center",
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
    borderRadius: 12,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  title: {
    color: theme.text,
    flexShrink: 1,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 0,
  },
  addButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  linkText: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: theme.surfaceLow,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 24,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  emptyTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0,
  },
  emptyText: {
    color: theme.textSecondary,
    fontSize: theme.typography.label,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 21,
    textAlign: "center",
  },
  deviceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  modalCard: {
    backgroundColor: theme.paperBackground,
    borderColor: theme.borderStrong,
    borderRadius: 24,
    borderWidth: 1,
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
    width: "100%",
  },
  modalTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0,
  },
  textInput: {
    backgroundColor: theme.surfaceLow,
    borderColor: theme.border,
    borderRadius: 18,
    borderWidth: 1,
    color: theme.text,
    fontSize: theme.typography.body,
    fontWeight: "700",
    minHeight: 54,
    paddingHorizontal: theme.spacing.md,
  },
  modalActions: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  modalButton: {
    flex: 1,
  },
});
