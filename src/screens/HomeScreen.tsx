import { AirVent, ChevronRight, Lightbulb, ShelvingUnit, Star, Tv, Wifi, WifiOff } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Device } from '../domain/device';
import type { MainTabScreenProps } from '../navigation/types';
import { useControllers } from '../store/controllers';
import { useDevices } from '../store/devices';
import { useRooms } from '../store/rooms';
import { type Theme, useTheme } from '../theme/theme';

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good Night';
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  if (h < 21) return 'Good Evening';
  return 'Good Night';
}

function acStateSummary(device: Device): string {
  const { mode, temperature, fanSpeed } = device.state;
  const parts: string[] = [];
  if (mode === 'cool') parts.push('Cooling');
  else if (mode === 'heat') parts.push('Heating');
  else if (mode === 'dry') parts.push('Dry');
  else if (mode === 'fan') parts.push('Fan Only');
  else if (mode) parts.push('Auto');
  if (typeof temperature === 'number') parts.push(`${temperature}°C`);
  if (fanSpeed === 'auto') parts.push('Fan Auto');
  else if (fanSpeed) parts.push(`Fan ${fanSpeed}`);
  return parts.join('  ·  ');
}

function DeviceTypeIcon({ type, size, color }: { type: Device['type']; size: number; color: string }) {
  if (type === 'ac') return <AirVent size={size} color={color} />;
  if (type === 'tv') return <Tv size={size} color={color} />;
  return <Lightbulb size={size} color={color} />;
}

// ─── Hero card ───────────────────────────────────────────────────────────────

type HeroCardProps = {
  device: Device;
  onOpenControl: () => void;
};

