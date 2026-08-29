import { StyleSheet } from "react-native";

import type { Theme } from "../../theme/theme";

// Chrome shared by the schedule list sheet and the schedule editor sheet.
export const createSheetChromeStyles = (theme: Theme) =>
  StyleSheet.create({
    modalRoot: {
      flex: 1,
    },
    backdrop: {
      backgroundColor: theme.overlays.modalBackdrop,
    },
    kavFill: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: theme.paperBackground,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      height: "90%",
      maxHeight: "92%",
      shadowColor: theme.shadows.color,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 16,
    },
    safeArea: {
      flex: 1,
    },
    handleArea: {
      alignItems: "center",
      height: 28,
      justifyContent: "center",
    },
    handle: {
      backgroundColor: theme.border,
      borderRadius: 3,
      height: 4,
      width: 40,
    },
    contentOuter: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 24,
      paddingHorizontal: 20,
      gap: theme.spacing.lg,
    },
    footer: {
      borderTopColor: theme.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      padding: 16,
    },
  });
