import type { AcSchedule, ScheduleAirflow } from "../types/acSchedule";
import type { AirConditionerMode, AirflowLevel } from "../types/airConditioner";
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

function modeToEsp(mode: Exclude<AirConditionerMode, "fan">): string {
  if (mode === "cold") return "cool";
  return mode;
}

function espToMode(value: string): Exclude<AirConditionerMode, "fan"> {
  if (value === "cool") return "cold";
  return value as Exclude<AirConditionerMode, "fan">;
}

const ALL_DAYS: boolean[] = [true, true, true, true, true, true, true];

function parseScheduleResponse(obj: Record<string, unknown>): AcSchedule {
  const endTime =
    typeof obj.endTime === "string" && obj.endTime.length > 0
      ? obj.endTime
      : null;

  return {
    enabled: Boolean(obj.enabled),
    startTime: String(obj.startTime),
    endTime,
    days: Array.isArray(obj.days) ? (obj.days as boolean[]) : [...ALL_DAYS],
    mode: espToMode(String(obj.mode)),
    temperature: Number(obj.temperature),
    quiet: Boolean(obj.quiet),
    powerful: Boolean(obj.powerful),
    horizontalAirflow: espToScheduleAirflow(String(obj.swingHorizontal)),
    verticalAirflow: espToScheduleAirflow(String(obj.swingVertical)),
  };
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

export async function getAcScheduleFromDevice(
  device: PairedDevice,
): Promise<AcSchedule | null> {
  const host = device.host.replace(/\/+$/, "");
  try {
    const response = await fetchWithTimeout(`${host}/ac/schedule`, {
      headers: { Authorization: `Bearer ${device.token}` },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = (await response.json()) as {
      success: boolean;
      schedule: Record<string, unknown>;
    };
    return parseScheduleResponse(json.schedule);
  } catch (error) {
    console.warn("[Schedule] GET failed:", error);
    throw error;
  }
}

export async function putAcScheduleToDevice(
  device: PairedDevice,
  schedule: AcSchedule,
): Promise<AcSchedule> {
  const host = device.host.replace(/\/+$/, "");
  const body = JSON.stringify({
    enabled: schedule.enabled,
    startTime: schedule.startTime,
    endTime: schedule.endTime ?? null,
    mode: modeToEsp(schedule.mode),
    temperature: schedule.temperature,
    quiet: Boolean(schedule.quiet),
    powerful: Boolean(schedule.powerful),
    swingVertical: scheduleAirflowToEsp(schedule.verticalAirflow),
    swingHorizontal: scheduleAirflowToEsp(schedule.horizontalAirflow),
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
    const json = (await response.json()) as {
      success: boolean;
      schedule: Record<string, unknown>;
    };
    return parseScheduleResponse(json.schedule);
  } catch (error) {
    console.warn("[Schedule] PUT failed:", error);
    throw error;
  }
}

export async function deleteAcScheduleFromDevice(
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
