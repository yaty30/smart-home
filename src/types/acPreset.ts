import type {
  AirConditionerMode,
  AirflowLevel,
  FanSpeed,
} from "./airConditioner";

export type AcPresetAirflow = "auto" | AirflowLevel;
export type AcPresetFanSpeed = "auto" | FanSpeed;
export type AcPresetMode = Exclude<AirConditionerMode, "fan">;

export const MAX_AC_PRESETS = 8;

export type AcPreset = {
  id: string;
  name: string;
  mode: AcPresetMode;
  temperature: number;
  fanSpeed: AcPresetFanSpeed;
  quiet: boolean;
  powerful: boolean;
  horizontalAirflow: AcPresetAirflow;
  verticalAirflow: AcPresetAirflow;
};
