import type { AirConditionerMode, AirflowLevel } from "./airConditioner";

export type ScheduleAirflow = "auto" | AirflowLevel;

export type AcSchedule = {
  enabled: boolean;
  startTime: string;
  endTime: string | null;
  // Mon–Sun, index 0 = Monday. Not yet persisted to ESP32; defaults to all true.
  days: boolean[];
  mode: Exclude<AirConditionerMode, "fan">;
  temperature: number;
  quiet?: boolean;
  powerful?: boolean;
  horizontalAirflow: ScheduleAirflow;
  verticalAirflow: ScheduleAirflow;
};
