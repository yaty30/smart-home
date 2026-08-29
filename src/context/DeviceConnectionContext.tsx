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
import type { DeviceStateSnapshot, PairedDevice } from '../types/device';
import {
  deviceStateSnapshotToDeviceState,
  deviceStateToDeviceStateSnapshot,
  fetchControllerStatus,
  parseDeviceStateSnapshot,
} from '../services/controllerStatusService';

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
  const {
    applyControllerDeviceStatus,
    getDeviceById,
    markControllerDevicesOffline,
    markControllerDevicesSyncing,
    updateDeviceState: updateStoredDeviceState,
  } = useDevices();
  const {
    getControllerById,
    updateControllerConnectionStatus,
    updateControllerOnlineStatus,
  } = useControllers();

  const device = getDeviceById(deviceId);
  const controller = device ? getControllerById(device.controllerId) : undefined;

  const controllerId = controller?.id;
  const controllerExternalId = controller?.controllerId;
  const controllerIp = controller?.ip;
  const controllerName = controller?.name;
  const controllerRoomId = controller?.roomId;
  const controllerToken = controller?.token;

  const [deviceConnectionStatus, setDeviceConnectionStatus] =
    useState<DeviceConnectionStatus>('disconnected');
  const [debugState, setDebugState] =
    useState<DeviceStateSnapshot>(debugDeviceState);
  const reconnectAttempt = useRef(0);
  const activeSocket = useRef<WebSocket | null>(null);
  const restStatusReachable = useRef(false);

  const pairedDevice: PairedDevice | null = controller
    ? { host: controller.ip, token: controller.token }
    : null;

  const deviceState = useMemo(() => {
    if (debugMode) {
      return debugState;
    }

    if (!device || device.type !== 'ac') {
      return null;
    }

    return deviceStateToDeviceStateSnapshot(device.state);
  }, [debugMode, debugState, device]);

  useEffect(() => {
    if (!debugMode) {
      return;
    }

    const selectedDeviceState =
      device && device.type === 'ac'
        ? deviceStateToDeviceStateSnapshot(device.state)
        : null;
    setDebugState(selectedDeviceState ?? debugDeviceState);
  }, [debugMode, deviceId]);

  useEffect(() => {
    if (debugMode) {
      setDeviceConnectionStatus('connected');
      return;
    }

    if (!controllerIp || !controllerToken) {
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
    let websocketAuthenticated = false;

    const applyIncomingState = (payload: unknown) => {
      const snapshot = parseDeviceStateSnapshot(payload);
      if (snapshot !== null && active && controllerId) {
        applyControllerDeviceStatus(controllerId, snapshot);
        updateControllerConnectionStatus(controllerId, 'online');
      }
    };

    const loadRestStatus = async (): Promise<boolean> => {
      if (!controllerId) {
        return false;
      }

      try {
        const snapshot = await fetchControllerStatus({
          id: controllerId,
          controllerId: controllerExternalId ?? controllerId,
          ip: controllerIp,
          name: controllerName ?? 'Controller',
          online: true,
          roomId: controllerRoomId,
          token: controllerToken,
        });
        if (active && controllerId) {
          applyControllerDeviceStatus(controllerId, snapshot);
          updateControllerConnectionStatus(controllerId, 'online');
          setDeviceConnectionStatus('connected');
        }
        restStatusReachable.current = true;
        return true;
      } catch {
        restStatusReachable.current = false;
        if (active && controllerId && !websocketAuthenticated) {
          markControllerDevicesOffline(controllerId);
          updateControllerConnectionStatus(controllerId, 'offline');
          setDeviceConnectionStatus('disconnected');
        }
        return false;
      }
    };

    const connect = () => {
      if (!active) {
        return;
      }

      if (!restStatusReachable.current) {
        setDeviceConnectionStatus('connecting');
      }
      if (controllerId && !restStatusReachable.current) {
        updateControllerConnectionStatus(controllerId, 'connecting');
        markControllerDevicesSyncing(controllerId);
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
              websocketAuthenticated = true;
              reconnectAttempt.current = 0;
              console.log('[Device] Connected to controller');
              setDeviceConnectionStatus('connected');
              if (controllerId) {
                updateControllerOnlineStatus(controllerId, true);
              }
              void loadRestStatus();
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
        websocketAuthenticated = false;
        reconnectAttempt.current += 1;
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 10000);
        reconnectTimer = setTimeout(() => {
          void loadRestStatus().finally(connect);
        }, delay);
      };
    };

    reconnectAttempt.current = 0;
    restStatusReachable.current = false;
    void loadRestStatus().finally(connect);

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
  }, [
    applyControllerDeviceStatus,
    controllerId,
    controllerExternalId,
    controllerIp,
    controllerName,
    controllerRoomId,
    controllerToken,
    debugMode,
    markControllerDevicesOffline,
    markControllerDevicesSyncing,
    updateControllerConnectionStatus,
    updateControllerOnlineStatus,
  ]);

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
      updateControllerConnectionStatus(controllerId, 'offline');
      markControllerDevicesOffline(controllerId);
    }
  }, [
    controllerId,
    markControllerDevicesOffline,
    updateControllerConnectionStatus,
  ]);

  const updateDeviceState = useCallback(
    (
      updater: (
        currentState: DeviceStateSnapshot | null,
      ) => DeviceStateSnapshot | null,
    ) => {
      if (debugMode) {
        setDebugState((currentState) => updater(currentState) ?? currentState);
        return;
      }

      if (!device) {
        return;
      }

      const nextState = updater(deviceStateToDeviceStateSnapshot(device.state));
      if (nextState === null) {
        return;
      }

      updateStoredDeviceState(
        device.id,
        deviceStateSnapshotToDeviceState(nextState),
      );
    },
    [debugMode, device, updateStoredDeviceState],
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
