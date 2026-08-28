import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDevices } from '../store/devices';
import { useControllers } from '../store/controllers';
import type {
  DeviceStateSnapshot,
  EspAcMode,
  EspAirflow,
  EspFanSpeed,
  PairedDevice,
} from '../types/device';

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
  | 'connecting'
  | 'connected'
  | 'disconnected';

type DeviceConnectionProviderProps = PropsWithChildren<{
  deviceId: string;
  debugMode?: boolean;
}>;

const debugPairedDevice: PairedDevice = {
  host: 'http://debug-device.local',
  token: 'debug-token',
};

const debugDeviceState: DeviceStateSnapshot = {
  ac: {
    fan: 'auto',
    mode: 'auto',
    power: true,
    quiet: false,
    powerful: false,
    swingHorizontal: 'auto',
    swingVertical: 'auto',
    temperature: 24,
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isEspAcMode = (value: unknown): value is EspAcMode => {
  return (
    typeof value === 'string' &&
    ['auto', 'cool', 'dry', 'fan', 'heat'].includes(value)
  );
};

const isEspFanSpeed = (value: unknown): value is EspFanSpeed => {
  return (
    typeof value === 'string' &&
    ['auto', '1', '2', '3', '4', '5'].includes(value)
  );
};

const isEspAirflow = (value: unknown): value is EspAirflow => {
  return (
    typeof value === 'string' &&
    ['auto', '1', '2', '3', '4', '5'].includes(value)
  );
};

const parseDeviceState = (value: unknown): DeviceStateSnapshot | null => {
  if (!isRecord(value) || !isRecord(value.ac)) {
    return null;
  }

  const ac = value.ac;
  if (
    typeof ac.power !== 'boolean' ||
    typeof ac.temperature !== 'number' ||
    !isEspAcMode(ac.mode) ||
    !isEspFanSpeed(ac.fan) ||
    !isEspAirflow(ac.swingVertical) ||
    !isEspAirflow(ac.swingHorizontal)
  ) {
    return null;
  }

  return {
    ac: {
      fan: ac.fan,
      mode: ac.mode,
      power: ac.power,
      quiet: typeof ac.quiet === 'boolean' ? ac.quiet : false,
      powerful: typeof ac.powerful === 'boolean' ? ac.powerful : false,
      swingHorizontal: ac.swingHorizontal,
      swingVertical: ac.swingVertical,
      temperature: ac.temperature,
    },
  };
};

const websocketUrlForDevice = (device: PairedDevice) => {
  const url = new URL(device.host);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.port = '81';
  url.pathname = '/ws';
  url.search = '';
  url.hash = '';
  return url.toString();
};

export function DeviceConnectionProvider({
  children,
  deviceId,
  debugMode = false,
}: DeviceConnectionProviderProps) {
  const { getDeviceById } = useDevices();
  const { getControllerById, updateControllerOnlineStatus } = useControllers();

  const device = getDeviceById(deviceId);
  const controller = device ? getControllerById(device.controllerId) : undefined;

  const controllerId = controller?.id;
  const controllerIp = controller?.ip;
  const controllerToken = controller?.token;

  const [deviceConnectionStatus, setDeviceConnectionStatus] =
    useState<DeviceConnectionStatus>('disconnected');
  const [deviceState, setDeviceState] = useState<DeviceStateSnapshot | null>(null);
  const reconnectAttempt = useRef(0);
  const activeSocket = useRef<WebSocket | null>(null);

  const pairedDevice: PairedDevice | null = controller
    ? { host: controller.ip, token: controller.token }
    : null;

  useEffect(() => {
    if (debugMode) {
      setDeviceState(debugDeviceState);
      setDeviceConnectionStatus('connected');
      return;
    }

    if (!controllerIp || !controllerToken) {
      setDeviceState(null);
      setDeviceConnectionStatus('disconnected');
      return;
    }

    const pairedDevice: PairedDevice = {
      host: controllerIp,
      token: controllerToken,
    };

    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const host = pairedDevice.host.replace(/\/+$/, '');

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
        // WebSocket retry will handle recovery
      }
    };

    const connect = () => {
      if (!active) {
        return;
      }

      setDeviceConnectionStatus('connecting');
      if (controllerId) {
        updateControllerOnlineStatus(controllerId, false);
      }

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
            type: 'auth',
          }),
        );
      };

      currentSocket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as unknown;
          if (isRecord(payload) && payload.type === 'auth.result') {
            if (payload.ok === true) {
              reconnectAttempt.current = 0;
              console.log('[Device] Connected to controller');
              setDeviceConnectionStatus('connected');
              if (controllerId) {
                updateControllerOnlineStatus(controllerId, true);
              }
            }
            return;
          }

          if (isRecord(payload) && payload.type === 'state') {
            applyIncomingState(payload);
          }
        } catch {
          console.warn('ESP32 sent invalid WebSocket message');
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
        setDeviceConnectionStatus('disconnected');
        if (controllerId) {
          updateControllerOnlineStatus(controllerId, false);
        }
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
  }, [controllerIp, controllerToken, controllerId, debugMode, updateControllerOnlineStatus]);

  const pairDevice = useCallback(async () => {
    // Not implemented in v2 - pairing happens at controller level
  }, []);

  const disconnectDevice = useCallback(async () => {
    // Not implemented in v2 - managed at controller level
  }, []);

  const reportDeviceUnreachable = useCallback(() => {
    setDeviceConnectionStatus('disconnected');
    activeSocket.current?.close();
    if (controllerId) {
      updateControllerOnlineStatus(controllerId, false);
    }
  }, [controllerId, updateControllerOnlineStatus]);

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
      isDeviceConnected: deviceConnectionStatus === 'connected',
      isLoading: false,
      isPaired: pairedDevice !== null,
      pairDevice,
      pairedDevice: debugMode ? debugPairedDevice : pairedDevice,
      reportDeviceUnreachable,
      updateDeviceState,
    }),
    [
      debugMode,
      deviceConnectionStatus,
      deviceState,
      disconnectDevice,
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
      'useDeviceConnection must be used inside DeviceConnectionProvider',
    );
  }

  return context;
}
