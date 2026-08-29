import type { RoomIcon } from './roomIcon';
import { DEFAULT_ROOM_ICON } from './roomIcon';

export type Room = {
  id: string;
  name: string;
  icon?: RoomIcon;
};

export const createRoom = (name: string, icon: RoomIcon = DEFAULT_ROOM_ICON): Room => ({
  id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  name,
  icon,
});
