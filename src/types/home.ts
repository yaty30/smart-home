export const SCENE_ICON_IDS = [
  "sofa",
  "bed",
  "lamp",
  "monitor",
  "dining",
  "bath",
  "garden",
  "gym",
] as const;

export type SceneIconId = (typeof SCENE_ICON_IDS)[number];

/** Only air conditioners are supported by the ESP32 controller today. */
export const HOME_DEVICE_TYPES = ["ac"] as const;

export type HomeDeviceType = (typeof HOME_DEVICE_TYPES)[number];

export type Scene = {
  id: string;
  name: string;
  icon: SceneIconId;
};

/**
 * A device is always backed by its own paired ESP32 controller, so it carries
 * the connection details used to reach it.
 */
export type HomeDevice = {
  id: string;
  name: string;
  type: HomeDeviceType;
  sceneId: string;
  host: string;
  token: string;
};
