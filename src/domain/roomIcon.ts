import {
  Armchair,
  Baby,
  Bath,
  Bed,
  BedDouble,
  BedSingle,
  Briefcase,
  CookingPot,
  Dumbbell,
  House,
  LampCeiling,
  LampFloor,
  Monitor,
  ShowerHead,
  Sofa,
  UtensilsCrossed,
  Warehouse,
  WashingMachine,
} from 'lucide-react-native';

export const ROOM_ICONS = [
  { id: 'house', label: 'Home', icon: House },
  { id: 'sofa', label: 'Living', icon: Sofa },
  { id: 'armchair', label: 'Lounge', icon: Armchair },
  { id: 'bed', label: 'Bedroom', icon: Bed },
  { id: 'bed-double', label: 'Master', icon: BedDouble },
  { id: 'bed-single', label: 'Guest', icon: BedSingle },
  { id: 'bath', label: 'Bath', icon: Bath },
  { id: 'shower', label: 'Shower', icon: ShowerHead },
  { id: 'kitchen', label: 'Kitchen', icon: CookingPot },
  { id: 'dining', label: 'Dining', icon: UtensilsCrossed },
  { id: 'lamp-floor', label: 'Reading', icon: LampFloor },
  { id: 'lamp-ceiling', label: 'Hallway', icon: LampCeiling },
  { id: 'office', label: 'Office', icon: Briefcase },
  { id: 'study', label: 'Study', icon: Monitor },
  { id: 'nursery', label: 'Nursery', icon: Baby },
  { id: 'gym', label: 'Gym', icon: Dumbbell },
  { id: 'laundry', label: 'Laundry', icon: WashingMachine },
  { id: 'garage', label: 'Garage', icon: Warehouse },
] as const;

export type RoomIcon = (typeof ROOM_ICONS)[number]['id'];

export const DEFAULT_ROOM_ICON: RoomIcon = 'house';

export const isRoomIcon = (value: unknown): value is RoomIcon => {
  return typeof value === 'string' && ROOM_ICONS.some((icon) => icon.id === value);
};

export const getRoomIcon = (icon: RoomIcon | undefined) => {
  return ROOM_ICONS.find((option) => option.id === icon)?.icon ?? House;
};
