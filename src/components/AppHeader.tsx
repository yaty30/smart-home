import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../theme/theme";

type AppHeaderProps = {
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  title: string;
};

type HeaderIconButtonProps = {
  accessibilityLabel: string;
  children: ReactNode;
  framed?: boolean;
  onPress: () => void;
};

const HEADER_TOP_PADDING = 72;
const ACTION_SLOT_WIDTH = 62;

export function AppHeader({ leftAction, rightAction, title }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.actionSlot}>{leftAction}</View>
      <View pointerEvents="none" style={styles.titleGroup}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      </View>
      <View style={styles.actionSlot}>{rightAction}</View>
    </View>
  );
}

export function HeaderIconButton({
  accessibilityLabel,
  children,
  framed = false,
  onPress,
}: HeaderIconButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        framed && styles.iconButtonFramed,
        framed && pressed && styles.iconButtonFramedPressed,
        !framed && pressed && styles.iconButtonPressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 60,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: HEADER_TOP_PADDING,
  },
  actionSlot: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: ACTION_SLOT_WIDTH,
  },
  titleGroup: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: ACTION_SLOT_WIDTH + theme.spacing.lg,
    position: "absolute",
    right: ACTION_SLOT_WIDTH + theme.spacing.lg,
    top: HEADER_TOP_PADDING,
  },
  title: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 50,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  iconButtonPressed: {
    backgroundColor: theme.accentSubtle,
  },
  iconButtonFramed: {
    // backgroundColor: theme.surfaceWarm,
    // borderColor: theme.border,
    // borderWidth: 1,
  },
  iconButtonFramedPressed: {
    // backgroundColor: theme.accentMuted,
    // borderColor: theme.borderActive,
    opacity: 0.4
  },
});
