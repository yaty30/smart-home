import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Controller, ControllerConnectionStatus } from '../domain/controller';
import { isDebugMode } from '../config/debug';
import { DEBUG_CONTROLLERS } from './debugData';

type ControllersContextValue = {
  controllers: Controller[];
  isLoading: boolean;
  addController: (controller: Controller) => Promise<void>;
  removeController: (controllerId: string) => Promise<void>;
  updateControllerOnlineStatus: (controllerId: string, online: boolean) => void;
  updateControllerConnectionStatus: (
    controllerId: string,
    status: ControllerConnectionStatus,
  ) => void;
  getControllerById: (controllerId: string) => Controller | undefined;
  getControllerByControllerId: (controllerId: string) => Controller | undefined;
};

const ControllersContext = createContext<ControllersContextValue | null>(null);

const CONTROLLERS_STORAGE_KEY = 'smartHome.controllers';

const isControllerArray = (value: unknown): value is Controller[] => {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'string' &&
      typeof item.controllerId === 'string' &&
      typeof item.name === 'string' &&
      typeof item.ip === 'string' &&
      typeof item.token === 'string' &&
      typeof item.online === 'boolean'
  );
};

const sanitizeControllerForRuntime = (controller: Controller): Controller => ({
  ...controller,
  online: false,
  connectionStatus: 'unknown',
});

const sanitizeControllerForStorage = (controller: Controller): Controller => {
  const { connectionStatus: _connectionStatus, ...storedController } = controller;
  return {
    ...storedController,
    online: false,
  };
};

export function ControllersProvider({ children }: PropsWithChildren) {
  const [controllers, setControllers] = useState<Controller[]>(
    isDebugMode ? DEBUG_CONTROLLERS : []
  );
  const [isLoading, setIsLoading] = useState(!isDebugMode);

  useEffect(() => {
    if (isDebugMode) {
      return undefined;
    }

    let isMounted = true;

    const loadControllers = async () => {
      try {
        const stored = await AsyncStorage.getItem(CONTROLLERS_STORAGE_KEY);
        if (stored && isMounted) {
          const parsed = JSON.parse(stored) as unknown;
          if (isControllerArray(parsed)) {
            const sanitized = parsed.map(sanitizeControllerForRuntime);
            setControllers(sanitized);
            void AsyncStorage.setItem(
              CONTROLLERS_STORAGE_KEY,
              JSON.stringify(sanitized.map(sanitizeControllerForStorage)),
            ).catch((error) => {
              console.warn('Failed to clean persisted controllers:', error);
            });
          }
        }
      } catch (error) {
        console.warn('Failed to load controllers:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadControllers();

    return () => {
      isMounted = false;
    };
  }, []);

  const persistControllers = useCallback(async (controllersToSave: Controller[]) => {
    if (isDebugMode) {
      return;
    }

    try {
      await AsyncStorage.setItem(
        CONTROLLERS_STORAGE_KEY,
        JSON.stringify(controllersToSave.map(sanitizeControllerForStorage)),
      );
    } catch (error) {
      console.warn('Failed to persist controllers:', error);
    }
  }, []);

  const addController = useCallback(
    async (controller: Controller) => {
      const updated = [...controllers, sanitizeControllerForRuntime(controller)];
      setControllers(updated);
      await persistControllers(updated);
    },
    [controllers, persistControllers]
  );

  const removeController = useCallback(
    async (controllerId: string) => {
      const updated = controllers.filter((c) => c.id !== controllerId);
      setControllers(updated);
      await persistControllers(updated);
    },
    [controllers, persistControllers]
  );

  const updateControllerOnlineStatus = useCallback((controllerId: string, online: boolean) => {
    setControllers((current) =>
      current.map((c) => {
        if (c.id !== controllerId) {
          return c;
        }

        const connectionStatus = online ? 'online' : 'offline';
        if (c.online === online && c.connectionStatus === connectionStatus) {
          return c;
        }

        return { ...c, online, connectionStatus };
      })
    );
  }, []);

  const updateControllerConnectionStatus = useCallback((
    controllerId: string,
    status: ControllerConnectionStatus,
  ) => {
    setControllers((current) =>
      current.map((c) => {
        if (c.id !== controllerId) {
          return c;
        }

        const online = status === 'online';
        if (c.online === online && c.connectionStatus === status) {
          return c;
        }

        return { ...c, online, connectionStatus: status };
      })
    );
  }, []);

  const getControllerById = useCallback(
    (controllerId: string) => {
      return controllers.find((c) => c.id === controllerId);
    },
    [controllers]
  );

  const getControllerByControllerId = useCallback(
    (controllerId: string) => {
      return controllers.find((c) => c.controllerId === controllerId);
    },
    [controllers]
  );

  const value = useMemo(
    () => ({
      controllers,
      isLoading,
      addController,
      removeController,
      updateControllerOnlineStatus,
      updateControllerConnectionStatus,
      getControllerById,
      getControllerByControllerId,
    }),
    [
      controllers,
      isLoading,
      addController,
      removeController,
      updateControllerOnlineStatus,
      updateControllerConnectionStatus,
      getControllerById,
      getControllerByControllerId,
    ]
  );

  return (
    <ControllersContext.Provider value={value}>
      {children}
    </ControllersContext.Provider>
  );
}

export function useControllers() {
  const context = useContext(ControllersContext);
  if (context === null) {
    throw new Error('useControllers must be used within a ControllersProvider');
  }
  return context;
}
