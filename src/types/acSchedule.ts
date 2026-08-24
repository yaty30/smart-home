import type { AirConditionerMode, AirflowLevel } from "./airConditioner";

export type ScheduleAirflow = "auto" | AirflowLevel;

export type AcSchedule = {
  enabled: boolean;
  startTime: string;
  endTime: string;
  mode: Exclude<AirConditionerMode, "fan">;
  temperature: number;
  horizontalAirflow: ScheduleAirflow;
  verticalAirflow: ScheduleAirflow;
};
