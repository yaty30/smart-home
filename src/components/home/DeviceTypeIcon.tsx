import { AirVent, Lightbulb, Tv } from 'lucide-react-native';

import type { Device } from '../../domain/device';

type DeviceTypeIconProps = {
  type: Device['type'];
  size: number;
  color: string;
};

export function DeviceTypeIcon({ type, size, color }: DeviceTypeIconProps) {
  if (type === 'ac') return <AirVent size={size} color={color} />;
  if (type === 'tv') return <Tv size={size} color={color} />;
  return <Lightbulb size={size} color={color} />;
}
