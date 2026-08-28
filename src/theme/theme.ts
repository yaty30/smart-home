import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  createElement,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const THEME_STORAGE_KEY = "smartHome.themeMode";

export type ThemeMode = "dark" | "light";

export const darkTheme = {
  mode: "dark" as const,
  root: "#050505",
  paperBackground: "#100D0A",
  paperBackgroundElevated: "#18110C",
  surfaceLow: "#0C0A08",
  surfaceWarm: "#21160F",
  surfaceWarmPressed: "#2A1C13",

  accent: "#F0A942",
  accentBright: "#FFC86F",
  accentDeep: "#B97013",
  accentStrong: "#fc773e",
  accentSolid: "#f7792b",
  textOnAccent: "#1A0E05",
  accentMuted: "rgba(240, 169, 66, 0.26)",
  accentSubtle: "rgba(240, 169, 66, 0.16)",
  accentGlow: "rgba(240, 169, 66, 0.42)",
  powerAccent: "#FF6A58",
  powerAccentMuted: "rgba(255, 106, 88, 0.14)",
  powerAccentGlow: "rgba(255, 106, 88, 0.3)",
  quietAccent: "#8B7CFF",
  quietAccentMuted: "rgba(139, 124, 255, 0.2)",
  powerfulAccent: "#FFA500",
  powerfulAccentMuted: "rgba(255, 165, 0, 0.2)",

  text: "#F7F7F8",
  textSecondary: "#B4AEA8",
  textMuted: "#6F6962",

  border: "rgba(240, 169, 66, 0.22)",
  borderStrong: "rgba(240, 169, 66, 0.42)",
  borderActive: "rgba(240, 169, 66, 0.9)",

  controlBackground: "#130F0C",
  controlBackgroundPressed: "#24170E",
  navBar: "#161210",
  gaugeTrack: "rgba(240, 170, 66, 0.12)",
  thumb: "#FFE0A6",
  inactive: "rgba(247, 247, 248, 0.38)",
  scrim: "rgba(5, 5, 5, 0.72)",

  gradients: {
    panel: [
      "rgba(24, 18, 13, 0.94)",
      "rgba(16, 13, 10, 0.96)",
      "rgba(9, 8, 7, 0.98)",
    ],
    button: ["#2C2117", "#181410", "#0E0D0B"],
    buttonPressed: ["#392817", "#1D1610", "#100D0A"],
    danger: [
      "rgba(68, 32, 25, 0.9)",
      "rgba(43, 22, 19, 0.9)",
      "rgba(24, 16, 14, 0.94)",
    ],
  },

  radiusSmall: 12,
  radiusMedium: 20,
  radiusLarge: 28,
  radiusRound: 999,

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 40,
  },

  typography: {
    title: 23,
    body: 16,
    label: 14,
    temperature: 60,
    status: 24,
  },
} as const;

export const lightTheme = {
  ...darkTheme,
  mode: "light" as const,
  root: "#F8F6F1",
  paperBackground: "#FFFDF8",
  paperBackgroundElevated: "#FFFFFF",
  surfaceLow: "#F0ECE4",
  surfaceWarm: "#FFFFFF",
  surfaceWarmPressed: "#F4EADF",

  accent: "#B76512",
  accentBright: "#D8831F",
  accentDeep: "#8E4707",
  accentStrong: "#C94F1D",
  accentSolid: "#D85F22",
  textOnAccent: "#FFF8EC",
  accentMuted: "rgba(216, 95, 34, 0.15)",
  accentSubtle: "rgba(216, 95, 34, 0.09)",
  accentGlow: "rgba(216, 95, 34, 0.22)",
  powerAccent: "#D94232",
  powerAccentMuted: "rgba(217, 66, 50, 0.13)",
  powerAccentGlow: "rgba(217, 66, 50, 0.2)",
  quietAccent: "#6557D9",
  quietAccentMuted: "rgba(101, 87, 217, 0.14)",
  powerfulAccent: "#B36A00",
  powerfulAccentMuted: "rgba(179, 106, 0, 0.16)",

  text: "#1F1A15",
  textSecondary: "#5F554B",
  textMuted: "#8A8177",

  border: "rgba(142, 71, 7, 0.16)",
  borderStrong: "rgba(142, 71, 7, 0.28)",
  borderActive: "rgba(216, 95, 34, 0.72)",

  controlBackground: "#F7F1EA",
  controlBackgroundPressed: "#ECE0D4",
  navBar: "#FFFDF8",
  gaugeTrack: "rgba(216, 95, 34, 0.13)",
  thumb: "#8E4707",
  inactive: "rgba(31, 26, 21, 0.35)",
  scrim: "rgba(31, 26, 21, 0.35)",

  gradients: {
    panel: ["rgba(255, 255, 255, 0.98)", "rgba(255, 252, 247, 0.98)", "#F6EFE7"],
    button: ["#FFF5E8", "#F7E7D6", "#ECD7C4"],
    buttonPressed: ["#F6E2CC", "#ECD3BA", "#DFC0A3"],
    danger: [
      "rgba(255, 239, 235, 0.98)",
      "rgba(250, 226, 221, 0.98)",
      "rgba(242, 211, 205, 0.98)",
    ],
  },
} as const;

export type Theme = typeof darkTheme | typeof lightTheme;

export const theme: Theme = darkTheme;

type ThemeContextValue = {
  theme: Theme;
  mode: ThemeMode;
  isLight: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  mode: "dark",
  isLight: false,
  setMode: () => undefined,
  toggleTheme: () => undefined,
});

const themeForMode = (mode: ThemeMode): Theme =>
  mode === "light" ? lightTheme : darkTheme;

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    let mounted = true;

    void AsyncStorage.getItem(THEME_STORAGE_KEY).then((storedMode) => {
      if (!mounted) return;
      if (storedMode === "light" || storedMode === "dark") {
        setModeState(storedMode);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((currentMode) => {
      const nextMode = currentMode === "light" ? "dark" : "light";
      void AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
      return nextMode;
    });
  }, []);

  const activeTheme = themeForMode(mode);
  const value = useMemo<ThemeContextValue>(
    () => ({
      isLight: mode === "light",
      mode,
      setMode,
      theme: activeTheme,
      toggleTheme,
    }),
    [activeTheme, mode, setMode, toggleTheme],
  );

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme() {
  return useContext(ThemeContext).theme;
}

export function useThemeMode() {
  return useContext(ThemeContext);
}
