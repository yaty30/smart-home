import {
  MAX_AC_SCHEDULES,
  type AcSchedule,
  type ScheduleAirflow,
  type ScheduleFanSpeed,
  type ScheduleRepeatFrequency,
  type ScheduleType,
} from "../types/acSchedule";
import type {
  AirConditionerMode,
  AirflowLevel,
  FanSpeed,
} from "../types/airConditioner";
import type { PairedDevice } from "../types/device";

const TIMEOUT_MS = 4000;

const airflowLevelToPosition: Record<AirflowLevel, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
};

const positionToAirflowLevel: Record<string, AirflowLevel> = {
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
};

function scheduleAirflowToEsp(airflow: ScheduleAirflow): string {
  if (airflow === "auto") return "auto";
  return airflowLevelToPosition[airflow];
}

function espToScheduleAirflow(value: string): ScheduleAirflow {
  if (value === "auto") return "auto";
  return positionToAirflowLevel[value] ?? "auto";
}

function scheduleFanSpeedToEsp(fanSpeed: ScheduleFanSpeed): string {
  return fanSpeed === "auto" ? "auto" : String(fanSpeed);
}

function espToScheduleFanSpeed(value: unknown): ScheduleFanSpeed {
  if (value === "auto") return "auto";

  const fanSpeed = Number(value);
  return [1, 2, 3, 4, 5].includes(fanSpeed) ? (fanSpeed as FanSpeed) : "auto";
}

function modeToEsp(mode: Exclude<AirConditionerMode, "fan">): string {
  if (mode === "cold") return "cool";
  return mode;
}

function espToMode(value: string): Exclude<AirConditionerMode, "fan"> {
  if (value === "cool") return "cold";
  if (value === "auto" || value === "cold" || value === "dry" || value === "heat") {
    return value;
  }
  return "cold";
}

const ALL_DAYS: boolean[] = [true, true, true, true, true, true, true];

function parseScheduleDays(value: unknown): boolean[] {
  if (!Array.isArray(value)) return [...ALL_DAYS];
  return ALL_DAYS.map((fallback, i) =>
    typeof value[i] === "boolean" ? value[i] : fallback,
  );
}

function parseRepeatFrequency(value: unknown): ScheduleRepeatFrequency {
  return value === "weekly" || value === "bi-weekly" || value === "one-time"
    ? value
    : "one-time";
}

function parseScheduleTime(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseScheduleType(
  value: unknown,
  startTime: string | null,
  endTime: string | null,
): ScheduleType {
  if (
    value === "schedule_time" ||
    value === "auto_on" ||
    value === "auto_off"
  ) {
    return value;
  }

  if (startTime !== null && endTime === null) return "auto_on";
  if (startTime === null && endTime !== null) return "auto_off";
  return "schedule_time";
}

function parseScheduleResponse(
  obj: Record<string, unknown>,
  index: number,
): AcSchedule {
  const startTime = parseScheduleTime(obj.startTime);
  const endTime = parseScheduleTime(obj.endTime);

  return {
    id: typeof obj.id === "string" ? obj.id : `schedule-${index + 1}`,
    type: parseScheduleType(obj.type, startTime, endTime),
    enabled: Boolean(obj.enabled),
    startTime,
    endTime,
    days: parseScheduleDays(obj.days),
    mode: espToMode(String(obj.mode)),
    temperature: Number(obj.temperature),
    fanSpeed: espToScheduleFanSpeed(obj.fan ?? obj.fanSpeed),
    quiet: Boolean(obj.quiet),
    powerful: Boolean(obj.powerful),
    repeatEnabled: Boolean(obj.repeatEnabled),
    repeatFrequency: parseRepeatFrequency(obj.repeatFrequency),
    horizontalAirflow: espToScheduleAirflow(String(obj.swingHorizontal)),
    verticalAirflow: espToScheduleAirflow(String(obj.swingVertical)),
  };
}

function scheduleToPayload(schedule: AcSchedule) {
  return {
    id: schedule.id,
    type: schedule.type,
    enabled: schedule.enabled,
    startTime: schedule.startTime ?? null,
    endTime: schedule.endTime ?? null,
    days: schedule.days,
    mode: modeToEsp(schedule.mode),
    temperature: schedule.temperature,
    fan: scheduleFanSpeedToEsp(schedule.fanSpeed ?? "auto"),
    quiet: Boolean(schedule.quiet),
    powerful: Boolean(schedule.powerful),
    repeatEnabled: Boolean(schedule.repeatEnabled),
    repeatFrequency: schedule.repeatFrequency ?? "one-time",
    swingVertical: scheduleAirflowToEsp(schedule.verticalAirflow),
    swingHorizontal: scheduleAirflowToEsp(schedule.horizontalAirflow),
  };
}

function parseSchedulesResponse(json: Record<string, unknown>): AcSchedule[] {
  const schedules = Array.isArray(json.schedules)
    ? json.schedules
    : json.schedule && typeof json.schedule === "object"
      ? [json.schedule]
      : [];

  return schedules
    .filter(
      (schedule): schedule is Record<string, unknown> =>
        typeof schedule === "object" && schedule !== null,
    )
    .slice(0, MAX_AC_SCHEDULES)
    .map(parseScheduleResponse);
}

function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timeout),
  );
}

export async function getAcSchedulesFromDevice(
  device: PairedDevice,
): Promise<AcSchedule[]> {
  const host = device.host.replace(/\/+$/, "");
  try {
    const response = await fetchWithTimeout(`${host}/ac/schedule`, {
      headers: { Authorization: `Bearer ${device.token}` },
    });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = (await response.json()) as Record<string, unknown>;
    return parseSchedulesResponse(json);
  } catch (error) {
    console.warn("[Schedule] GET failed:", error);
    throw error;
  }
}

export async function putAcSchedulesToDevice(
  device: PairedDevice,
  schedules: AcSchedule[],
): Promise<AcSchedule[]> {
  const host = device.host.replace(/\/+$/, "");
  const body = JSON.stringify({
    schedules: schedules.slice(0, MAX_AC_SCHEDULES).map(scheduleToPayload),
  });

  try {
    const response = await fetchWithTimeout(`${host}/ac/schedule`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${device.token}`,
        "Content-Type": "application/json",
      },
      body,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = (await response.json()) as Record<string, unknown>;
    return parseSchedulesResponse(json);
  } catch (error) {
    console.warn("[Schedule] PUT failed:", error);
    throw error;
  }
}

export async function deleteAcSchedulesFromDevice(
  device: PairedDevice,
): Promise<void> {
  const host = device.host.replace(/\/+$/, "");
  try {
    const response = await fetchWithTimeout(`${host}/ac/schedule`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${device.token}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.warn("[Schedule] DELETE failed:", error);
    throw error;
  }
}
