import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import type {
  HomeDevice,
  HomeDeviceType,
  HomeSchedule,
  Scene,
  SceneIconId,
} from "../types/home";

export const LIVING_ROOM_AC_DEVICE_ID = "living-ac";
export const LIVING_ROOM_AC_SCHEDULE_ID = "living-ac-schedule";

const initialScenes: Scene[] = [
  { icon: "sofa", id: "living", name: "Living Room", temperature: 24 },
  { icon: "bed", id: "bedroom", name: "Master Bedroom", temperature: 25 },
  { icon: "lamp", id: "study", name: "Study Room", temperature: 23 },
];

// The living room AC is not part of this list; it mirrors the paired
// device state and is composed into the device list by HomeScreen.
const initialDevices: HomeDevice[] = [
  {
    id: "living-light",
    name: "Light",
    onDetail: "On · 70%",
    powered: false,
    sceneId: "living",
    type: "light",
  },
  {
    id: "living-tv",
    name: "TV",
    onDetail: "On · HDMI 1",
    powered: false,
    sceneId: "living",
    type: "tv",
  },
  {
    id: "bedroom-ac",
    name: "Air Conditioner",
    onDetail: "25°C · Cool",
    powered: false,
    sceneId: "bedroom",
    type: "ac",
  },
  {
    id: "bedroom-light",
    name: "Light",
    onDetail: "On · 70%",
    powered: false,
    sceneId: "bedroom",
    type: "light",
  },
  {
    id: "study-ac",
    name: "Air Conditioner",
    onDetail: "23°C · Cool",
    powered: true,
    sceneId: "study",
    type: "ac",
  },
  {
    id: "study-light",
    name: "Light",
    onDetail: "On · 70%",
    powered: true,
    sceneId: "study",
    type: "light",
  },
];

const initialSchedules: HomeSchedule[] = [
  {
    deviceName: "Air Conditioner",
    endTime: "23:30",
    id: LIVING_ROOM_AC_SCHEDULE_ID,
    sceneId: "living",
    startTime: "09:30",
  },
  {
    deviceName: "Air Conditioner",
    endTime: "07:00",
    id: "bedroom-ac-schedule",
    sceneId: "bedroom",
    startTime: "22:00",
  },
  {
    deviceName: "Light",
    endTime: "23:00",
    id: "study-light-schedule",
    sceneId: "study",
    startTime: "18:30",
  },
];

const defaultOnDetailByType: Record<HomeDeviceType, string> = {
  ac: "24°C · Cool",
  light: "On · 100%",
  tv: "On · HDMI 1",
};

type AddDeviceInput = {
  name: string;
  sceneId: string;
  type: HomeDeviceType;
};

type HomeDataContextValue = {
  scenes: Scene[];
  devices: HomeDevice[];
  schedules: HomeSchedule[];
  addScene: (name: string, icon: SceneIconId) => Scene;
  addDevice: (input: AddDeviceInput) => HomeDevice;
  toggleDevice: (deviceId: string) => void;
};

const HomeDataContext = createContext<HomeDataContextValue | null>(null);

export function HomeDataProvider({ children }: PropsWithChildren) {
  const [scenes, setScenes] = useState<Scene[]>(initialScenes);
  const [devices, setDevices] = useState<HomeDevice[]>(initialDevices);
  const [schedules] = useState<HomeSchedule[]>(initialSchedules);

  const addScene = useCallback((name: string, icon: SceneIconId) => {
    const newScene: Scene = {
      icon,
      id: `scene-${Date.now()}`,
      name,
      temperature: 24,
    };

    setScenes((currentScenes) => [...currentScenes, newScene]);
    return newScene;
  }, []);

  const addDevice = useCallback((input: AddDeviceInput) => {
    const newDevice: HomeDevice = {
      id: `device-${Date.now()}`,
      name: input.name,
      onDetail: defaultOnDetailByType[input.type],
      powered: false,
      sceneId: input.sceneId,
      type: input.type,
    };

    setDevices((currentDevices) => [...currentDevices, newDevice]);
    return newDevice;
  }, []);

  const toggleDevice = useCallback((deviceId: string) => {
    setDevices((currentDevices) =>
      currentDevices.map((device) =>
        device.id === deviceId
          ? { ...device, powered: !device.powered }
          : device,
      ),
    );
  }, []);

  const value = useMemo(
    () => ({
      addDevice,
      addScene,
      devices,
      scenes,
      schedules,
      toggleDevice,
    }),
    [addDevice, addScene, devices, scenes, schedules, toggleDevice],
  );

  return (
    <HomeDataContext.Provider value={value}>
      {children}
    </HomeDataContext.Provider>
  );
}

export function useHomeData() {
  const context = useContext(HomeDataContext);

  if (context === null) {
    throw new Error("useHomeData must be used within a HomeDataProvider");
  }

  return context;
}
