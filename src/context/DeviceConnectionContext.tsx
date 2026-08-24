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

import type {
  DeviceStateSnapshot,
  EspAcMode,
  EspAirflow,
  EspFanSpeed,
} from "../types/device";
import type { HomeDevice } from "../types/home";
import { useHomeData } from "./HomeDataContext";

export type DeviceConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected";

export type DeviceRuntime = {
  status: DeviceConnectionStatus;
  state: DeviceStateSnapshot | null;
};

export const OFFLINE_RUNTIME: DeviceRuntime = {
  state: null,
  status: "disconnected",
};

type CommandParams = Record<string, string | number>;

type DeviceConnectionContextValue = {
  runtimeById: Record<string, DeviceRuntime>;
  getRuntime: (deviceId: string) => DeviceRuntime;
  updateAcState: (
    deviceId: string,
    patch: Partial<DeviceStateSnapshot["ac"]>,
  ) => void;
  updateDisplayState: (
    deviceId: string,
    patch: Partial<DeviceStateSnapshot["display"]>,
  ) => void;
  sendAcCommand: (deviceId: string, params: CommandParams) => Promise<boolean>;
  sendDisplayCommand: (
    deviceId: string,
    params: CommandParams,
  ) => Promise<boolean>;
};

const DeviceConnectionContext =
  createContext<DeviceConnectionContextValue | null>(null);

const COMMAND_TIMEOUT_MS = 1500;
const STATUS_POLL_INTERVAL_MS = 10000;
const MAX_RECONNECT_DELAY_MS = 10000;

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

const baseUrlForHost = (host: string) => host.replace(/\/+$/, "");

const websocketUrlForHost = (host: string) => {
  const url = new URL(host);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.port = "81";
  url.pathname = "/ws";
  url.search = "";
  url.hash = "";
  return url.toString();
};

type DeviceSocketProps = {
  device: HomeDevice;
  onStateChange: (deviceId: string, state: DeviceStateSnapshot) => void;
  onStatusChange: (deviceId: string, status: DeviceConnectionStatus) => void;
};

/**
 * Keeps one ESP32 in sync: the WebSocket pushes state changes instantly while
 * the periodic /status poll doubles as a liveness check.
 */
function DeviceSocket({
  device,
  onStateChange,
  onStatusChange,
}: DeviceSocketProps) {
  const { host, id, token } = device;

  useEffect(() => {
    let isActive = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let isSocketOpen = false;
    const baseUrl = baseUrlForHost(host);

    // Reaching the REST API is what actually makes a device controllable, so
    // the WebSocket dropping alone must not report the device as offline.
    const pollStatus = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), COMMAND_TIMEOUT_MS);

      try {
        const response = await fetch(`${baseUrl}/status`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!isActive) {
          return;
        }

        if (!response.ok) {
          onStatusChange(id, "disconnected");
          return;
        }

        const snapshot = parseDeviceState((await response.json()) as unknown);

        if (snapshot !== null && !isSocketOpen) {
          onStateChange(id, snapshot);
        }

        onStatusChange(id, "connected");
      } catch {
        if (isActive) {
          onStatusChange(id, "disconnected");
        }
      } finally {
        clearTimeout(timeout);
      }
    };

    const scheduleReconnect = () => {
      reconnectAttempt += 1;
      const delay = Math.min(
        1000 * 2 ** reconnectAttempt,
        MAX_RECONNECT_DELAY_MS,
      );
      reconnectTimer = setTimeout(() => {
        void pollStatus();
        connect();
      }, delay);
    };

    const connect = () => {
      if (!isActive) {
        return;
      }

      try {
        socket = new WebSocket(websocketUrlForHost(host));
      } catch {
        scheduleReconnect();
        return;
      }

      const currentSocket = socket;

      currentSocket.onopen = () => {
        currentSocket.send(JSON.stringify({ token, type: "auth" }));
      };

      currentSocket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as unknown;

          if (!isRecord(payload)) {
            return;
          }

          if (payload.type === "auth.result") {
            if (payload.ok === true) {
              reconnectAttempt = 0;
              isSocketOpen = true;
              onStatusChange(id, "connected");
            }
            return;
          }

          if (payload.type === "state") {
            const snapshot = parseDeviceState(payload);

            if (snapshot !== null && isActive) {
              onStateChange(id, snapshot);
            }
          }
        } catch {
          console.warn(`ESP32 ${host} sent an invalid WebSocket message.`);
        }
      };

      currentSocket.onerror = () => {
        currentSocket.close();
      };

      currentSocket.onclose = () => {
        isSocketOpen = false;

        if (!isActive) {
          return;
        }

        void pollStatus();
        scheduleReconnect();
      };
    };

    onStatusChange(id, "connecting");
    void pollStatus();
    connect();

    const pollTimer = setInterval(() => {
      void pollStatus();
    }, STATUS_POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      clearInterval(pollTimer);

      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }

      socket?.close();
    };
  }, [host, id, onStateChange, onStatusChange, token]);

  return null;
}

