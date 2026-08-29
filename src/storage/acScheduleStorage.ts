import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  AcSchedule,
  ScheduleAirflow,
  ScheduleFanSpeed,
  ScheduleRepeatFrequency,
} from "../types/acSchedule";
import type { AirConditionerMode, AirflowLevel } from "../types/airConditioner";
import type { PairedDevice } from "../types/device";

const AC_SCHEDULE_STORAGE_KEY_PREFIX = "smartHome.acSchedule";

const scheduleStorageKeyForDevice = (device: PairedDevice) => {
  return `${AC_SCHEDULE_STORAGE_KEY_PREFIX}.${encodeURIComponent(
    device.host,
  )}.${encodeURIComponent(device.token)}`;
};

const isScheduleMode = (
  value: unknown,
): value is Exclude<AirConditionerMode, "fan"> => {
  return (
    typeof value === "string" &&
    ["auto", "cold", "dry", "heat"].includes(value)
  );
};

const isScheduleTime = (value: unknown): value is string => {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
};

const isAirflowLevel = (value: unknown): value is AirflowLevel => {
  return (
    typeof value === "string" &&
    ["one", "two", "three", "four", "five"].includes(value)
  );
};

const isScheduleAirflow = (value: unknown): value is ScheduleAirflow => {
  return value === "auto" || isAirflowLevel(value);
};

const isScheduleFanSpeed = (value: unknown): value is ScheduleFanSpeed => {
  return value === "auto" || (typeof value === "number" && [1, 2, 3, 4, 5].includes(value));
};

const isScheduleRepeatFrequency = (
  value: unknown,
): value is ScheduleRepeatFrequency => {
  return (
    typeof value === "string" &&
    ["one-time", "weekly", "bi-weekly"].includes(value)
  );
};

const isAcSchedule = (value: unknown): value is AcSchedule => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<AcSchedule>;
  return (
    typeof candidate.enabled === "boolean" &&
    (candidate.startTime === null || isScheduleTime(candidate.startTime)) &&
    (candidate.endTime === null || isScheduleTime(candidate.endTime)) &&
    (candidate.startTime !== null || candidate.endTime !== null) &&
    isScheduleMode(candidate.mode) &&
    typeof candidate.temperature === "number" &&
    (candidate.fanSpeed === undefined ||
      isScheduleFanSpeed(candidate.fanSpeed)) &&
    (candidate.quiet === undefined || typeof candidate.quiet === "boolean") &&
    (candidate.powerful === undefined || typeof candidate.powerful === "boolean") &&
    (candidate.repeatEnabled === undefined ||
      typeof candidate.repeatEnabled === "boolean") &&
    (candidate.repeatFrequency === undefined ||
      isScheduleRepeatFrequency(candidate.repeatFrequency)) &&
    isScheduleAirflow(candidate.horizontalAirflow) &&
    isScheduleAirflow(candidate.verticalAirflow)
  );
};

export async function getAcSchedule(
  device: PairedDevice,
): Promise<AcSchedule | null> {
  const storedSchedule = await AsyncStorage.getItem(
    scheduleStorageKeyForDevice(device),
  );

  if (storedSchedule === null) {
    return null;
  }

  try {
    const parsedSchedule = JSON.parse(storedSchedule) as unknown;
    return isAcSchedule(parsedSchedule) ? parsedSchedule : null;
  } catch {
    return null;
  }
}

export async function saveAcSchedule(
  device: PairedDevice,
  schedule: AcSchedule,
): Promise<void> {
  await AsyncStorage.setItem(
    scheduleStorageKeyForDevice(device),
    JSON.stringify(schedule),
  );
}

export async function removeAcSchedule(device: PairedDevice): Promise<void> {
  await AsyncStorage.removeItem(scheduleStorageKeyForDevice(device));
}
