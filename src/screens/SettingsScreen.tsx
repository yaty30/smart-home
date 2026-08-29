import { Moon, Settings as SettingsIcon, Sun } from "lucide-react-native";
import { useMemo } from "react";
import {
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { AppHeader } from "../components/AppHeader";
import { type Theme, useTheme, useThemeMode } from "../theme/theme";
import type { RootStackScreenProps } from "../navigation/types";

type SettingsScreenProps = {
  navigation: RootStackScreenProps<"Main">["navigation"];
};

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const theme = useTheme();
  const { isLight, toggleTheme } = useThemeMode();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.screen}>
      <AppHeader title="Settings" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <TouchableOpacity
          activeOpacity={0.84}
          accessibilityRole="button"
          accessibilityLabel="Controllers"
          onPress={() => navigation.navigate("Controllers")}
          style={styles.settingCard}
        >
          <View style={styles.settingIcon}>
            <SettingsIcon color={theme.accent} size={22} strokeWidth={2.2} />
          </View>
          <View style={styles.settingInfo}>
            <Text style={styles.settingName}>Controllers</Text>
            <Text style={styles.settingDescription}>
              Manage ESP32 controllers
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.settingCard}>
          <View style={styles.settingIcon}>
            {isLight ? (
              <Sun color={theme.accent} size={22} strokeWidth={2.2} />
            ) : (
              <Moon color={theme.accent} size={22} strokeWidth={2.2} />
            )}
          </View>
          <View style={styles.settingInfo}>
            <Text style={styles.settingName}>Light Theme</Text>
            <Text style={styles.settingDescription}>
              {isLight ? "Light appearance enabled" : "Use a brighter appearance"}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Toggle light theme"
            ios_backgroundColor={theme.controlBackground}
            onValueChange={toggleTheme}
            thumbColor={isLight ? theme.accent : theme.textSecondary}
            trackColor={{
              false: theme.controlBackgroundPressed,
              true: theme.accentMuted,
            }}
            value={isLight}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    backgroundColor: theme.root,
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: 120,
    gap: theme.spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  settingCard: {
    alignItems: "center",
    backgroundColor: theme.surfaceWarm,
    borderColor: theme.border,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  settingIcon: {
    alignItems: "center",
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
    borderRadius: 15,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  settingInfo: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  settingName: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0,
  },
  settingDescription: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
  },
});
