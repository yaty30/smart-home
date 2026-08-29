import AsyncStorage from "@react-native-async-storage/async-storage";

import type { PairedDevice } from "../types/device";

const PAIRED_DEVICE_STORAGE_KEY = "smartHome.pairedDevice";

const isPairedDevice = (value: unknown): value is PairedDevice => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<PairedDevice>;
  return (
    typeof candidate.host === "string" && typeof candidate.token === "string"
  );
};

export async function getPairedDevice(): Promise<PairedDevice | null> {
  const storedDevice = await AsyncStorage.getItem(PAIRED_DEVICE_STORAGE_KEY);

  if (storedDevice === null) {
    return null;
  }

  try {
    const parsedDevice = JSON.parse(storedDevice) as unknown;
    return isPairedDevice(parsedDevice) ? parsedDevice : null;
  } catch {
    return null;
  }
}

export async function savePairedDevice(device: PairedDevice): Promise<void> {
  await AsyncStorage.setItem(PAIRED_DEVICE_STORAGE_KEY, JSON.stringify(device));
}

export async function removePairedDevice(): Promise<void> {
  await AsyncStorage.removeItem(PAIRED_DEVICE_STORAGE_KEY);
}
