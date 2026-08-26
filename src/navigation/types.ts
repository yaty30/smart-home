import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

export type RootStackParamList = {
  Main: undefined;
  SceneDetail: { sceneId: string };
  AirConditioner: undefined;
  NewScene: undefined;
  NewDevice: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainScrollDirection = "down" | "up";

export type MainTabScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Main">;
  onScrollDirectionChange?: (direction: MainScrollDirection) => void;
};
