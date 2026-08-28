import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Device } from '../domain/device';
import { isDebugMode } from '../config/debug';
import { DEBUG_DEVICES } from './debugData';
import {
  deviceStateSnapshotToDeviceState,
  type DeviceStateSnapshot,
} from '../services/controllerStatusService';

type DevicesContextValue = {
  devices: Device[];
  isLoading: boolean;
  addDevice: (device: Device) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  removeDevicesByRoom: (roomId: string) => Promise<void>;
  updateDeviceName: (deviceId: string, name: string) => Promise<void>;
  updateDeviceState: (deviceId: string, state: Partial<Device['state']>) => void;
  applyControllerDeviceStatus: (
    controllerId: string,
    snapshot: DeviceStateSnapshot,
  ) => void;
  markControllerDevicesSyncing: (controllerId: string) => void;
  markControllerDevicesOffline: (controllerId: string) => void;
  setFavouriteDevice: (deviceId: string) => Promise<void>;
  clearFavouriteDevice: (deviceId: string) => Promise<void>;
  getDeviceById: (deviceId: string) => Device | undefined;
  getDevicesByRoom: (roomId: string) => Device[];
  getDevicesByController: (controllerId: string) => Device[];
};

const DevicesContext = createContext<DevicesContextValue | null>(null);

const DEVICES_STORAGE_KEY = 'smartHome.devices';

const isDeviceArray = (value: unknown): value is Device[] => {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.roomId === 'string' &&
      typeof item.controllerId === 'string' &&
      typeof item.type === 'string' &&
      typeof item.brand === 'string' &&
      typeof item.transport === 'string'
  );
};

const persistedDeviceState = (device: Device): Device['state'] => ({
  ...(device.state.favourite === true ? { favourite: true } : {}),
});

const sanitizeDeviceForRuntime = (device: Device): Device => ({
  ...device,
  state: {
    ...persistedDeviceState(device),
    syncStatus: 'unknown',
  },
});

const sanitizeDeviceForStorage = (device: Device): Device => ({
  ...device,
  state: persistedDeviceState(device),
});

