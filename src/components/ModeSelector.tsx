import { DropletOff, Flame, Snowflake, Sparkles, SunSnow } from 'lucide-react-native';

import type { AirConditionerMode, ControlOption } from '../types/airConditioner';
import { ControlButtonGroup } from './ControlButtonGroup';
import { useTheme } from '../theme/theme';

const modes: ControlOption<AirConditionerMode>[] = [
  {
    id: 'auto',
    label: 'Auto',
    icon: Sparkles,
  },
  {
    id: 'cold',
    label: 'Cold',
    icon: Snowflake,
  },
  {
    id: 'dry',
    label: 'Dry',
    icon: DropletOff,
  },
  {
    id: 'heat',
    label: 'Heat',
    icon: Flame,
  },
];

type ModeSelectorProps = {
  selectedMode: AirConditionerMode;
  isPowered: boolean;
  isDisabled?: boolean;
  onChangeMode: (mode: AirConditionerMode) => void;
};

export function ModeSelector({
  selectedMode,
  isPowered,
  isDisabled = false,
  onChangeMode,
}: ModeSelectorProps) {
  const theme = useTheme();

  return (
    <ControlButtonGroup
      isDisabled={isDisabled}
      isPowered={isPowered}
      label="Mode"
      labelAccessory={<SunSnow color={theme.text} size={18} />}
      onChange={onChangeMode}
      options={modes}
      selectedValue={selectedMode}
    />
  );
}
