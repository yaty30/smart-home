import { DropletOff, Flame, Snowflake, Sparkles } from 'lucide-react-native';

import type { AirConditionerMode, ControlOption } from '../types/airConditioner';
import { ControlButtonGroup } from './ControlButtonGroup';

const modes: ControlOption<AirConditionerMode>[] = [
  {
    id: 'auto',
    label: 'Auto',
    icon: Sparkles,
  },
  {
    id: 'heat',
    label: 'Heat',
    icon: Flame,
  },
  {
    id: 'dry',
    label: 'Dry',
    icon: DropletOff,
  },
  {
    id: 'cold',
    label: 'Cold',
    icon: Snowflake,
  },
];

type ModeSelectorProps = {
  selectedMode: AirConditionerMode;
  isPowered: boolean;
  onChangeMode: (mode: AirConditionerMode) => void;
};

export function ModeSelector({
  selectedMode,
  isPowered,
  onChangeMode,
}: ModeSelectorProps) {
  return (
    <ControlButtonGroup
      isPowered={isPowered}
      label="Mode"
      onChange={onChangeMode}
      options={modes}
      selectedValue={selectedMode}
    />
  );
}
