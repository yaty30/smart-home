import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type RootStackParamList = {
  Home: undefined;
  Scene: { sceneId: string };
  AirConditioner: { deviceId: string };
  NewScene: undefined;
  NewDevice: { sceneId?: string } | undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
