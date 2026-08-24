import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { removeAcSchedule } from "../storage/acScheduleStorage";
import {
  emptyHomeSnapshot,
  getHome,
  saveHome,
  type HomeSnapshot,
} from "../storage/homeStorage";
import type {
  HomeDevice,
  HomeDeviceType,
  Scene,
  SceneIconId,
} from "../types/home";

type AddDeviceInput = {
  name: string;
  sceneId: string;
  type: HomeDeviceType;
  host: string;
  token: string;
};

type HomeDataContextValue = {
  isLoading: boolean;
  scenes: Scene[];
  devices: HomeDevice[];
  addScene: (name: string, icon: SceneIconId) => Scene;
  renameScene: (sceneId: string, name: string) => void;
  removeScene: (sceneId: string) => void;
  addDevice: (input: AddDeviceInput) => HomeDevice;
  removeDevice: (deviceId: string) => void;
  findDeviceByHost: (host: string) => HomeDevice | undefined;
};

const HomeDataContext = createContext<HomeDataContextValue | null>(null);

const normalizeHost = (host: string) => host.replace(/\/+$/, "").toLowerCase();

export function HomeDataProvider({ children }: PropsWithChildren) {
  const [home, setHome] = useState<HomeSnapshot>(emptyHomeSnapshot);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedHome = useRef(false);
  const pendingSave = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let isMounted = true;

    const loadHome = async () => {
      try {
        const storedHome = await getHome();

        if (isMounted) {
          setHome(storedHome);
        }
      } finally {
        if (isMounted) {
          hasLoadedHome.current = true;
          setIsLoading(false);
        }
      }
    };

    void loadHome();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedHome.current) {
      return;
    }

    // Chain writes so a slower earlier save cannot overwrite a newer snapshot.
    pendingSave.current = pendingSave.current
      .then(() => saveHome(home))
      .catch(() => {
        console.warn("Home layout could not be saved.");
      });
  }, [home]);

  const addScene = useCallback((name: string, icon: SceneIconId) => {
    const newScene: Scene = {
      icon,
      id: `scene-${Date.now()}`,
      name,
    };

    setHome((currentHome) => ({
      ...currentHome,
      scenes: [...currentHome.scenes, newScene],
    }));

    return newScene;
  }, []);

  const renameScene = useCallback((sceneId: string, name: string) => {
    setHome((currentHome) => ({
      ...currentHome,
      scenes: currentHome.scenes.map((scene) =>
        scene.id === sceneId ? { ...scene, name } : scene,
      ),
    }));
  }, []);

  const removeScene = useCallback(
    (sceneId: string) => {
      home.devices
        .filter((device) => device.sceneId === sceneId)
        .forEach((device) => {
          void removeAcSchedule(device.id).catch(() => {
            console.warn("Schedule for a removed device could not be cleared.");
          });
        });

      setHome((currentHome) => ({
        devices: currentHome.devices.filter(
          (device) => device.sceneId !== sceneId,
        ),
        scenes: currentHome.scenes.filter((scene) => scene.id !== sceneId),
      }));
    },
    [home.devices],
  );

  const addDevice = useCallback((input: AddDeviceInput) => {
    const newDevice: HomeDevice = {
      host: input.host.replace(/\/+$/, ""),
      id: `device-${Date.now()}`,
      name: input.name,
      sceneId: input.sceneId,
      token: input.token,
      type: input.type,
    };

    setHome((currentHome) => ({
      ...currentHome,
      devices: [...currentHome.devices, newDevice],
    }));

    return newDevice;
  }, []);

  const removeDevice = useCallback((deviceId: string) => {
    setHome((currentHome) => ({
      ...currentHome,
      devices: currentHome.devices.filter((device) => device.id !== deviceId),
    }));

    void removeAcSchedule(deviceId).catch(() => {
      console.warn("Schedule for the removed device could not be cleared.");
    });
  }, []);

  const findDeviceByHost = useCallback(
    (host: string) => {
      const normalizedHost = normalizeHost(host);

      return home.devices.find(
        (device) => normalizeHost(device.host) === normalizedHost,
      );
    },
    [home.devices],
  );

  const value = useMemo<HomeDataContextValue>(
    () => ({
      addDevice,
      addScene,
      devices: home.devices,
      findDeviceByHost,
      isLoading,
      removeDevice,
      removeScene,
      renameScene,
      scenes: home.scenes,
    }),
    [
      addDevice,
      addScene,
      findDeviceByHost,
      home.devices,
      home.scenes,
      isLoading,
      removeDevice,
      removeScene,
      renameScene,
    ],
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
