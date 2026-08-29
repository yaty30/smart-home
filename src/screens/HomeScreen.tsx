import { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DeviceCard } from '../components/home/DeviceCard';
import { HeroCard } from '../components/home/HeroCard';
import { RoomSelector } from '../components/home/RoomSelector';
import { SummaryCard } from '../components/home/SummaryCard';
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
