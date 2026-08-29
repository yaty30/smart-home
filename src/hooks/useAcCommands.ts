import { useCallback, useEffect, useRef } from "react";

import {
  type AcCommandParams,
  describeAcCommand,
  sendAcCommandToDevice,
} from "../api/acCommandApi";
import { useDeviceConnection } from "../context/DeviceConnectionContext";
import type { DeviceStateSnapshot } from "../types/device";

const TEMPERATURE_COMMAND_DEBOUNCE_MS = 400;

function logDroppedCommand(description: string) {
  console.log(
    `[Device] Dropped command because ESP32 is offline: ${description}`,
  );
}

type UseAcCommandsOptions = {
  canControlDevice: boolean;
};

export function useAcCommands({ canControlDevice }: UseAcCommandsOptions) {
  const { debugMode, pairedDevice, reportDeviceUnreachable, updateDeviceState } =
    useDeviceConnection();
  const temperatureCommandTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const updateAcSnapshot = useCallback(
    (acPatch: Partial<DeviceStateSnapshot["ac"]>) => {
      updateDeviceState((currentState) =>
        currentState === null
          ? currentState
          : {
            ...currentState,
            ac: {
              ...currentState.ac,
              ...acPatch,
            },
          },
      );
    },
    [updateDeviceState],
  );

  const sendAcCommand = useCallback(
    async (params: AcCommandParams) => {
      const description = describeAcCommand(params);

      if (!canControlDevice || pairedDevice === null) {
        logDroppedCommand(description);
        return false;
      }

      if (debugMode) {
        console.log(`[Device] Debug command accepted: ${description}`);
        return true;
      }

      try {
        console.log(`[Device] Command sent immediately: ${description}`);
        return await sendAcCommandToDevice(pairedDevice, params);
      } catch (error) {
        console.warn("ESP32 AC request failed without retry.", error);
        reportDeviceUnreachable();
        return false;
      }
    },
    [
      canControlDevice,
      debugMode,
      pairedDevice,
      reportDeviceUnreachable,
    ],
  );

  const clearTemperatureCommandTimer = useCallback(() => {
    if (temperatureCommandTimer.current !== null) {
      clearTimeout(temperatureCommandTimer.current);
      temperatureCommandTimer.current = null;
    }
  }, []);

  const sendTemperatureCommandDebounced = useCallback(
    (nextTemperature: number) => {
      clearTemperatureCommandTimer();
      temperatureCommandTimer.current = setTimeout(() => {
        temperatureCommandTimer.current = null;

        if (!canControlDevice) {
          logDroppedCommand(`temp=${nextTemperature}`);
          return;
        }

        void sendAcCommand({
          temp: nextTemperature,
        });
      }, TEMPERATURE_COMMAND_DEBOUNCE_MS);
    },
    [canControlDevice, clearTemperatureCommandTimer, sendAcCommand],
  );

  useEffect(() => {
    return clearTemperatureCommandTimer;
  }, [clearTemperatureCommandTimer]);

  return {
    clearTemperatureCommandTimer,
    logDroppedCommand,
    sendAcCommand,
    sendTemperatureCommandDebounced,
    updateAcSnapshot,
  };
}
