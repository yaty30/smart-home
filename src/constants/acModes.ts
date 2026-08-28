import { Sparkles, Snowflake, DropletOff, Flame, Fan } from 'lucide-react-native';
import type { AirConditionerMode } from '../types/airConditioner';
import type { Theme } from '../theme/theme';

export const TEMPERATURE_RANGES: Record<
  Exclude<AirConditionerMode, 'fan'>,
  { min: number; max: number }
> = {
  auto: { min: 16, max: 30 },
  cold: { min: 16, max: 26 },
  dry: { min: 16, max: 28 },
  heat: { min: 22, max: 30 },
};

export const temperatureRangeForMode = (mode: AirConditionerMode) => {
  if (mode === 'fan') {
    return TEMPERATURE_RANGES.auto;
  }
  return TEMPERATURE_RANGES[mode];
};

export const MODE_ICONS = (theme: Theme) => ({
  auto: { icon: Sparkles, color: theme.modeColors.auto, label: 'Auto' },
  cold: { icon: Snowflake, color: theme.modeColors.cool, label: 'Cold' },
  cool: { icon: Snowflake, color: theme.modeColors.cool, label: 'Cool' },
  dry: { icon: DropletOff, color: theme.modeColors.dry, label: 'Dry' },
  heat: { icon: Flame, color: theme.modeColors.heat, label: 'Heat' },
  fan: { icon: Fan, color: theme.modeColors.fan, label: 'Fan' },
});
