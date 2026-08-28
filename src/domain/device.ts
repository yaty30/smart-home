export type DeviceType = "ac" | "tv" | "light" | "fan";

export type DeviceBrand =
  | "panasonic" | "lg" | "mitsubishi" | "hitachi"
  | "toshiba" | "sharp" | "fujitsu" | "samsung" | "midea";

export type DeviceTransport = "ir" | "rf";

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

  type: DeviceType;
  brand: DeviceBrand;
  transport: DeviceTransport;

  capabilities: DeviceCapabilities;
  state: DeviceState;
};

export const createDevice = (
  name: string,
  roomId: string,
  controllerId: string,
  type: DeviceType,
  brand: DeviceBrand,
  transport: DeviceTransport
): Device => ({
  id: `device-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  name,
  roomId,
  controllerId,
  type,
  brand,
  transport,
  capabilities: {},
  state: {},
});
