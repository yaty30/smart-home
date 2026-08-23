import { Smartphone, Wind } from "lucide-react-native";
import { StyleSheet, Switch, Text, View } from "react-native";

import { theme } from "../theme/theme";
import type {
  AirflowLevel,
  ControlIconProps,
  ControlOption,
  ControlOptionType,
} from "../types/airConditioner";
import { ControlButtonGroup } from "./ControlButtonGroup";

const defaultAirConWindPosition = { top: 5, right: 2, size: 13, pl: 0 };

const RotatingWind = ({ iconRotation = 0, ...props }: ControlIconProps) => {
  return (
    <Wind
      {...props}
      style={{
        transform: [{ rotate: `${iconRotation}deg` }],
      }}
    />
  );
};

const AirCon = ({ color, iconRotation = 0, strokeWidth, type = 3 }: ControlIconProps) => {
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

const verticalAirflowOptions: ControlOption<AirflowLevel>[] = [
  {
    id: "one",
    accessibilityLabel: "Vertical airflow level 1",
    icon: AirCon,
    iconRotation: 0,
  },
  {
    id: "two",
    accessibilityLabel: "Vertical airflow level 2",
    icon: AirCon,
    iconRotation: 10,
  },
  {
    id: "three",
    accessibilityLabel: "Vertical airflow level 3",
    icon: AirCon,
    iconRotation: 25,
  },
  {
    id: "four",
    accessibilityLabel: "Vertical airflow level 4",
    icon: AirCon,
    iconRotation: 40,
  },
  {
    id: "five",
    accessibilityLabel: "Vertical airflow level 5",
    icon: AirCon,
    iconRotation: 60,
  },
];

const horizontalAirflowOptions: ControlOption<AirflowLevel>[] = [
  {
    id: "one",
    accessibilityLabel: "Horizontal airflow level 1",
    icon: RotatingWind,
    iconRotation: 150,
  },
  {
    id: "two",
    accessibilityLabel: "Horizontal airflow level 2",
    icon: RotatingWind,
    iconRotation: 120,
  },
  {
    id: "three",
    accessibilityLabel: "Horizontal airflow level 3",
    icon: RotatingWind,
    iconRotation: 90,
  },
  {
    id: "four",
    accessibilityLabel: "Horizontal airflow level 4",
    icon: RotatingWind,
    iconRotation: 50,
  },
  {
    id: "five",
    accessibilityLabel: "Horizontal airflow level 5",
    icon: RotatingWind,
    iconRotation: 30,
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

function AirflowAutoSwitch({
  isAuto,
  isDisabled = false,
  isPowered,
  onChangeAuto,
}: Pick<
  AirflowSelectorProps,
  "isAuto" | "isDisabled" | "isPowered" | "onChangeAuto"
>) {
  const disabled = !isPowered || isDisabled;
  const switchOn = isPowered && isAuto;

  return (
    <View style={styles.autoControl}>
      <Text
        style={[
          styles.autoLabel,
          switchOn && styles.autoLabelActive,
        ]}
      >
        Auto
      </Text>
      <Switch
        accessibilityLabel="Toggle automatic airflow"
        disabled={disabled}
        ios_backgroundColor={theme.controlBackground}
        onValueChange={onChangeAuto}
        thumbColor={
          switchOn ? theme.accentBright : theme.textSecondary
        }
        trackColor={{
          false: theme.controlBackgroundPressed,
          true: theme.accentMuted,
        }}
        value={switchOn}
      />
    </View>
  );
}

export function HorizontalAirflowSelector({
  selectedLevel,
  isAuto,
  isDisabled = false,
  isPowered,
  onChangeLevel,
  onChangeAuto,
}: AirflowSelectorProps) {
  return (
    <ControlButtonGroup
      isDisabled={isDisabled}
      isPowered={isPowered}
      labelAccessory={
        <AirflowAutoSwitch
          isAuto={isAuto}
          isDisabled={isDisabled}
          isPowered={isPowered}
          onChangeAuto={onChangeAuto}
        />
      }
      label="Horizontal Airflow"
      onChange={onChangeLevel}
      options={horizontalAirflowOptions}
      selectedValue={selectedLevel}
      suppressSelection={isAuto}
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
  return (
    <ControlButtonGroup
      isDisabled={isDisabled}
      isPowered={isPowered}
      labelAccessory={
        <AirflowAutoSwitch
          isAuto={isAuto}
          isDisabled={isDisabled}
          isPowered={isPowered}
          onChangeAuto={onChangeAuto}
        />
      }
      label="Vertical Airflow"
      onChange={onChangeLevel}
      options={verticalAirflowOptions}
      selectedValue={selectedLevel}
      suppressSelection={isAuto}
    />
  );
}

const styles = StyleSheet.create({
  autoControl: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginRight: theme.spacing.md,
  },
  autoLabel: {
    color: theme.textSecondary,
    fontSize: theme.typography.label,
    fontWeight: "700",
    letterSpacing: 0,
  },
  autoLabelActive: {
    color: theme.accent,
  },
});
