export type SceneIconId =
  | "sofa"
  | "bed"
  | "lamp"
  | "monitor"
  | "dining"
  | "bath"
  | "garden"
  | "gym";

export type HomeDeviceType = "ac" | "light" | "tv";

export type Scene = {
  id: string;
  name: string;
  icon: SceneIconId;
  temperature: number;
};

export type HomeDevice = {
  id: string;
  name: string;
  type: HomeDeviceType;
  sceneId: string;
  powered: boolean;
  onDetail: string;
};

export type HomeSchedule = {
  id: string;
  sceneId: string;
  deviceName: string;
  /** 24h "HH:mm" */
  startTime: string;
  /** 24h "HH:mm" */
  endTime: string;
};
