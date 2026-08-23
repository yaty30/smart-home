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

import {
  getPairedDevice,
  removePairedDevice,
  savePairedDevice,
} from "../storage/deviceStorage";
import type {
  DeviceStateSnapshot,
  EspAcMode,
  EspAirflow,
  EspFanSpeed,
  PairedDevice,
} from "../types/device";

type DeviceConnectionContextValue = {
  pairedDevice: PairedDevice | null;
  isLoading: boolean;
  isPaired: boolean;
  isDeviceConnected: boolean;
  deviceState: DeviceStateSnapshot | null;
  pairDevice: (device: PairedDevice) => Promise<void>;
  disconnectDevice: () => Promise<void>;
};

const DeviceConnectionContext =
  createContext<DeviceConnectionContextValue | null>(null);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isEspAcMode = (value: unknown): value is EspAcMode => {
  return (
    typeof value === "string" &&
    ["auto", "cool", "dry", "fan", "heat"].includes(value)
  );
};

const isEspFanSpeed = (value: unknown): value is EspFanSpeed => {
  return (
    typeof value === "string" &&
    ["auto", "1", "2", "3", "4", "5"].includes(value)
  );
};

const isEspAirflow = (value: unknown): value is EspAirflow => {
  return (
    typeof value === "string" &&
    ["auto", "1", "2", "3", "4", "5"].includes(value)
  );
};

const parseDeviceState = (value: unknown): DeviceStateSnapshot | null => {
  if (!isRecord(value) || !isRecord(value.ac) || !isRecord(value.display)) {
    return null;
  }

  const ac = value.ac;
  const display = value.display;
  if (
    typeof ac.power !== "boolean" ||
    typeof ac.temperature !== "number" ||
    !isEspAcMode(ac.mode) ||
    !isEspFanSpeed(ac.fan) ||
    !isEspAirflow(ac.swingVertical) ||
    !isEspAirflow(ac.swingHorizontal) ||
    typeof display.pairingMode !== "boolean" ||
    typeof display.screenOn !== "boolean" ||
    typeof display.qrVisible !== "boolean"
  ) {
    return null;
  }

  return {
    ac: {
      fan: ac.fan,
      mode: ac.mode,
      power: ac.power,
      swingHorizontal: ac.swingHorizontal,
      swingVertical: ac.swingVertical,
      temperature: ac.temperature,
    },
    display: {
      pairingMode: display.pairingMode,
      qrVisible: display.qrVisible,
      screenOn: display.screenOn,
    },
  };
};

const websocketUrlForDevice = (device: PairedDevice) => {
  const url = new URL(device.host);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.port = "81";
  url.pathname = "/ws";
  url.search = "";
  url.hash = "";
  return url.toString();
};

export function DeviceConnectionProvider({ children }: PropsWithChildren) {
  const [pairedDevice, setPairedDevice] = useState<PairedDevice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);
  const [deviceState, setDeviceState] = useState<DeviceStateSnapshot | null>(null);
  const reconnectAttempt = useRef(0);

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

  useEffect(() => {
    if (pairedDevice === null) {
      setDeviceState(null);
      setIsDeviceConnected(false);
      return;
    }

    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const host = pairedDevice.host.replace(/\/+$/, "");

    const applyIncomingState = (payload: unknown) => {
      const snapshot = parseDeviceState(payload);
      if (snapshot !== null && active) {
        setDeviceState(snapshot);
      }
    };

    const loadRestStatus = async () => {
      try {
        const response = await fetch(`${host}/status`, {
          headers: {
            Authorization: `Bearer ${pairedDevice.token}`,
          },
        });
        if (response.ok) {
          applyIncomingState((await response.json()) as unknown);
        }
      } catch {
        // The WebSocket retry loop remains responsible for recovery.
      }
    };

    const connect = () => {
      if (!active) {
        return;
      }

      try {
        socket = new WebSocket(websocketUrlForDevice(pairedDevice));
      } catch {
        reconnectAttempt.current += 1;
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 10000);
        reconnectTimer = setTimeout(connect, delay);
        return;
      }

      socket.onopen = () => {
        socket?.send(
          JSON.stringify({
            token: pairedDevice.token,
            type: "auth",
          }),
        );
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as unknown;
          if (isRecord(payload) && payload.type === "auth.result") {
            if (payload.ok === true) {
              reconnectAttempt.current = 0;
              setIsDeviceConnected(true);
            }
            return;
          }

          if (isRecord(payload) && payload.type === "state") {
            applyIncomingState(payload);
          }
        } catch {
          console.warn("ESP32 sent an invalid WebSocket message.");
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        if (!active) {
          return;
        }

        setIsDeviceConnected(false);
        reconnectAttempt.current += 1;
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 10000);
        reconnectTimer = setTimeout(() => {
          void loadRestStatus();
          connect();
        }, delay);
      };
    };

    reconnectAttempt.current = 0;
    void loadRestStatus();
    connect();

    return () => {
      active = false;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }
      socket?.close();
    };
  }, [pairedDevice]);

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
      deviceState,
      isDeviceConnected,
      isLoading,
      isPaired: pairedDevice !== null,
      pairDevice,
      pairedDevice,
    }),
    [
      deviceState,
      disconnectDevice,
      isDeviceConnected,
      isLoading,
      pairDevice,
      pairedDevice,
    ],
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
