import { ChevronRight, ShelvingUnit } from 'lucide-react-native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { type Theme, useTheme } from '../../theme/theme';

type RoomSelectorProps = {
  rooms: { id: string; name: string }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRoomsPress: () => void;
};

export function RoomSelector({ rooms, selectedId, onSelect, onRoomsPress }: RoomSelectorProps) {
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