export function DeviceConnectionProvider({ children }: PropsWithChildren) {
  const { devices } = useHomeData();
  const [runtimeById, setRuntimeById] = useState<Record<string, DeviceRuntime>>(
    {},
  );
  const devicesRef = useRef(devices);
  devicesRef.current = devices;

  // Drop runtime entries for devices that are no longer part of the home.
  useEffect(() => {
    setRuntimeById((currentRuntimes) => {
      const deviceIds = new Set(devices.map((device) => device.id));
      const staleIds = Object.keys(currentRuntimes).filter(
        (deviceId) => !deviceIds.has(deviceId),
      );

      if (staleIds.length === 0) {
        return currentRuntimes;
      }

      const nextRuntimes = { ...currentRuntimes };
      staleIds.forEach((deviceId) => delete nextRuntimes[deviceId]);
      return nextRuntimes;
    });
  }, [devices]);

  const handleStateChange = useCallback(
    (deviceId: string, state: DeviceStateSnapshot) => {
      setRuntimeById((currentRuntimes) => ({
        ...currentRuntimes,
        [deviceId]: {
          state,
          status: currentRuntimes[deviceId]?.status ?? "connecting",
        },
      }));
    },
    [],
  );

  const handleStatusChange = useCallback(
    (deviceId: string, status: DeviceConnectionStatus) => {
      setRuntimeById((currentRuntimes) => {
        if (currentRuntimes[deviceId]?.status === status) {
          return currentRuntimes;
        }

        return {
          ...currentRuntimes,
          [deviceId]: {
            state: currentRuntimes[deviceId]?.state ?? null,
            status,
          },
        };
      });
    },
    [],
  );

  const getRuntime = useCallback(
    (deviceId: string) => runtimeById[deviceId] ?? OFFLINE_RUNTIME,
    [runtimeById],
  );

  const updateAcState = useCallback(
    (deviceId: string, patch: Partial<DeviceStateSnapshot["ac"]>) => {
      setRuntimeById((currentRuntimes) => {
        const runtime = currentRuntimes[deviceId];

        if (runtime?.state == null) {
          return currentRuntimes;
        }

        return {
          ...currentRuntimes,
          [deviceId]: {
            ...runtime,
            state: { ...runtime.state, ac: { ...runtime.state.ac, ...patch } },
          },
        };
      });
    },
    [],
  );

  const updateDisplayState = useCallback(
    (deviceId: string, patch: Partial<DeviceStateSnapshot["display"]>) => {
      setRuntimeById((currentRuntimes) => {
        const runtime = currentRuntimes[deviceId];

        if (runtime?.state == null) {
          return currentRuntimes;
        }

        return {
          ...currentRuntimes,
          [deviceId]: {
            ...runtime,
            state: {
              ...runtime.state,
              display: { ...runtime.state.display, ...patch },
            },
          },
        };
      });
    },
    [],
  );

  const sendCommand = useCallback(
    async (deviceId: string, path: string, params: CommandParams) => {
      const description = Object.entries(params)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(",");
      const device = devicesRef.current.find(
        (currentDevice) => currentDevice.id === deviceId,
      );

      if (device === undefined) {
        console.log(`[Device] Dropped command for unknown device: ${description}`);
        return false;
      }

      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), COMMAND_TIMEOUT_MS);

      try {
        const response = await fetch(
          `${baseUrlForHost(device.host)}${path}?${searchParams.toString()}`,
          {
            headers: { Authorization: `Bearer ${device.token}` },
            method: "GET",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          console.warn(
            `ESP32 ${path} request failed for ${device.name}`,
            response.status,
          );
          return false;
        }

        handleStatusChange(deviceId, "connected");
        return true;
      } catch (error) {
        console.warn(`ESP32 ${path} request failed without retry.`, error);
        handleStatusChange(deviceId, "disconnected");
        return false;
      } finally {
        clearTimeout(timeout);
      }
    },
    [handleStatusChange],
  );

  const sendAcCommand = useCallback(
    (deviceId: string, params: CommandParams) =>
      sendCommand(deviceId, "/ac", params),
    [sendCommand],
  );

  const sendDisplayCommand = useCallback(
    (deviceId: string, params: CommandParams) =>
      sendCommand(deviceId, "/display", params),
    [sendCommand],
  );

  const value = useMemo<DeviceConnectionContextValue>(
    () => ({
      getRuntime,
      runtimeById,
      sendAcCommand,
      sendDisplayCommand,
      updateAcState,
      updateDisplayState,
    }),
    [
      getRuntime,
      runtimeById,
      sendAcCommand,
      sendDisplayCommand,
      updateAcState,
      updateDisplayState,
    ],
  );

  return (
    <DeviceConnectionContext.Provider value={value}>
      {devices.map((device) => (
        <DeviceSocket
          device={device}
          key={device.id}
          onStateChange={handleStateChange}
          onStatusChange={handleStatusChange}
        />
      ))}
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
