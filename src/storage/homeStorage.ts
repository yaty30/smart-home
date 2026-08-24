import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  HOME_DEVICE_TYPES,
  SCENE_ICON_IDS,
  type HomeDevice,
  type HomeDeviceType,
  type Scene,
  type SceneIconId,
} from "../types/home";

const HOME_STORAGE_KEY = "smartHome.home";

export const DEFAULT_SCENE: Scene = {
  icon: "sofa",
  id: "living-room",
  name: "Living Room",
};

export type HomeSnapshot = {
  scenes: Scene[];
  devices: HomeDevice[];
};

export const emptyHomeSnapshot = (): HomeSnapshot => ({
  devices: [],
  scenes: [DEFAULT_SCENE],
});

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const isSceneIconId = (value: unknown): value is SceneIconId => {
  return SCENE_ICON_IDS.some((iconId) => iconId === value);
};

const isHomeDeviceType = (value: unknown): value is HomeDeviceType => {
  return HOME_DEVICE_TYPES.some((deviceType) => deviceType === value);
};

const parseScene = (value: unknown): Scene | null => {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.name) ||
    !isSceneIconId(value.icon)
  ) {
    return null;
  }

  return { icon: value.icon, id: value.id, name: value.name };
};

const parseDevice = (value: unknown): HomeDevice | null => {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.name) ||
    !isNonEmptyString(value.sceneId) ||
    !isNonEmptyString(value.host) ||
    !isNonEmptyString(value.token) ||
    !isHomeDeviceType(value.type)
  ) {
    return null;
  }

  return {
    host: value.host,
    id: value.id,
    name: value.name,
    sceneId: value.sceneId,
    token: value.token,
    type: value.type,
  };
};

const parseHomeSnapshot = (value: unknown): HomeSnapshot | null => {
  if (!isRecord(value) || !Array.isArray(value.scenes) || !Array.isArray(value.devices)) {
    return null;
  }

  const scenes = value.scenes
    .map(parseScene)
    .filter((scene): scene is Scene => scene !== null);
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const devices = value.devices
    .map(parseDevice)
    .filter((device): device is HomeDevice => device !== null)
    .filter((device) => sceneIds.has(device.sceneId));

  return {
    devices,
    scenes: scenes.length === 0 ? [DEFAULT_SCENE] : scenes,
  };
};

export async function getHome(): Promise<HomeSnapshot> {
  const storedHome = await AsyncStorage.getItem(HOME_STORAGE_KEY);

  if (storedHome === null) {
    return emptyHomeSnapshot();
  }

  try {
    return parseHomeSnapshot(JSON.parse(storedHome) as unknown) ?? emptyHomeSnapshot();
  } catch {
    return emptyHomeSnapshot();
  }
}

export async function saveHome(snapshot: HomeSnapshot): Promise<void> {
  await AsyncStorage.setItem(HOME_STORAGE_KEY, JSON.stringify(snapshot));
}