function HeroCard({ device, onOpenControl }: HeroCardProps) {
  const theme = useTheme();
  const heroStyles = useMemo(() => createHeroStyles(theme), [theme]);
  const isOn = device.state.power === true;
  const summary = device.type === 'ac' ? acStateSummary(device) : '';
  const { getRoomById } = useRooms();

  const room = getRoomById(device.roomId)?.name ?? ""
  return (
    <TouchableOpacity style={heroStyles.card} onPress={onOpenControl} activeOpacity={0.78}>
      <View style={heroStyles.header}>
        <View style={heroStyles.nameLine}>
          <View style={{ display: 'flex', flexDirection: 'row', gap: 6 }}>
            <Star size={14} color={theme.accent} fill={theme.accent} style={heroStyles.starIcon} />
            <Text style={{ ...heroStyles.label, color: theme.accentGlow }} numberOfLines={1}>{room}</Text>
          </View>
          <Text style={{ ...heroStyles.label, fontSize: 22 }} numberOfLines={1}>{device.name}</Text>
        </View>
        <View style={[heroStyles.powerBadge, isOn ? heroStyles.powerBadgeOn : heroStyles.powerBadgeOff]}>
          <Text style={[heroStyles.powerBadgeText, isOn ? heroStyles.powerBadgeTextOn : heroStyles.powerBadgeTextOff]}>
            {isOn ? 'ON' : 'OFF'}
          </Text>
        </View>
      </View>

      <View style={heroStyles.body}>
        <DeviceTypeIcon type={device.type} size={48} color={isOn ? theme.accent : theme.textMuted} />
        {!!summary && <Text style={heroStyles.summary} numberOfLines={2}>{summary}</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── Room selector ───────────────────────────────────────────────────────────

type RoomSelectorProps = {
  rooms: { id: string; name: string }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRoomsPress: () => void;
};

function RoomSelector({ rooms, selectedId, onSelect, onRoomsPress }: RoomSelectorProps) {
  const theme = useTheme();
  const roomSelectorStyles = useMemo(() => createRoomSelectorStyles(theme), [theme]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={roomSelectorStyles.row}
    >
      <TouchableOpacity style={roomSelectorStyles.roomsBtn} onPress={onRoomsPress} activeOpacity={0.75}>
        <ShelvingUnit size={14} color={theme.accent} />
      </TouchableOpacity>

      <ChevronRight size={14} color={theme.accent} />

      {rooms.map((room) => {
        const selected = room.id === selectedId;
        return (
          <TouchableOpacity
            key={room.id}
            style={[roomSelectorStyles.pill, selected && roomSelectorStyles.pillSelected]}
            onPress={() => onSelect(selected ? null : room.id)}
            activeOpacity={0.75}
          >
            <Text style={[roomSelectorStyles.pillText, selected && roomSelectorStyles.pillTextSelected]}>
              {room.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const createRoomSelectorStyles = (theme: Theme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  roomsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    borderColor: theme.borderActive,
    backgroundColor: theme.accentSubtle,
  },
  roomsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accent,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radiusRound,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceLow,
  },
  pillSelected: {
    borderColor: theme.borderActive,
    backgroundColor: theme.accentMuted,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  pillTextSelected: {
    color: theme.accent,
  },
});

// ─── Summary card ─────────────────────────────────────────────────────────────

type SummaryCardProps = {
  onlineCount: number;
  allOnline: boolean;
  temps: number[];
  humidities: number[];
};

function SummaryCard({ onlineCount, allOnline, temps, humidities }: SummaryCardProps) {
  const theme = useTheme();
  const summaryStyles = useMemo(() => createSummaryStyles(theme), [theme]);
  const avgTemp = temps.length > 0 ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null;
  const avgHumidity = humidities.length > 0 ? Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length) : null;

  return (
    <View style={summaryStyles.card}>
      <View style={summaryStyles.topRow}>
        <View style={[summaryStyles.statusDot, { backgroundColor: allOnline ? '#4ADE80' : theme.textMuted }]} />
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
  // StyleSheet doesn't support dynamic values directly; use a function and inline
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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

// ─── Device card ──────────────────────────────────────────────────────────────

type DeviceCardProps = {
  device: Device;
  onPress: () => void;
};

function DeviceCard({ device, onPress }: DeviceCardProps) {
  const theme = useTheme();
  const deviceCardStyles = useMemo(() => createDeviceCardStyles(theme), [theme]);
  const isOn = device.state.power === true;
  return (
    <TouchableOpacity style={deviceCardStyles.card} onPress={onPress} activeOpacity={0.78}>
      <View style={deviceCardStyles.iconRow}>
        <DeviceTypeIcon type={device.type} size={26} color={isOn ? theme.accent : theme.textMuted} />
        <View style={[deviceCardStyles.dot, isOn ? deviceCardStyles.dotOn : deviceCardStyles.dotOff]} />
      </View>
      <Text style={deviceCardStyles.name} numberOfLines={2}>{device.name}</Text>
      <Text style={deviceCardStyles.state}>{isOn ? 'On' : 'Off'}</Text>
    </TouchableOpacity>
  );
}

const createDeviceCardStyles = (theme: Theme) => StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: theme.surfaceWarm,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    borderColor: theme.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
    minHeight: 120,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  dotOn: { backgroundColor: '#4ADE80' },
  dotOff: { backgroundColor: theme.textMuted },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
    lineHeight: 19,
  },
  state: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.textMuted,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export function HomeScreen({ navigation }: MainTabScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { rooms } = useRooms();
  const { devices } = useDevices();
  const { controllers } = useControllers();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const favouriteDevice = useMemo(() => {
    return devices.find((d) => d.state.favourite === true) ?? devices[0] ?? null;
  }, [devices]);

  const visibleDevices = useMemo(() => {
    if (!selectedRoomId) return devices;
    return devices.filter((d) => d.roomId === selectedRoomId);
  }, [devices, selectedRoomId]);

  const onlineCount = useMemo(
    () => devices.filter((d) => d.state.power === true).length,
    [devices],
  );

  const allOnline = useMemo(
    () => controllers.every((c) => c.online),
    [controllers],
  );

  // AC temperatures for the summary card
  const temps = useMemo(
    () =>
      devices
        .filter((d) => d.type === 'ac' && d.state.power === true && typeof d.state.temperature === 'number')
        .map((d) => d.state.temperature as number),
    [devices],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{timeGreeting()}</Text>
          <Text style={styles.name}>Hello, James</Text>
        </View>

        {/* Favourite device hero */}
        {favouriteDevice && (
          <HeroCard
            device={favouriteDevice}
            onOpenControl={() => navigation.navigate('DeviceControl', { deviceId: favouriteDevice.id })}
          />
        )}

        {/* Room selector */}
        {rooms.length > 0 && (
          <RoomSelector
            rooms={rooms}
            selectedId={selectedRoomId}
            onSelect={setSelectedRoomId}
            onRoomsPress={() => navigation.navigate('Rooms')}
          />
        )}

        {/* Home summary */}
        <SummaryCard
          onlineCount={onlineCount}
          allOnline={allOnline}
          temps={temps}
          humidities={[]}
        />

        {/* Devices grid */}
        {visibleDevices.length > 0 && (
          <View style={styles.devicesSection}>
            <Text style={styles.sectionTitle}>Devices</Text>
            <View style={styles.grid}>
              {visibleDevices.map((device) => (
                <View style={styles.gridItem} key={device.id}>
                  <DeviceCard
                    device={device}
                    onPress={() => navigation.navigate('DeviceControl', { deviceId: device.id })}
                  />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.root,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: theme.spacing.xl,
    paddingBottom: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.lg
  },
  header: {
    paddingHorizontal: theme.spacing.xs,
    gap: 2,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.text,
  },
  devicesSection: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  gridItem: {
    width: '31%'
  }
});

// ─── Sub-component StyleSheets ─────────────────────────────────────────────────

const createHeroStyles = (theme: Theme) => StyleSheet.create({
  card: {
    backgroundColor: theme.surfaceWarm,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    borderColor: theme.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameLine: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    flex: 1,
    marginRight: theme.spacing.md,
  },
  starIcon: {
    marginTop: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    flex: 1,
  },
  powerBadge: {
    borderRadius: theme.radiusSmall,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  powerBadgeOn: {
    backgroundColor: theme.accentMuted,
    borderWidth: 1,
    borderColor: theme.borderActive,
  },
  powerBadgeOff: {
    backgroundColor: theme.surfaceLow,
    borderWidth: 1,
    borderColor: theme.border,
  },
  powerBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  powerBadgeTextOn: {
    color: theme.accent,
  },
  powerBadgeTextOff: {
    color: theme.textMuted,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  summary: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
    lineHeight: 22,
  },
  controlBtn: {
    backgroundColor: theme.accent,
    borderRadius: theme.radiusSmall,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: theme.spacing.xs,
  },
  controlBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textOnAccent,
  },
});
