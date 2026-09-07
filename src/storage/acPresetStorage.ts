import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  MAX_AC_PRESETS,
  type AcPreset,
  type AcPresetAirflow,
  type AcPresetFanSpeed,
  type AcPresetMode,
} from "../types/acPreset";
import type { AirflowLevel } from "../types/airConditioner";
import type { PairedDevice } from "../types/device";

const AC_PRESET_STORAGE_KEY_PREFIX = "smartHome.acPreset";

const presetStorageKeyForDevice = (device: PairedDevice) => {
  return `${AC_PRESET_STORAGE_KEY_PREFIX}.${encodeURIComponent(
    device.host,
  )}.${encodeURIComponent(device.token)}`;
};

const isPresetMode = (value: unknown): value is AcPresetMode => {
  return (
    typeof value === "string" &&
    ["auto", "cold", "dry", "heat"].includes(value)
  );
};

const isAirflowLevel = (value: unknown): value is AirflowLevel => {
  return (
    typeof value === "string" &&
    ["one", "two", "three", "four", "five"].includes(value)
  );
};

const isPresetAirflow = (value: unknown): value is AcPresetAirflow => {
  return value === "auto" || isAirflowLevel(value);
};

const isPresetFanSpeed = (value: unknown): value is AcPresetFanSpeed => {
  return (
    value === "auto" ||
    (typeof value === "number" && [1, 2, 3, 4, 5].includes(value))
  );
};

const isAcPreset = (value: unknown): value is AcPreset => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<AcPreset>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    candidate.name.trim().length > 0 &&
    isPresetMode(candidate.mode) &&
    typeof candidate.temperature === "number" &&
    isPresetFanSpeed(candidate.fanSpeed) &&
    typeof candidate.quiet === "boolean" &&
    typeof candidate.powerful === "boolean" &&
    !(candidate.quiet && candidate.powerful) &&
    isPresetAirflow(candidate.horizontalAirflow) &&
    isPresetAirflow(candidate.verticalAirflow)
  );
};

const normalizePreset = (preset: AcPreset): AcPreset => ({
  ...preset,
  name: preset.name.trim(),
});

export async function getAcPresets(device: PairedDevice): Promise<AcPreset[]> {
  const storedPresets = await AsyncStorage.getItem(
    presetStorageKeyForDevice(device),
  );

  if (storedPresets === null) {
    return [];
  }

  try {
    const parsedPresets = JSON.parse(storedPresets) as unknown;

    if (!Array.isArray(parsedPresets)) {
      return [];
    }

    return parsedPresets
      .filter(isAcPreset)
      .slice(0, MAX_AC_PRESETS)
      .map(normalizePreset);
  } catch {
    return [];
  }
}

export async function saveAcPresets(
  device: PairedDevice,
  presets: AcPreset[],
): Promise<void> {
  await AsyncStorage.setItem(
    presetStorageKeyForDevice(device),
    JSON.stringify(presets.slice(0, MAX_AC_PRESETS).map(normalizePreset)),
  );
}

export async function removeAcPresets(device: PairedDevice): Promise<void> {
  await AsyncStorage.removeItem(presetStorageKeyForDevice(device));
}
