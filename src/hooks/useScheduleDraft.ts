import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TEMPERATURE_RANGES } from "../constants/acModes";
import {
  DEFAULT_START_TIME,
  isSameSchedule,
  type TimeField,
} from "../components/schedule/scheduleConstants";
import type {
  AcSchedule,
  ScheduleAirflow,
  ScheduleFanSpeed,
  ScheduleRepeatFrequency,
} from "../types/acSchedule";
import type { AirConditionerMode } from "../types/airConditioner";
import {
  addMinutesToTimeString,
  timeStringFromDate,
} from "../utils/timeFormat";
import { normalizeTemperature } from "../utils/temperatureGauge";

type ScheduleMode = Exclude<AirConditionerMode, "fan">;

const selectionHaptic = () => {
  Haptics.selectionAsync().catch(() => undefined);
};

/**
 * Draft state for the schedule editor: a copy of the persisted schedule that
 * only the Save button commits. `initial` is re-read whenever the editor opens
 * so a dismissed draft is discarded.
 */
export function useScheduleDraft(initial: AcSchedule, visible: boolean) {
  const [draft, setDraft] = useState<AcSchedule>(initial);
  const [baseline, setBaseline] = useState<AcSchedule>(initial);
  const [activeTimePicker, setActiveTimePicker] = useState<TimeField>("start");

  useEffect(() => {
    if (!visible) return;
    setDraft(initial);
    setBaseline(initial);
    setActiveTimePicker(initial.startTime === null ? "end" : "start");
  }, [visible, initial]);

  const isDirty = useMemo(
    () => !isSameSchedule(draft, baseline),
    [draft, baseline],
  );

  const temperatureRange = useMemo(
    () => TEMPERATURE_RANGES[draft.mode] ?? TEMPERATURE_RANGES.auto,
    [draft.mode],
  );

  const handleTimeChange = useCallback(
    (_: unknown, date?: Date) => {
      if (!date) return;
      const key = activeTimePicker === "start" ? "startTime" : "endTime";
      setDraft((prev) => ({ ...prev, [key]: timeStringFromDate(date) }));
    },
    [activeTimePicker],
  );

  const handleSelectStartTime = useCallback(() => {
    setActiveTimePicker("start");
    setDraft((prev) => ({
      ...prev,
      startTime:
        prev.startTime ??
        (prev.endTime === null
          ? DEFAULT_START_TIME
          : addMinutesToTimeString(prev.endTime, -60)),
    }));
  }, []);

  const handleSelectEndTime = useCallback(() => {
    setActiveTimePicker("end");
    setDraft((prev) => ({
      ...prev,
      endTime:
        prev.endTime ??
        (prev.startTime === null
          ? DEFAULT_START_TIME
          : addMinutesToTimeString(prev.startTime, 60)),
    }));
  }, []);

  // A schedule needs at least one time, so clearing one requires the other.
  const handleClearStartTime = useCallback(() => {
    selectionHaptic();
    setActiveTimePicker("end");
    setDraft((prev) => ({ ...prev, startTime: null }));
  }, []);

  const handleClearEndTime = useCallback(() => {
    selectionHaptic();
    setActiveTimePicker("start");
    setDraft((prev) => ({ ...prev, endTime: null }));
  }, []);

  const handleToggleQuiet = useCallback(() => {
    selectionHaptic();
    setDraft((prev) => {
      const quiet = !Boolean(prev.quiet);
      return { ...prev, quiet, powerful: quiet ? false : prev.powerful };
    });
  }, []);

  const handleTogglePowerful = useCallback(() => {
    selectionHaptic();
    setDraft((prev) => {
      const powerful = !Boolean(prev.powerful);
      return { ...prev, powerful, quiet: powerful ? false : prev.quiet };
    });
  }, []);

  const handleToggleDay = useCallback((i: number) => {
    selectionHaptic();
    setDraft((prev) => {
      const days = [...prev.days];
      days[i] = !days[i];
      return { ...prev, days };
    });
  }, []);

  const handleSelectDayGroup = useCallback((days: boolean[]) => {
    selectionHaptic();
    setDraft((prev) => ({ ...prev, days: [...days] }));
  }, []);

  const handleSelectRepeatFrequency = useCallback(
    (repeatFrequency: ScheduleRepeatFrequency) => {
      selectionHaptic();
      setDraft((prev) => ({
        ...prev,
        repeatEnabled: repeatFrequency !== "one-time",
        repeatFrequency,
      }));
    },
    [],
  );

  const handleSelectMode = useCallback((mode: ScheduleMode) => {
    const nextRange = TEMPERATURE_RANGES[mode];

    setDraft((prev) => ({
      ...prev,
      mode,
      temperature: Math.min(
        Math.max(prev.temperature, nextRange.min),
        nextRange.max,
      ),
    }));
  }, []);

  const handleChangeTemperature = useCallback(
    (temperature: number) => {
      setDraft((prev) => ({
        ...prev,
        temperature: normalizeTemperature(
          temperature,
          temperatureRange.min,
          temperatureRange.max,
        ),
      }));
    },
    [temperatureRange.max, temperatureRange.min],
  );

  const handleChangeFanSpeed = useCallback((fanSpeed: ScheduleFanSpeed) => {
    setDraft((prev) => ({ ...prev, fanSpeed }));
  }, []);

  const handleChangeVerticalAirflow = useCallback(
    (verticalAirflow: ScheduleAirflow) => {
      setDraft((prev) => ({ ...prev, verticalAirflow }));
    },
    [],
  );

  const handleChangeHorizontalAirflow = useCallback(
    (horizontalAirflow: ScheduleAirflow) => {
      setDraft((prev) => ({ ...prev, horizontalAirflow }));
    },
    [],
  );

  return {
    draft,
    isDirty,
    activeTimePicker,
    temperatureRange,
    hasAnyTime: draft.startTime !== null || draft.endTime !== null,
    handleTimeChange,
    handleSelectStartTime,
    handleSelectEndTime,
    handleClearStartTime,
    handleClearEndTime,
    handleToggleQuiet,
    handleTogglePowerful,
    handleToggleDay,
    handleSelectDayGroup,
    handleSelectRepeatFrequency,
    handleSelectMode,
    handleChangeTemperature,
    handleChangeFanSpeed,
    handleChangeVerticalAirflow,
    handleChangeHorizontalAirflow,
  };
}
