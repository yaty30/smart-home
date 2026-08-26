export const theme = {
  root: '#050505',
  paperBackground: '#100D0A',
  paperBackgroundElevated: '#18110C',
  surfaceLow: '#0C0A08',
  surfaceWarm: '#21160F',
  surfaceWarmPressed: '#2A1C13',

  accent: '#F0A942',
  accentBright: '#FFC86F',
  accentDeep: '#B97013',
  accentStrong: '#fc773e',
  accentSolid: '#f7792b',
  textOnAccent: '#1A0E05',
  accentMuted: 'rgba(240, 169, 66, 0.26)',
  accentSubtle: 'rgba(240, 169, 66, 0.16)',
  accentGlow: 'rgba(240, 169, 66, 0.42)',
  powerAccent: '#FF6A58',
  powerAccentMuted: 'rgba(255, 106, 88, 0.14)',
  powerAccentGlow: 'rgba(255, 106, 88, 0.3)',
  quietAccent: '#8B7CFF',
  quietAccentMuted: 'rgba(139, 124, 255, 0.2)',
  powerfulAccent: '#FFA500',
  powerfulAccentMuted: 'rgba(255, 165, 0, 0.2)',

  text: '#F7F7F8',
  textSecondary: '#B4AEA8',
  textMuted: '#6F6962',

  border: 'rgba(240, 169, 66, 0.22)',
  borderStrong: 'rgba(240, 169, 66, 0.42)',
  borderActive: 'rgba(240, 169, 66, 0.9)',

  controlBackground: '#130F0C',
  controlBackgroundPressed: '#24170E',
  navBar: '#161210',
  gaugeTrack: 'rgba(240, 170, 66, 0.12)',
  thumb: '#FFE0A6',
  inactive: 'rgba(247, 247, 248, 0.38)',
  scrim: 'rgba(5, 5, 5, 0.72)',

  gradients: {
    panel: [
      'rgba(24, 18, 13, 0.94)',
      'rgba(16, 13, 10, 0.96)',
      'rgba(9, 8, 7, 0.98)',
    ],
    button: [
      '#2C2117',
      '#181410',
      '#0E0D0B',
    ],
    buttonPressed: [
      '#392817',
      '#1D1610',
      '#100D0A',
    ],
    danger: [
      'rgba(68, 32, 25, 0.9)',
      'rgba(43, 22, 19, 0.9)',
      'rgba(24, 16, 14, 0.94)',
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

export type Theme = typeof theme;
