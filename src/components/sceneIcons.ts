import {
  Bath,
  BedDouble,
  Dumbbell,
  Lamp,
  Monitor,
  Sofa,
  Trees,
  UtensilsCrossed,
} from "lucide-react-native";
import type { ComponentType } from "react";

import type { SceneIconId } from "../types/home";

type SceneIconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

export const sceneIconById: Record<SceneIconId, ComponentType<SceneIconProps>> = {
  bath: Bath,
  bed: BedDouble,
  dining: UtensilsCrossed,
  garden: Trees,
  gym: Dumbbell,
  lamp: Lamp,
  monitor: Monitor,
  sofa: Sofa,
};

export const sceneIconOptions: { id: SceneIconId; label: string }[] = [
  { id: "sofa", label: "Lounge" },
  { id: "bed", label: "Bedroom" },
  { id: "lamp", label: "Study" },
  { id: "monitor", label: "Office" },
  { id: "dining", label: "Dining" },
  { id: "bath", label: "Bath" },
  { id: "garden", label: "Garden" },
  { id: "gym", label: "Gym" },
];
