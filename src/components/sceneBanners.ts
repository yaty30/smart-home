import type { ImageSourcePropType } from "react-native";

export const bannerBySceneId: Record<string, ImageSourcePropType> = {
  bedroom: require("../../assets/scenes/scene-bedroom.jpg"),
  living: require("../../assets/scenes/scene-living-room.jpg"),
  study: require("../../assets/scenes/scene-study.jpg"),
};
