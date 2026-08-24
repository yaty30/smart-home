import type { PropsWithChildren } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { theme } from "../theme/theme";

const TOP_SAFE_PADDING = Platform.OS === "ios" ? 52 : 24;
export const SCREEN_BOTTOM_SAFE_PADDING = Platform.OS === "ios" ? 34 : 24;

export function ScreenView({ children }: PropsWithChildren) {
  return <View style={styles.screen}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.root,
    flex: 1,
    paddingTop: TOP_SAFE_PADDING,
  },
});
