import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getPairedDevice,
  removePairedDevice,
  savePairedDevice,
} from "../storage/deviceStorage";
import type { PairedDevice } from "../types/device";

type DeviceConnectionContextValue = {
  pairedDevice: PairedDevice | null;
  isLoading: boolean;
  isPaired: boolean;
  pairDevice: (device: PairedDevice) => Promise<void>;
  disconnectDevice: () => Promise<void>;
};

const DeviceConnectionContext =
  createContext<DeviceConnectionContextValue | null>(null);

export function DeviceConnectionProvider({ children }: PropsWithChildren) {
  const [pairedDevice, setPairedDevice] = useState<PairedDevice | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadPairedDevice = async () => {
      try {
        const storedDevice = await getPairedDevice();

        if (isMounted) {
          setPairedDevice(storedDevice);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadPairedDevice();

    return () => {
      isMounted = false;
    };
  }, []);

  const pairDevice = useCallback(async (device: PairedDevice) => {
    await savePairedDevice(device);
    setPairedDevice(device);
  }, []);

  const disconnectDevice = useCallback(async () => {
    await removePairedDevice();
    setPairedDevice(null);
  }, []);

  const value = useMemo<DeviceConnectionContextValue>(
    () => ({
      disconnectDevice,
      isLoading,
      isPaired: pairedDevice !== null,
      pairDevice,
      pairedDevice,
    }),
    [disconnectDevice, isLoading, pairDevice, pairedDevice],
  );

  return (
    <DeviceConnectionContext.Provider value={value}>
      {children}
    </DeviceConnectionContext.Provider>
  );
}

export function useDeviceConnection() {
  const context = useContext(DeviceConnectionContext);

  if (context === null) {
    throw new Error(
      "useDeviceConnection must be used inside DeviceConnectionProvider",
    );
  }

  return context;
}
