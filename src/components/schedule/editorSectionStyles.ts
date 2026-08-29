import { StyleSheet } from "react-native";

import type { Theme } from "../../theme/theme";

// Section heading + selectable-pill styles shared by the editor's sections.
export const createEditorSectionStyles = (theme: Theme) =>
  StyleSheet.create({
    sectionTitleGroup: {
      flex: 1,
      gap: 4,
      minWidth: 0,
      flexDirection: "row",
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "800",
    },
    pillRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    pill: {
      alignItems: "center",
      backgroundColor: theme.surfaceLow,
      borderColor: theme.accentMuted,
      borderRadius: theme.radiusRound,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 8,
      paddingVertical: 12,
    },
    pillSelected: {
      borderColor: theme.accentSolid,
    },
    pillText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
      textAlign: "center",
    },
    pillTextSelected: {
      color: theme.accentStrong,
    },
  });
