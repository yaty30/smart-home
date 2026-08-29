import type {
  AirConditionerMode,
  AirflowLevel,
  FanSpeed,
} from "../types/airConditioner";
import type { DeviceStateSnapshot, EspAirflow } from "../types/device";

export const modeToEspMode = (mode: AirConditionerMode) => {
  switch (mode) {
    case "auto":
      return "auto";
    case "cold":
      return "cool";
    case "dry":
      return "dry";
    case "heat":
      return "heat";
    case "fan":
      return "fan";
    default:
      return "cool";
  }
};

export const airflowLevelToEspPosition: Record<
  AirflowLevel,
  Exclude<EspAirflow, "auto">
> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
};

export const espPositionToAirflowLevel: Record<
  "1" | "2" | "3" | "4" | "5",
  AirflowLevel
> = {
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
};

export type AcUiState = {
  fanAuto: boolean;
  fanSpeed: FanSpeed | null;
  horizontalAirflow: AirflowLevel | null;
  horizontalAirflowAuto: boolean;
  mode: AirConditionerMode;
  power: boolean;
  powerful: boolean;
  quiet: boolean;
  temperature: number;
  verticalAirflow: AirflowLevel | null;
  verticalAirflowAuto: boolean;
};

export function acSnapshotToUiState(ac: DeviceStateSnapshot["ac"]): AcUiState {
  const isFanAuto = ac.fan === "auto";
  const isHorizontalAuto = ac.swingHorizontal === "auto";
  const isVerticalAuto = ac.swingVertical === "auto";

  return {
    fanAuto: isFanAuto,
    fanSpeed: ac.fan === "auto" ? null : (Number(ac.fan) as FanSpeed),
    horizontalAirflow:
      ac.swingHorizontal === "auto"
        ? null
        : espPositionToAirflowLevel[ac.swingHorizontal],
    horizontalAirflowAuto: isHorizontalAuto,
    mode: ac.mode === "cool" ? "cold" : ac.mode,
    power: ac.power,
    powerful: ac.power ? ac.powerful : false,
    quiet: ac.power ? ac.quiet : false,
    temperature: ac.temperature,
    verticalAirflow:
      ac.swingVertical === "auto"
        ? null
        : espPositionToAirflowLevel[ac.swingVertical],
    verticalAirflowAuto: isVerticalAuto,
  };
}
