import { Wind } from 'lucide-react-native';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { theme } from '../theme/theme';
import type { AirflowLevel, ControlOption } from '../types/airConditioner';
import { ControlButtonGroup } from './ControlButtonGroup';

const verticalAirflowOptions: ControlOption<AirflowLevel>[] = [
  {
    id: 'one',
    accessibilityLabel: 'Vertical airflow level 1',
    icon: Wind,
    iconRotation: 0,
  },
  {
    id: 'two',
    accessibilityLabel: 'Vertical airflow level 2',
    icon: Wind,
    iconRotation: 30,
  },
  {
    id: 'three',
    accessibilityLabel: 'Vertical airflow level 3',
    icon: Wind,
    iconRotation: 40,
  },
  {
    id: 'four',
    accessibilityLabel: 'Vertical airflow level 4',
    icon: Wind,
    iconRotation: 50,
  },
  {
    id: 'five',
    accessibilityLabel: 'Vertical airflow level 5',
    icon: Wind,
    iconRotation: 60,
  },
];

const horizontalAirflowOptions: ControlOption<AirflowLevel>[] = [
  {
    id: 'one',
    accessibilityLabel: 'Horizontal airflow level 1',
    icon: Wind,
    iconRotation: 150,
  },
  {
    id: 'two',
    accessibilityLabel: 'Horizontal airflow level 2',
    icon: Wind,
    iconRotation: 120,
  },
  {
    id: 'three',
    accessibilityLabel: 'Horizontal airflow level 3',
    icon: Wind,
    iconRotation: 90,
  },
  {
    id: 'four',
    accessibilityLabel: 'Horizontal airflow level 4',
    icon: Wind,
    iconRotation: 50,
  },
  {
    id: 'five',
    accessibilityLabel: 'Horizontal airflow level 5',
    icon: Wind,
    iconRotation: 30,
  },
];

type AirflowSelectorProps = {
  selectedLevel: AirflowLevel;
  isAuto: boolean;
  isPowered: boolean;
  onChangeLevel: (level: AirflowLevel) => void;
  onChangeAuto: (isAuto: boolean) => void;
};

function AirflowAutoSwitch({
  isAuto,
  isPowered,
  onChangeAuto,
}: Pick<AirflowSelectorProps, 'isAuto' | 'isPowered' | 'onChangeAuto'>) {
  return (
    <View style={styles.autoControl}>
      <Text style={[styles.autoLabel, isAuto && isPowered && styles.autoLabelActive]}>
        Auto
      </Text>
      <Switch
        accessibilityLabel="Toggle automatic airflow"
        disabled={!isPowered}
        ios_backgroundColor={theme.controlBackground}
        onValueChange={onChangeAuto}
        thumbColor={isAuto && isPowered ? theme.accentBright : theme.textSecondary}
        trackColor={{
          false: theme.controlBackgroundPressed,
          true: theme.accentMuted,
        }}
        value={isPowered && isAuto}
      />
    </View>
  );
}

export function HorizontalAirflowSelector({
  selectedLevel,
  isAuto,
  isPowered,
  onChangeLevel,
  onChangeAuto,
}: AirflowSelectorProps) {
  return (
    <ControlButtonGroup
      isPowered={isPowered}
      labelAccessory={
        <AirflowAutoSwitch
          isAuto={isAuto}
          isPowered={isPowered}
          onChangeAuto={onChangeAuto}
        />
      }
      label="Horizontal Airflow"
      onChange={onChangeLevel}
      options={horizontalAirflowOptions}
      selectedValue={selectedLevel}
    />
  );
}

export function VerticalAirflowSelector({
  selectedLevel,
  isAuto,
  isPowered,
  onChangeLevel,
  onChangeAuto,
}: AirflowSelectorProps) {
  return (
    <ControlButtonGroup
      isPowered={isPowered}
      labelAccessory={
        <AirflowAutoSwitch
          isAuto={isAuto}
          isPowered={isPowered}
          onChangeAuto={onChangeAuto}
        />
      }
      label="Vertical Airflow"
      onChange={onChangeLevel}
      options={verticalAirflowOptions}
      selectedValue={selectedLevel}
    />
  );
}

const styles = StyleSheet.create({
  autoControl: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  autoLabel: {
    color: theme.textSecondary,
    fontSize: theme.typography.label,
    fontWeight: '700',
    letterSpacing: 0,
  },
  autoLabelActive: {
    color: theme.accent,
  },
});
