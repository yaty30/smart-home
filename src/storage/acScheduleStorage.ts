import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AcSchedule, ScheduleAirflow } from "../types/acSchedule";
import type { AirConditionerMode, AirflowLevel } from "../types/airConditioner";

const AC_SCHEDULE_STORAGE_KEY_PREFIX = "smartHome.acSchedule";

const scheduleStorageKeyForDevice = (deviceId: string) => {
  return `${AC_SCHEDULE_STORAGE_KEY_PREFIX}.${encodeURIComponent(deviceId)}`;
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

const isAcSchedule = (value: unknown): value is AcSchedule => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<AcSchedule>;
  return (
    typeof candidate.enabled === "boolean" &&
    isScheduleTime(candidate.startTime) &&
    isScheduleTime(candidate.endTime) &&
    isScheduleMode(candidate.mode) &&
    typeof candidate.temperature === "number" &&
    isScheduleAirflow(candidate.horizontalAirflow) &&
    isScheduleAirflow(candidate.verticalAirflow)
  );
};

export async function getAcSchedule(
  deviceId: string,
): Promise<AcSchedule | null> {
  const storedSchedule = await AsyncStorage.getItem(
    scheduleStorageKeyForDevice(deviceId),
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
  deviceId: string,
  schedule: AcSchedule,
): Promise<void> {
  await AsyncStorage.setItem(
    scheduleStorageKeyForDevice(deviceId),
    JSON.stringify(schedule),
  );
}

export async function removeAcSchedule(deviceId: string): Promise<void> {
  await AsyncStorage.removeItem(scheduleStorageKeyForDevice(deviceId));
}
