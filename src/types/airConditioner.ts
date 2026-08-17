import type { ComponentType } from "react";

export type AirConditionerMode = "auto" | "heat" | "dry" | "cold";

export type AirflowLevel = "one" | "two" | "three" | "four" | "five";

export type FanSpeed = 1 | 2 | 3 | 4 | 5;

export type ControlIconProps = {
  color?: string;
  iconRotation?: number;
  size?: number;
  strokeWidth?: number;
  type?: number;
};

export type ControlOption<T extends string> = {
  id: T;
  label?: string;
  accessibilityLabel?: string;
  icon?: ComponentType<ControlIconProps>;
  iconRotation?: number;
};

export type ControlOptionType = {
  top: number;
  right: number;
  size: number;
  pl: number;
};
