export const theme = {
  root: '#0B0B0D',
  paperBackground: '#151517',
  paperBackgroundElevated: '#1D1D20',
  surfaceLow: '#111113',

  accent: '#FF8A2A',
  accentBright: '#FFA24D',
  accentDeep: '#FF7A18',
  accentMuted: 'rgba(255, 138, 42, 0.15)',
  accentSubtle: 'rgba(255, 138, 42, 0.08)',
  accentGlow: 'rgba(255, 138, 42, 0.28)',

  text: '#F7F7F8',
  textSecondary: '#A7A7AD',
  textMuted: '#68686F',

  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.13)',
  borderActive: 'rgba(255, 138, 42, 0.8)',

  controlBackground: '#18181B',
  controlBackgroundPressed: '#212125',
  gaugeTrack: 'rgba(255, 255, 255, 0.09)',
  thumb: '#FFF6EC',
  inactive: 'rgba(247, 247, 248, 0.38)',
  scrim: 'rgba(11, 11, 13, 0.72)',

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