export function DevicesProvider({ children }: PropsWithChildren) {
  const [devices, setDevices] = useState<Device[]>(
    isDebugMode ? DEBUG_DEVICES : []
  );
  const [isLoading, setIsLoading] = useState(!isDebugMode);

  useEffect(() => {
    if (isDebugMode) {
      return undefined;
    }

    let isMounted = true;

    const loadDevices = async () => {
      try {
        const stored = await AsyncStorage.getItem(DEVICES_STORAGE_KEY);
        if (stored && isMounted) {
          const parsed = JSON.parse(stored) as unknown;
          if (isDeviceArray(parsed)) {
            const sanitized = parsed.map(sanitizeDeviceForRuntime);
            setDevices(sanitized);
            void AsyncStorage.setItem(
              DEVICES_STORAGE_KEY,
              JSON.stringify(sanitized.map(sanitizeDeviceForStorage)),
            ).catch((error) => {
              console.warn('Failed to clean persisted devices:', error);
            });
          }
        }
      } catch (error) {
        console.warn('Failed to load devices:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadDevices();

    return () => {
      isMounted = false;
    };
  }, []);

  const persistDevices = useCallback(async (devicesToSave: Device[]) => {
    if (isDebugMode) {
      return;
    }

    try {
      await AsyncStorage.setItem(
        DEVICES_STORAGE_KEY,
        JSON.stringify(devicesToSave.map(sanitizeDeviceForStorage)),
      );
    } catch (error) {
      console.warn('Failed to persist devices:', error);
    }
  }, []);

  const addDevice = useCallback(
    async (device: Device) => {
      const updated = [...devices, sanitizeDeviceForRuntime(device)];
      setDevices(updated);
      await persistDevices(updated);
    },
    [devices, persistDevices]
  );

  const removeDevice = useCallback(
    async (deviceId: string) => {
      const updated = devices.filter((d) => d.id !== deviceId);
      setDevices(updated);
      await persistDevices(updated);
    },
    [devices, persistDevices]
  );

  const removeDevicesByRoom = useCallback(
    async (roomId: string) => {
      const updated = devices.filter((d) => d.roomId !== roomId);
      setDevices(updated);
      await persistDevices(updated);
    },
    [devices, persistDevices]
  );

  const updateDeviceName = useCallback(
    async (deviceId: string, name: string) => {
      const updated = devices.map((device) =>
        device.id === deviceId ? { ...device, name: name.trim() } : device
      );
      setDevices(updated);
      await persistDevices(updated);
    },
    [devices, persistDevices]
  );

  const updateDeviceState = useCallback((deviceId: string, state: Partial<Device['state']>) => {
    setDevices((current) =>
      current.map((d) =>
        d.id === deviceId
          ? {
              ...d,
              state: {
                ...d.state,
                ...state,
              },
            }
          : d
      )
    );
  }, []);

  const applyControllerDeviceStatus = useCallback((
    controllerId: string,
    snapshot: DeviceStateSnapshot,
  ) => {
    const nextRuntimeState = deviceStateSnapshotToDeviceState(snapshot);

    setDevices((current) =>
      current.map((device) =>
        device.controllerId === controllerId && device.type === 'ac'
          ? {
              ...device,
              state: {
                ...device.state,
                ...nextRuntimeState,
              },
            }
          : device
      )
    );
  }, []);

  const markControllerDevicesSyncing = useCallback((controllerId: string) => {
    setDevices((current) =>
      current.map((device) =>
        device.controllerId === controllerId
          ? {
              ...device,
              state: {
                ...device.state,
                syncStatus:
                  device.state.syncStatus === 'synced' ||
                  device.state.syncStatus === 'offline'
                    ? 'syncing'
                    : 'unknown',
              },
            }
          : device
      )
    );
  }, []);

  const markControllerDevicesOffline = useCallback((controllerId: string) => {
    setDevices((current) =>
      current.map((device) =>
        device.controllerId === controllerId
          ? {
              ...device,
              state: {
                ...device.state,
                syncStatus: 'offline',
              },
            }
          : device
      )
    );
  }, []);

  const setFavouriteDevice = useCallback(
    async (deviceId: string) => {
      const updated = devices.map((d) => ({
        ...d,
        state: { ...d.state, favourite: d.id === deviceId },
      }));
      setDevices(updated);
      await persistDevices(updated);
    },
    [devices, persistDevices],
  );

  const clearFavouriteDevice = useCallback(
    async (deviceId: string) => {
      const updated = devices.map((d) =>
        d.id === deviceId
          ? {
              ...d,
              state: { ...d.state, favourite: false },
            }
          : d
      );
      setDevices(updated);
      await persistDevices(updated);
    },
    [devices, persistDevices],
  );

  const getDeviceById = useCallback(
    (deviceId: string) => {
      return devices.find((d) => d.id === deviceId);
    },
    [devices]
  );

  const getDevicesByRoom = useCallback(
    (roomId: string) => {
      return devices.filter((d) => d.roomId === roomId);
    },
    [devices]
  );

  const getDevicesByController = useCallback(
    (controllerId: string) => {
      return devices.filter((d) => d.controllerId === controllerId);
    },
    [devices]
  );

  const value = useMemo(
    () => ({
      devices,
      isLoading,
      addDevice,
      removeDevice,
      removeDevicesByRoom,
      updateDeviceName,
      updateDeviceState,
      applyControllerDeviceStatus,
      markControllerDevicesSyncing,
      markControllerDevicesOffline,
      setFavouriteDevice,
      clearFavouriteDevice,
      getDeviceById,
      getDevicesByRoom,
      getDevicesByController,
    }),
    [
      devices,
      isLoading,
      addDevice,
      removeDevice,
      removeDevicesByRoom,
      updateDeviceName,
      updateDeviceState,
      applyControllerDeviceStatus,
      markControllerDevicesSyncing,
      markControllerDevicesOffline,
      setFavouriteDevice,
      clearFavouriteDevice,
      getDeviceById,
      getDevicesByRoom,
      getDevicesByController,
    ]
  );

  return (
    <DevicesContext.Provider value={value}>
      {children}
    </DevicesContext.Provider>
  );
}

export function useDevices() {
  const context = useContext(DevicesContext);
  if (context === null) {
    throw new Error('useDevices must be used within a DevicesProvider');
  }
  return context;
}
