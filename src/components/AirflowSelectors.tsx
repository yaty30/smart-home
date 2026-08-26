import {
  ArrowDown,
  ArrowRight,
  DraftingCompass,
  MoveHorizontal,
  MoveVertical,
  Smartphone,
  Wind,
} from "lucide-react-native";
import { View } from "react-native";

import type {
  AirflowLevel,
  ControlIconProps,
  ControlOption,
  ControlOptionType,
} from "../types/airConditioner";
import { ControlButtonGroup } from "./ControlButtonGroup";
import { theme } from "../theme/theme";

const defaultAirConWindPosition = { top: 5, right: 2, size: 13, pl: 0 };
export type AirflowOption = "auto" | AirflowLevel;

export const AirflowIcon = ({
  color,
  iconRotation = 0,
  strokeWidth,
  type = 3,
}: ControlIconProps) => {
  const types: ControlOptionType[] = [
    defaultAirConWindPosition,
    { top: 7, right: 3, size: 13, pl: 4 },
    { top: 9, right: 4, size: 13, pl: 4 },
    { top: 10, right: 4, size: 13, pl: 4 },
    { top: 13, right: 7, size: 12, pl: 5 },
  ];
  
  const option = types[type - 1] ?? defaultAirConWindPosition;

  return (
    <View style={{ flexDirection: "row", position: 'relative', left: option.pl }}>
      <Smartphone
        color={color}
        size={18}
        strokeWidth={strokeWidth}
        style={{ position: "relative", bottom: 3 }}
      />
      <Wind
        color={color}
        size={option.size}
        strokeWidth={strokeWidth}
        style={{
          position: "relative",
          top: option.top,
          right: option.right,
          transform: [{ rotate: `${iconRotation}deg` }],
        }}
      />
    </View>
  );
};

export const verticalAirflowOptions: ControlOption<AirflowOption>[] = [
  {
    id: "auto",
    label: "Auto",
    accessibilityLabel: "Set vertical airflow to auto",
    icon: null,
    iconRotation: 0,
    iconType: 3,
  },
  {
    id: "one",
    label: null,
    accessibilityLabel: "Vertical airflow level 1",
    icon: ArrowRight,
    iconRotation: 0,
    iconType: 1,
  },
  {
    id: "two",
    label: null,
    accessibilityLabel: "Vertical airflow level 2",
    icon: ArrowRight,
    iconRotation: 20,
    iconType: 2,
  },
  {
    id: "three",
    label: null,
    accessibilityLabel: "Vertical airflow level 3",
    icon: ArrowRight,
    iconRotation: 40,
    iconType: 3,
  },
  {
    id: "four",
    label: null,
    accessibilityLabel: "Vertical airflow level 4",
    icon: ArrowRight,
    iconRotation: 55,
    iconType: 4,
  },
  {
    id: "five",
    label: null,
    accessibilityLabel: "Vertical airflow level 5",
    icon: ArrowRight,
    iconRotation: 80,
    iconType: 5,
  },
];

export const horizontalAirflowOptions: ControlOption<AirflowOption>[] = [
  {
    id: "auto",
    label: "Auto",
    accessibilityLabel: "Set horizontal airflow to auto",
    icon: null,
    iconRotation: 90,
  },
  {
    id: "one",
    label: null,
    accessibilityLabel: "Horizontal airflow level 1",
    icon: ArrowDown,
    iconRotation: 50,
  },
  {
    id: "two",
    label: null,
    accessibilityLabel: "Horizontal airflow level 2",
    icon: ArrowDown,
    iconRotation: 30,
  },
  {
    id: "three",
    label: null,
    accessibilityLabel: "Horizontal airflow level 3",
    icon: ArrowDown,
    iconRotation: 0,
  },
  {
    id: "four",
    label: null,
    accessibilityLabel: "Horizontal airflow level 4",
    icon: ArrowDown,
    iconRotation: -30,
  },
  {
    id: "five",
    label: null,
    accessibilityLabel: "Horizontal airflow level 5",
    icon: ArrowDown,
    iconRotation: -50,
  },
];

type AirflowSelectorProps = {
  selectedLevel: AirflowLevel;
  isAuto: boolean;
  isPowered: boolean;
  isDisabled?: boolean;
  onChangeLevel: (level: AirflowLevel) => void;
  onChangeAuto: (isAuto: boolean) => void;
};

export function HorizontalAirflowSelector({
  selectedLevel,
  isAuto,
  isDisabled = false,
  isPowered,
  onChangeLevel,
  onChangeAuto,
}: AirflowSelectorProps) {
  const handleChange = (nextValue: AirflowOption) => {
    if (nextValue === "auto") {
      onChangeAuto(true);
      return;
    }

    onChangeLevel(nextValue);
  };

  return (
    <ControlButtonGroup
      isDisabled={isDisabled}
      isPowered={isPowered}
      label="Horizontal Airflow"
      labelAccessory={<DraftingCompass color={theme.text} size={18} />}
      onChange={handleChange}
      options={horizontalAirflowOptions}
      selectedValue={isAuto ? "auto" : selectedLevel}
    />
  );
}

export function VerticalAirflowSelector({
  selectedLevel,
  isAuto,
  isDisabled = false,
  isPowered,
  onChangeLevel,
  onChangeAuto,
}: AirflowSelectorProps) {
  const handleChange = (nextValue: AirflowOption) => {
    if (nextValue === "auto") {
      onChangeAuto(true);
      return;
    }

    onChangeLevel(nextValue);
  };

  return (
    <ControlButtonGroup
      isDisabled={isDisabled}
      isPowered={isPowered}
      label="Vertical Airflow"
      labelAccessory={<View style={{transform: 'rotate(-90deg)'}}><DraftingCompass color={theme.text} size={18} /></View>}
      onChange={handleChange}
      options={verticalAirflowOptions}
      selectedValue={isAuto ? "auto" : selectedLevel}
    />
  );
}
