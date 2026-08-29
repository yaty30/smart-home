import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  MAX_AC_SCHEDULES,
  type AcSchedule,
  type ScheduleAirflow,
  type ScheduleFanSpeed,
  type ScheduleRepeatFrequency,
  type ScheduleType,
} from "../types/acSchedule";
import type { AirConditionerMode, AirflowLevel } from "../types/airConditioner";
import type { PairedDevice } from "../types/device";

const AC_SCHEDULE_STORAGE_KEY_PREFIX = "smartHome.acSchedule";
const ALL_DAYS: boolean[] = [true, true, true, true, true, true, true];

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

const isScheduleType = (value: unknown): value is ScheduleType => {
  return (
    typeof value === "string" &&
    ["schedule_time", "auto_on", "auto_off"].includes(value)
  );
};

const normalizeScheduleDays = (value: unknown): boolean[] => {
  if (!Array.isArray(value)) return [...ALL_DAYS];
  return ALL_DAYS.map((fallback, i) =>
    typeof value[i] === "boolean" ? value[i] : fallback,
  );
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
  const type = isScheduleType(candidate.type)
    ? candidate.type
    : isScheduleTime(candidate.startTime) && candidate.endTime === null
      ? "auto_on"
      : candidate.startTime === null && isScheduleTime(candidate.endTime)
        ? "auto_off"
        : "schedule_time";

  return (
    (candidate.id === undefined || typeof candidate.id === "string") &&
    (candidate.type === undefined || isScheduleType(candidate.type)) &&
    typeof candidate.enabled === "boolean" &&
    (candidate.startTime === null || isScheduleTime(candidate.startTime)) &&
    (candidate.endTime === null || isScheduleTime(candidate.endTime)) &&
    (candidate.startTime !== null || candidate.endTime !== null) &&
    (type !== "schedule_time" ||
      (candidate.startTime !== null && candidate.endTime !== null)) &&
    (type !== "auto_on" ||
      (candidate.startTime !== null && candidate.endTime === null)) &&
    (type !== "auto_off" ||
      (candidate.startTime === null && candidate.endTime !== null)) &&
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

const scheduleIdFromIndex = (index: number) => `schedule-${index + 1}`;

const normalizeStoredSchedule = (
  schedule: AcSchedule,
  index: number,
): AcSchedule => ({
  ...schedule,
  id: schedule.id ?? scheduleIdFromIndex(index),
  days: normalizeScheduleDays(schedule.days),
  type:
    schedule.type ??
    (schedule.startTime !== null && schedule.endTime === null
      ? "auto_on"
      : schedule.startTime === null && schedule.endTime !== null
        ? "auto_off"
        : "schedule_time"),
});

export async function getAcSchedules(
  device: PairedDevice,
): Promise<AcSchedule[]> {
  const storedSchedule = await AsyncStorage.getItem(
    scheduleStorageKeyForDevice(device),
  );

  if (storedSchedule === null) {
    return [];
  }

  try {
    const parsedSchedule = JSON.parse(storedSchedule) as unknown;
    const parsedSchedules = Array.isArray(parsedSchedule)
      ? parsedSchedule
      : [parsedSchedule];

    return parsedSchedules
      .filter(isAcSchedule)
      .slice(0, MAX_AC_SCHEDULES)
      .map((schedule, index) => normalizeStoredSchedule(schedule, index));
  } catch {
    return [];
  }
}

export async function saveAcSchedules(
  device: PairedDevice,
  schedules: AcSchedule[],
): Promise<void> {
  await AsyncStorage.setItem(
    scheduleStorageKeyForDevice(device),
    JSON.stringify(schedules.slice(0, MAX_AC_SCHEDULES)),
  );
}

export async function removeAcSchedules(device: PairedDevice): Promise<void> {
  await AsyncStorage.removeItem(scheduleStorageKeyForDevice(device));
}
