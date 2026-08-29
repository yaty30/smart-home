import { useCallback, useEffect, useRef, useState } from "react";

import {
  deleteAcScheduleFromDevice,
  getAcScheduleFromDevice,
  putAcScheduleToDevice,
} from "../api/acScheduleApi";
import { useDeviceConnection } from "../context/DeviceConnectionContext";
import {
  getAcSchedule,
  removeAcSchedule,
  saveAcSchedule,
} from "../storage/acScheduleStorage";
import type { AcSchedule } from "../types/acSchedule";

export function useAcSchedule() {
  const { debugMode, pairedDevice } = useDeviceConnection();
  const [schedule, setSchedule] = useState<AcSchedule | null>(null);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const mutationVersion = useRef(0);

  const deviceKey =
    pairedDevice === null ? null : `${pairedDevice.host}|${pairedDevice.token}`;

  useEffect(() => {
    if (pairedDevice === null) {
      setSchedule(null);
      setIsScheduleLoading(false);
      return;
    }

    let cancelled = false;
    const loadVersion = mutationVersion.current;
    setIsScheduleLoading(true);

    const loadSchedule = debugMode
      ? getAcSchedule(pairedDevice)
      : getAcScheduleFromDevice(pairedDevice);

    void loadSchedule
      .then((fetchedSchedule) => {
        if (cancelled || mutationVersion.current !== loadVersion) return;
        setSchedule(fetchedSchedule);
      })
      .catch(() => {
        if (cancelled || mutationVersion.current !== loadVersion) return;
        setSchedule(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsScheduleLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debugMode, deviceKey]);

  const saveSchedule = useCallback(
    async (nextSchedule: AcSchedule) => {
      if (pairedDevice === null) {
        throw new Error("No paired device available for schedule");
      }

      mutationVersion.current += 1;

      if (debugMode) {
        await saveAcSchedule(pairedDevice, nextSchedule);
        setSchedule(nextSchedule);
        return;
      }

      const savedSchedule = await putAcScheduleToDevice(
        pairedDevice,
        nextSchedule,
      );
      const scheduleWithDays = {
        ...savedSchedule,
        days: nextSchedule.days,
        powerful: nextSchedule.powerful,
        quiet: nextSchedule.quiet,
        repeatEnabled: nextSchedule.repeatEnabled,
        repeatFrequency: nextSchedule.repeatFrequency,
      };

      setSchedule(scheduleWithDays);
      void saveAcSchedule(pairedDevice, scheduleWithDays).catch(() => { });
    },
    [debugMode, pairedDevice],
  );

  const toggleScheduleEnabled = useCallback(
    async (enabled: boolean) => {
      if (schedule === null) {
        return;
      }

      await saveSchedule({
        ...schedule,
        enabled,
      });
    },
    [saveSchedule, schedule],
  );

  const deleteSchedule = useCallback(async () => {
    if (pairedDevice === null || schedule === null) {
      return;
    }

    mutationVersion.current += 1;

    try {
      if (debugMode) {
        await removeAcSchedule(pairedDevice);
        setSchedule(null);
        return;
      }

      await deleteAcScheduleFromDevice(pairedDevice);
      setSchedule(null);
      void removeAcSchedule(pairedDevice).catch(() => { });
    } catch (error) {
      console.warn("[Schedule] DELETE failed:", error);
    }
  }, [debugMode, pairedDevice, schedule]);

  return {
    deleteSchedule,
    isScheduleLoading,
    saveSchedule,
    schedule,
    toggleScheduleEnabled,
  };
}
