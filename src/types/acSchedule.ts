import type { AirConditionerMode, AirflowLevel, FanSpeed } from "./airConditioner";

export type ScheduleAirflow = "auto" | AirflowLevel;
export type ScheduleRepeatFrequency = "one-time" | "weekly" | "bi-weekly";
export type ScheduleFanSpeed = "auto" | FanSpeed;
export type ScheduleType = "schedule_time" | "auto_on" | "auto_off";

export const MAX_AC_SCHEDULES = 8;

export type AcSchedule = {
  id: string;
  type: ScheduleType;
  enabled: boolean;
  // Required fields depend on schedule type. Legacy schedules without a type are
  // normalized by their populated trigger times when loaded.
  startTime: string | null;
  endTime: string | null;
  // Mon-Sun, index 0 = Monday.
  days: boolean[];
  mode: Exclude<AirConditionerMode, "fan">;
  temperature: number;
  fanSpeed?: ScheduleFanSpeed;
  quiet?: boolean;
  powerful?: boolean;
  repeatEnabled?: boolean;
  repeatFrequency?: ScheduleRepeatFrequency;
  horizontalAirflow: ScheduleAirflow;
  verticalAirflow: ScheduleAirflow;
};
