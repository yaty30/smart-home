import type { ReactNode } from "react";

import { MODE_ICONS } from "../../constants/acModes";
import type { Theme } from "../../theme/theme";
import type { AirConditionerMode } from "../../types/airConditioner";
import { MODE_OPTION_IDS } from "./scheduleConstants";

export type ScheduleModeOption = {
  id: Exclude<AirConditionerMode, "fan">;
  label: string;
  icon: ReactNode;
};

const modeStyles = {
  opacity: 0.86,
};

export const modeOptions = (theme: Theme): ScheduleModeOption[] => {
  const icons = MODE_ICONS(theme);

  return MODE_OPTION_IDS.map((id) => {
    const { color, icon: Icon, label } = icons[id];

    return {
      id,
      label,
      icon: <Icon style={modeStyles} size={18} color={color} />,
    };
  });
};
