import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Room } from "../domain/room";
import { createRoom } from "../domain/room";
import type { RoomIcon } from "../domain/roomIcon";
import { isRoomIcon } from "../domain/roomIcon";

type RoomsContextValue = {
  rooms: Room[];
  isLoading: boolean;
  addRoom: (name: string, icon?: RoomIcon) => Room;
  updateRoomName: (roomId: string, name: string) => void;
  removeRoom: (roomId: string) => void;
  getRoomById: (roomId: string) => Room | undefined;
};

const RoomsContext = createContext<RoomsContextValue | null>(null);

const initialRooms: Room[] = [];
const ROOMS_STORAGE_KEY = "smartHome.rooms";

const parseStoredRooms = (value: unknown): Room[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const rooms: Room[] = [];

  for (const item of value) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof item.id !== "string" ||
      typeof item.name !== "string"
    ) {
      return null;
    }

    const icon = (item as { icon?: unknown }).icon;
    rooms.push({
      id: item.id,
      name: item.name,
      ...(isRoomIcon(icon) ? { icon } : {}),
    });
  }

  return rooms;
};

export function RoomsProvider({ children }: PropsWithChildren) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadRooms = async () => {
      try {
        const stored = await AsyncStorage.getItem(ROOMS_STORAGE_KEY);
        if (stored && isMounted) {
          const parsed = JSON.parse(stored) as unknown;
          const storedRooms = parseStoredRooms(parsed);
          if (storedRooms) {
            setRooms(storedRooms);
          }
        }
      } catch (error) {
        console.warn("Failed to load rooms:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadRooms();

    return () => {
      isMounted = false;
    };
  }, []);

  const persistRooms = useCallback(async (roomsToSave: Room[]) => {
    try {
      await AsyncStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(roomsToSave));
    } catch (error) {
      console.warn("Failed to persist rooms:", error);
    }
  }, []);

  const addRoom = useCallback((name: string, icon?: RoomIcon) => {
    const newRoom = createRoom(name.trim(), icon);
    setRooms((current) => {
      const updated = [...current, newRoom];
      void persistRooms(updated);
      return updated;
    });
    return newRoom;
  }, [persistRooms]);

  const removeRoom = useCallback((roomId: string) => {
    setRooms((current) => {
      const updated = current.filter((room) => room.id !== roomId);
      void persistRooms(updated);
      return updated;
    });
  }, [persistRooms]);

  const updateRoomName = useCallback((roomId: string, name: string) => {
    setRooms((current) => {
      const updated = current.map((room) =>
        room.id === roomId ? { ...room, name: name.trim() } : room,
      );
      void persistRooms(updated);
      return updated;
    });
  }, [persistRooms]);

  const getRoomById = useCallback(
    (roomId: string) => {
      return rooms.find((room) => room.id === roomId);
    },
    [rooms],
  );

  const value = useMemo(
    () => ({
      rooms,
      isLoading,
      addRoom,
      updateRoomName,
      removeRoom,
      getRoomById,
    }),
    [rooms, isLoading, addRoom, updateRoomName, removeRoom, getRoomById],
  );

  return (
    <RoomsContext.Provider value={value}>{children}</RoomsContext.Provider>
  );
}

export function useRooms() {
  const context = useContext(RoomsContext);
  if (context === null) {
    throw new Error("useRooms must be used within a RoomsProvider");
  }
  return context;
}
