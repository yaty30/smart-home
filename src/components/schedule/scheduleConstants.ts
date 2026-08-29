import type {
  AcSchedule,
  ScheduleRepeatFrequency,
  ScheduleType,
} from "../../types/acSchedule";
import type { AirConditionerMode } from "../../types/airConditioner";

export type TimeField = "start" | "end";

export const NO_DAYS: boolean[] = [false, false, false, false, false, false, false];
export const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
export const DAY_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Day groups, indexed Mon–Sun (0–6) so weekday numbers read 1–7.
export type DayGroupId = "all" | "working" | "odd" | "even";

const daysFromIndices = (indices: number[]): boolean[] =>
  NO_DAYS.map((_, i) => indices.includes(i));

export const dayGroups: { id: DayGroupId; label: string; days: boolean[] }[] = [
  {
    id: "all",
    label: "All days",
    days: daysFromIndices([0, 1, 2, 3, 4, 5, 6]),
  },
  {
    id: "working",
    label: "Working days",
    days: daysFromIndices([0, 1, 2, 3, 4]),
  },
  { id: "odd", label: "Odd days", days: daysFromIndices([0, 2, 4, 6]) },
  { id: "even", label: "Even days", days: daysFromIndices([1, 3, 5]) },
];

// Exact match only — Mon–Fri plus Sunday matches no group.
export const matchDayGroup = (days: boolean[]): DayGroupId | null =>
  dayGroups.find((group) =>
    group.days.every((selected, i) => selected === (days[i] === true)),
  )?.id ?? null;

export const DEFAULT_START_TIME = "22:30";

export const createScheduleId = () =>
  `schedule-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

export const defaultSchedule: AcSchedule = {
  id: "draft",
  type: "schedule_time",
  enabled: true,
  startTime: DEFAULT_START_TIME,
  endTime: "23:30",
  days: [...NO_DAYS],
  mode: "cold",
  temperature: 24,
  fanSpeed: "auto",
  quiet: false,
  powerful: false,
  repeatEnabled: false,
  repeatFrequency: "one-time",
  horizontalAirflow: "auto",
  verticalAirflow: "auto",
};

export const scheduleTypeLabels: Record<ScheduleType, string> = {
  schedule_time: "Schedule Time",
  auto_on: "Auto Turn On",
  auto_off: "Auto Turn Off",
};

export const inferScheduleType = (
  schedule: Pick<AcSchedule, "startTime" | "endTime">,
): ScheduleType => {
  if (schedule.startTime !== null && schedule.endTime === null) {
    return "auto_on";
  }
  if (schedule.startTime === null && schedule.endTime !== null) {
    return "auto_off";
  }
  return "schedule_time";
};

export const normalizeScheduleForType = (
  schedule: AcSchedule,
  type: ScheduleType = schedule.type ?? inferScheduleType(schedule),
): AcSchedule => {
  const next: AcSchedule = { ...schedule, id: schedule.id, type };

  if (type === "schedule_time") {
    next.startTime = next.startTime ?? DEFAULT_START_TIME;
    next.endTime =
      next.endTime ??
      (next.startTime === DEFAULT_START_TIME ? "23:30" : DEFAULT_START_TIME);
  } else if (type === "auto_on") {
    next.startTime = next.startTime ?? DEFAULT_START_TIME;
    next.endTime = null;
  } else {
    next.startTime = null;
    next.endTime = next.endTime ?? DEFAULT_START_TIME;
  }

  return next;
};

export const createScheduleForType = (
  type: ScheduleType,
  source: AcSchedule = defaultSchedule,
): AcSchedule =>
  normalizeScheduleForType({ ...source, id: createScheduleId() }, type);

export const repeatOptions: { label: string; value: ScheduleRepeatFrequency }[] = [
  { label: "One time", value: "one-time" },
  { label: "Weekly", value: "weekly" },
  { label: "Bi-weekly", value: "bi-weekly" },
];

export const repeatLabels: Record<ScheduleRepeatFrequency, string> = {
  "one-time": "One time",
  weekly: "Weekly",
  "bi-weekly": "Bi-weekly",
};

export const MODE_OPTION_IDS: Exclude<AirConditionerMode, "fan">[] = [
  "auto",
  "cold",
  "dry",
  "heat",
];

// Field-by-field so a draft that only differs by object identity is not dirty.
export const isSameSchedule = (a: AcSchedule, b: AcSchedule) =>
  (a.type ?? inferScheduleType(a)) === (b.type ?? inferScheduleType(b)) &&
  a.id === b.id &&
  a.enabled === b.enabled &&
  a.startTime === b.startTime &&
  a.endTime === b.endTime &&
  a.mode === b.mode &&
  a.temperature === b.temperature &&
  (a.fanSpeed ?? "auto") === (b.fanSpeed ?? "auto") &&
  Boolean(a.quiet) === Boolean(b.quiet) &&
  Boolean(a.powerful) === Boolean(b.powerful) &&
  Boolean(a.repeatEnabled) === Boolean(b.repeatEnabled) &&
  (a.repeatFrequency ?? "one-time") === (b.repeatFrequency ?? "one-time") &&
  a.horizontalAirflow === b.horizontalAirflow &&
  a.verticalAirflow === b.verticalAirflow &&
  NO_DAYS.every((_, i) => (a.days[i] === true) === (b.days[i] === true));

export const formatRepeat = (schedule: AcSchedule) =>
  schedule.repeatEnabled
    ? repeatLabels[schedule.repeatFrequency ?? "weekly"]
    : repeatLabels["one-time"];
