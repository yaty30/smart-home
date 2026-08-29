import { useCallback, useEffect, useRef, useState } from "react";

import {
  deleteAcSchedulesFromDevice,
  getAcSchedulesFromDevice,
  putAcSchedulesToDevice,
} from "../api/acScheduleApi";
import { useDeviceConnection } from "../context/DeviceConnectionContext";
import {
  getAcSchedules,
  removeAcSchedules,
  saveAcSchedules,
} from "../storage/acScheduleStorage";
import { MAX_AC_SCHEDULES, type AcSchedule } from "../types/acSchedule";

export function useAcSchedule() {
  const { debugMode, pairedDevice } = useDeviceConnection();
  const [schedules, setSchedules] = useState<AcSchedule[]>([]);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const mutationVersion = useRef(0);

  const deviceKey =
    pairedDevice === null ? null : `${pairedDevice.host}|${pairedDevice.token}`;

  useEffect(() => {
    if (pairedDevice === null) {
      setSchedules([]);
      setIsScheduleLoading(false);
      return;
    }

    let cancelled = false;
    const loadVersion = mutationVersion.current;
    setIsScheduleLoading(true);

    const loadSchedule = debugMode
      ? getAcSchedules(pairedDevice)
      : getAcSchedulesFromDevice(pairedDevice);

    void loadSchedule
      .then((fetchedSchedule) => {
        if (cancelled || mutationVersion.current !== loadVersion) return;
        setSchedules(fetchedSchedule);
      })
      .catch(() => {
        if (cancelled || mutationVersion.current !== loadVersion) return;
        setSchedules([]);
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
      const exists = schedules.some((schedule) => schedule.id === nextSchedule.id);
      const nextSchedules = exists
        ? schedules.map((schedule) =>
            schedule.id === nextSchedule.id ? nextSchedule : schedule,
          )
        : schedules.length >= MAX_AC_SCHEDULES
          ? schedules
          : [...schedules, nextSchedule];

      if (!exists && schedules.length >= MAX_AC_SCHEDULES) {
        throw new Error(`A maximum of ${MAX_AC_SCHEDULES} schedules is allowed`);
      }

      if (debugMode) {
        await saveAcSchedules(pairedDevice, nextSchedules);
        setSchedules(nextSchedules);
        return;
      }

      const savedSchedules = await putAcSchedulesToDevice(
        pairedDevice,
        nextSchedules,
      );
      setSchedules(savedSchedules);
      void saveAcSchedules(pairedDevice, savedSchedules).catch(() => { });
    },
    [debugMode, pairedDevice, schedules],
  );

  const toggleScheduleEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      const schedule = schedules.find((item) => item.id === id);
      if (schedule === undefined) return;

      await saveSchedule({
        ...schedule,
        enabled,
      });
    },
    [saveSchedule, schedules],
  );

  const deleteSchedule = useCallback(async (id: string) => {
    if (pairedDevice === null) {
      return;
    }

    const nextSchedules = schedules.filter((schedule) => schedule.id !== id);
    if (nextSchedules.length === schedules.length) return;

    mutationVersion.current += 1;

    try {
      if (debugMode) {
        await saveAcSchedules(pairedDevice, nextSchedules);
        setSchedules(nextSchedules);
        return;
      }

      if (nextSchedules.length === 0) {
        await deleteAcSchedulesFromDevice(pairedDevice);
        setSchedules([]);
        void removeAcSchedules(pairedDevice).catch(() => { });
        return;
      }

      const savedSchedules = await putAcSchedulesToDevice(
        pairedDevice,
        nextSchedules,
      );
      setSchedules(savedSchedules);
      void saveAcSchedules(pairedDevice, savedSchedules).catch(() => { });
    } catch (error) {
      console.warn("[Schedule] DELETE failed:", error);
    }
  }, [debugMode, pairedDevice, schedules]);

  return {
    deleteSchedule,
    isScheduleLoading,
    saveSchedule,
    schedules,
    toggleScheduleEnabled,
  };
}
