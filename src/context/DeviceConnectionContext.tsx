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
  deviceConnectionStatus: DeviceConnectionStatus;
  debugMode: boolean;
  isLoading: boolean;
  isPaired: boolean;
  isDeviceConnected: boolean;
  deviceState: DeviceStateSnapshot | null;
  updateDeviceState: (
    updater: (currentState: DeviceStateSnapshot | null) => DeviceStateSnapshot | null,
  ) => void;
  pairDevice: (device: PairedDevice) => Promise<void>;
  disconnectDevice: () => Promise<void>;
  reportDeviceUnreachable: () => void;
};

const DeviceConnectionContext =
  createContext<DeviceConnectionContextValue | null>(null);

export type DeviceConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected";

type DeviceConnectionProviderProps = PropsWithChildren<{
  debugMode?: boolean;
}>;

const debugPairedDevice: PairedDevice = {
  host: "http://debug-device.local",
  token: "debug-token",
};

const debugDeviceState: DeviceStateSnapshot = {
  ac: {
    fan: "auto",
    mode: "auto",
    power: true,
    quiet: false,
    swingHorizontal: "auto",
    swingVertical: "auto",
    temperature: 24,
  },
  display: {
    pairingMode: false,
    qrVisible: false,
    screenOn: true,
  },
};

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
      quiet: typeof ac.quiet === "boolean" ? ac.quiet : false,
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

export function DeviceConnectionProvider({
  children,
  debugMode = false,
}: DeviceConnectionProviderProps) {
  const [pairedDevice, setPairedDevice] = useState<PairedDevice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceConnectionStatus, setDeviceConnectionStatus] =
    useState<DeviceConnectionStatus>("disconnected");
  const [deviceState, setDeviceState] = useState<DeviceStateSnapshot | null>(null);
  const [debugDisconnected, setDebugDisconnected] = useState(false);
  const reconnectAttempt = useRef(0);
  const activeSocket = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (debugMode) {
      if (debugDisconnected) {
        setPairedDevice(null);
        setDeviceState(null);
        setDeviceConnectionStatus("disconnected");
      } else {
        setPairedDevice(debugPairedDevice);
        setDeviceState(debugDeviceState);
        setDeviceConnectionStatus("connected");
      }
      setIsLoading(false);
      return;
    }

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
  }, [debugDisconnected, debugMode]);

  useEffect(() => {
    if (debugMode) {
      if (debugDisconnected) {
        setPairedDevice(null);
        setDeviceState(null);
        setDeviceConnectionStatus("disconnected");
      } else {
        setPairedDevice(debugPairedDevice);
        setDeviceState(debugDeviceState);
        setDeviceConnectionStatus("connected");
      }
      return;
    }

    if (pairedDevice === null) {
      setDeviceState(null);
      setDeviceConnectionStatus("disconnected");
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

      setDeviceConnectionStatus("connecting");

      try {
        socket = new WebSocket(websocketUrlForDevice(pairedDevice));
        activeSocket.current = socket;
      } catch {
        reconnectAttempt.current += 1;
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 10000);
        reconnectTimer = setTimeout(connect, delay);
        return;
      }

      const currentSocket = socket;

      currentSocket.onopen = () => {
        currentSocket.send(
          JSON.stringify({
            token: pairedDevice.token,
            type: "auth",
          }),
        );
      };

      currentSocket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as unknown;
          if (isRecord(payload) && payload.type === "auth.result") {
            if (payload.ok === true) {
              reconnectAttempt.current = 0;
              console.log("[Device] Reconnected; using authoritative ESP32 state.");
              setDeviceConnectionStatus("connected");
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

      currentSocket.onerror = () => {
        currentSocket.close();
      };

      currentSocket.onclose = () => {
        if (!active) {
          return;
        }

        if (activeSocket.current === currentSocket) {
          activeSocket.current = null;
        }
        setDeviceConnectionStatus("disconnected");
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
      if (activeSocket.current === socket) {
        activeSocket.current = null;
      }
    };
  }, [debugDisconnected, debugMode, pairedDevice]);

  const pairDevice = useCallback(
    async (device: PairedDevice) => {
      if (debugMode) {
        setDebugDisconnected(false);
        setPairedDevice(debugPairedDevice);
        return;
      }

      await savePairedDevice(device);
      setPairedDevice(device);
    },
    [debugMode],
  );

  const disconnectDevice = useCallback(async () => {
    if (debugMode) {
      setDebugDisconnected(true);
      setPairedDevice(null);
      setDeviceState(null);
      setDeviceConnectionStatus("disconnected");
      return;
    }

    await removePairedDevice();
    setPairedDevice(null);
  }, [debugMode]);

  const reportDeviceUnreachable = useCallback(() => {
    if (debugMode) {
      return;
    }

    setDeviceConnectionStatus("disconnected");
    activeSocket.current?.close();
  }, [debugMode]);

  const updateDeviceState = useCallback(
    (
      updater: (
        currentState: DeviceStateSnapshot | null,
      ) => DeviceStateSnapshot | null,
    ) => {
      setDeviceState((currentState) => updater(currentState));
    },
    [],
  );

  const value = useMemo<DeviceConnectionContextValue>(
    () => ({
      debugMode,
      disconnectDevice,
      deviceConnectionStatus,
      deviceState,
      isDeviceConnected: deviceConnectionStatus === "connected",
      isLoading,
      isPaired: pairedDevice !== null,
      pairDevice,
      pairedDevice,
      reportDeviceUnreachable,
      updateDeviceState,
    }),
    [
      debugMode,
      deviceConnectionStatus,
      deviceState,
      disconnectDevice,
      isLoading,
      pairDevice,
      pairedDevice,
      reportDeviceUnreachable,
      updateDeviceState,
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
