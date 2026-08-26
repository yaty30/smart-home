import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Controller } from '../domain/controller';

type ControllersContextValue = {
  controllers: Controller[];
  isLoading: boolean;
  addController: (controller: Controller) => Promise<void>;
  removeController: (controllerId: string) => Promise<void>;
  updateControllerOnlineStatus: (controllerId: string, online: boolean) => void;
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

export function ControllersProvider({ children }: PropsWithChildren) {
  const [controllers, setControllers] = useState<Controller[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadControllers = async () => {
      try {
        const stored = await AsyncStorage.getItem(CONTROLLERS_STORAGE_KEY);
        if (stored && isMounted) {
          const parsed = JSON.parse(stored) as unknown;
          if (isControllerArray(parsed)) {
            setControllers(parsed);
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
    try {
      await AsyncStorage.setItem(CONTROLLERS_STORAGE_KEY, JSON.stringify(controllersToSave));
    } catch (error) {
      console.warn('Failed to persist controllers:', error);
    }
  }, []);

  const addController = useCallback(
    async (controller: Controller) => {
      const updated = [...controllers, controller];
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
      current.map((c) => (c.id === controllerId ? { ...c, online } : c))
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
      getControllerById,
      getControllerByControllerId,
    }),
    [controllers, isLoading, addController, removeController, updateControllerOnlineStatus, getControllerById, getControllerByControllerId]
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
