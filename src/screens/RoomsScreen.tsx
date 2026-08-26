import { Plus } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { AddRoomSheet } from "../components/AddRoomSheet";
import { AppHeader, HeaderIconButton } from "../components/AppHeader";
import { getRoomIcon, type RoomIcon } from "../domain/roomIcon";
import { useRooms } from "../store/rooms";
import { useDevices } from "../store/devices";
import { useControllers } from "../store/controllers";
import { theme } from "../theme/theme";
import type { RootStackScreenProps } from "../navigation/types";

type RoomsScreenProps = {
  navigation: RootStackScreenProps<"Main">["navigation"];
};

export function RoomsScreen({ navigation }: RoomsScreenProps) {
  const { rooms, addRoom } = useRooms();
  const { getDevicesByRoom } = useDevices();
  const { controllers } = useControllers();
  const [showAddRoomSheet, setShowAddRoomSheet] = useState(false);

  const handleAddRoom = useCallback(
    (name: string, icon: RoomIcon) => {
      addRoom(name, icon);
      setShowAddRoomSheet(false);
    },
    [addRoom],
  );

  return (
    <View style={styles.screen}>
      <AppHeader
        rightAction={
          <HeaderIconButton
            accessibilityLabel="Add room"
            framed
            onPress={() => setShowAddRoomSheet(true)}
          >
            <Plus color={theme.accent} size={24} strokeWidth={2.6} />
          </HeaderIconButton>
        }
        title="Rooms"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.grid}>
          {rooms.map((room) => {
            const RoomIcon = getRoomIcon(room.icon);
            const roomDevices = getDevicesByRoom(room.id);
            const deviceCount = roomDevices.length;
            const roomController = controllers.find((c) => c.roomId === room.id);
            const isOnline = roomController?.online ?? false;

            return (
              <TouchableOpacity
                key={room.id}
                activeOpacity={0.84}
                accessibilityRole="button"
                accessibilityLabel={`Open ${room.name}`}
                onPress={() =>
                  navigation.navigate("RoomDetail", { roomId: room.id })
                }
                style={styles.roomCard}
              >
                <View style={styles.roomCardHeader}>
                  <View style={[styles.statusDot, isOnline && styles.statusDotOnline]} />
                  <View style={styles.roomCardHeaderSpacer} />
                </View>
                <View style={styles.roomIcon}>
                  <RoomIcon color={theme.accent} size={24} strokeWidth={2.2} />
                </View>
                <Text numberOfLines={2} style={styles.roomName}>
                  {room.name}
                </Text>
                <Text style={styles.deviceCount}>
                  {deviceCount} {deviceCount === 1 ? 'device' : 'devices'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <AddRoomSheet
        visible={showAddRoomSheet}
        onClose={() => setShowAddRoomSheet(false)}
        onAddRoom={handleAddRoom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.root,
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: 120,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  roomCard: {
    alignItems: "center",
    backgroundColor: theme.surfaceWarm,
    borderColor: theme.border,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    width: "48%",
  },
  roomCardHeader: {
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.textMuted,
  },
  statusDotOnline: {
    backgroundColor: '#4ADE80',
  },
  roomCardHeaderSpacer: {
    width: 20,
  },
  roomIcon: {
    alignItems: "center",
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
    borderRadius: 15,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  roomName: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
  },
  deviceCount: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
    textAlign: "center",
  },
});
