import { Wifi, WifiOff } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { StatusDot } from '../common/StatusDot';
import { type Theme, useTheme } from '../../theme/theme';

type SummaryCardProps = {
  onlineCount: number;
  allOnline: boolean;
  temps: number[];
  humidities: number[];
};

export function SummaryCard({ onlineCount, allOnline, temps, humidities }: SummaryCardProps) {
  const theme = useTheme();
  const summaryStyles = useMemo(() => createSummaryStyles(theme), [theme]);
  const avgTemp = temps.length > 0 ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null;
  const avgHumidity = humidities.length > 0 ? Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length) : null;

  return (
    <View style={summaryStyles.card}>
      <View style={summaryStyles.topRow}>
        <StatusDot online={allOnline} />
        <Text style={summaryStyles.deviceCount}>{onlineCount} Device{onlineCount !== 1 ? 's' : ''} Online</Text>
      </View>
      <View style={summaryStyles.statusLine}>
        {allOnline
          ? <Wifi size={13} color={theme.textSecondary} />
          : <WifiOff size={13} color={theme.textMuted} />}
        <Text style={summaryStyles.statusText}>
          {allOnline ? 'All rooms connected' : 'Some rooms offline'}
        </Text>
      </View>
      <View style={summaryStyles.metrics}>
        <View style={summaryStyles.metric}>
          <Text style={summaryStyles.metricValue}>{avgTemp != null ? `${avgTemp}°` : '—'}</Text>
          <Text style={summaryStyles.metricLabel}>Temp</Text>
        </View>
        <View style={summaryStyles.metricDivider} />
        <View style={summaryStyles.metric}>
          <Text style={summaryStyles.metricValue}>{avgHumidity != null ? `${avgHumidity}%` : '—'}</Text>
          <Text style={summaryStyles.metricLabel}>Humidity</Text>
        </View>
        <View style={summaryStyles.metricDivider} />
        <View style={summaryStyles.metric}>
          <Text style={summaryStyles.metricValue}>{onlineCount}</Text>
          <Text style={summaryStyles.metricLabel}>Usage</Text>
        </View>
      </View>
    </View>
  );
}

const createSummaryStyles = (theme: Theme) => StyleSheet.create({
  card: {
    backgroundColor: theme.paperBackground,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    borderColor: theme.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  deviceCount: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  statusText: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.border,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
