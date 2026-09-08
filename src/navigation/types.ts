import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RoomIcon } from "../domain/roomIcon";

export type RootStackParamList = {
  Main: undefined;
  Rooms: undefined;
  RoomDetail: { roomId: string };
  DeviceControl: { deviceId: string };
  Controllers: undefined;
  PairController:
    | {
        roomId?: string;
        roomName?: string;
        roomIcon?: RoomIcon;
      }
    | undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type RootStackNavigationProp<T extends keyof RootStackParamList> =
  NativeStackNavigationProp<RootStackParamList, T>;

export type MainScrollDirection = "down" | "up";

export type MainTabScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Main">;
  onScrollDirectionChange?: (direction: MainScrollDirection) => void;
};
