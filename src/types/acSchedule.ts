import type { AirConditionerMode, AirflowLevel, FanSpeed } from "./airConditioner";

export type ScheduleAirflow = "auto" | AirflowLevel;
export type ScheduleRepeatFrequency = "one-time" | "weekly" | "bi-weekly";
export type ScheduleFanSpeed = "auto" | FanSpeed;

export type AcSchedule = {
  enabled: boolean;
  startTime: string;
  endTime: string | null;
  // Mon–Sun, index 0 = Monday. Not yet persisted to ESP32; defaults to all true.
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
