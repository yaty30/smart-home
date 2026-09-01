export type DeviceType = "ac" | "tv" | "light" | "fan";

export type DeviceBrand =
  | "panasonic" | "lg" | "mitsubishi" | "hitachi"
  | "toshiba" | "sharp" | "fujitsu" | "samsung" | "midea";

export type DeviceTransport = "ir" | "rf" | "network";

export type DeviceCapabilities = {
  power?: boolean;
  temperature?: { min: number; max: number };
  modes?: string[];
  fanSpeeds?: string[];
  swing?: boolean;
};

export type DeviceState = {
  power?: boolean;
  temperature?: number;
  mode?: string;
  fanSpeed?: string;
  swingVertical?: string;
  swingHorizontal?: string;
  quiet?: boolean;
  powerful?: boolean;
  favourite?: boolean;
  syncStatus?: "unknown" | "syncing" | "synced" | "offline";
  lastSyncedAt?: number;
  [key: string]: unknown;
};

export type Device = {
  id: string;
  name: string;

  roomId: string;
  controllerId: string;
  controllerDeviceId?: string;  // ID on ESP32 side (for network devices like TVs)

  type: DeviceType;
  brand: DeviceBrand;
  transport: DeviceTransport;

  capabilities: DeviceCapabilities;
  state: DeviceState;
};

export type DevicePowerPresentation = {
  hasKnownPower: boolean;
  isOffline: boolean;
  isSyncing: boolean;
  isOn: boolean;
  isLiveOn: boolean;
};

export const devicePowerPresentation = (
  state: DeviceState,
): DevicePowerPresentation => {
  const isOn = state.power === true;
  const isOffline = state.syncStatus === "offline";
  const isSyncing =
    state.syncStatus === "syncing" ||
    state.syncStatus === "unknown" ||
    state.syncStatus === undefined;

  return {
    hasKnownPower: typeof state.power === "boolean",
    isOffline,
    isSyncing,
    isOn,
    isLiveOn: isOn && !isOffline && !isSyncing,
  };
};

export const createDevice = (
  name: string,
  roomId: string,
  controllerId: string,
  type: DeviceType,
  brand: DeviceBrand,
  transport: DeviceTransport,
  controllerDeviceId?: string
): Device => ({
  id: `device-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  name,
  roomId,
  controllerId,
  type,
  brand,
  transport,
  ...(controllerDeviceId ? { controllerDeviceId } : {}),
  capabilities: {},
  state: {},
});
