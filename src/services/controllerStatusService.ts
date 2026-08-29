import type { Controller } from "../domain/controller";
import type { DeviceState } from "../domain/device";
import type {
  DeviceStateSnapshot,
  EspAcMode,
  EspAirflow,
  EspFanSpeed,
} from "../types/device";

export type { DeviceStateSnapshot };

const STATUS_TIMEOUT_MS = 3000;

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

export const parseDeviceStateSnapshot = (
  value: unknown,
): DeviceStateSnapshot | null => {
  if (!isRecord(value) || !isRecord(value.ac)) {
    return null;
  }

  const ac = value.ac;
  if (
    typeof ac.power !== "boolean" ||
    typeof ac.temperature !== "number" ||
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
      quiet: typeof ac.quiet === "boolean" ? ac.quiet : false,
      powerful: typeof ac.powerful === "boolean" ? ac.powerful : false,
      swingHorizontal: ac.swingHorizontal,
      swingVertical: ac.swingVertical,
      temperature: ac.temperature,
    },
  };
};

export const deviceStateSnapshotToDeviceState = (
  snapshot: DeviceStateSnapshot,
): DeviceState => ({
  power: snapshot.ac.power,
  temperature: snapshot.ac.temperature,
  mode: snapshot.ac.mode,
  fanSpeed: snapshot.ac.fan,
  swingVertical: snapshot.ac.swingVertical,
  swingHorizontal: snapshot.ac.swingHorizontal,
  quiet: snapshot.ac.quiet,
  powerful: snapshot.ac.powerful,
  syncStatus: "synced",
  lastSyncedAt: Date.now(),
});

export const deviceStateToDeviceStateSnapshot = (
  state: DeviceState,
): DeviceStateSnapshot | null => {
  if (
    typeof state.power !== "boolean" ||
    typeof state.temperature !== "number" ||
    !isEspAcMode(state.mode) ||
    !isEspFanSpeed(state.fanSpeed) ||
    !isEspAirflow(state.swingVertical) ||
    !isEspAirflow(state.swingHorizontal)
  ) {
    return null;
  }

  return {
    ac: {
      fan: state.fanSpeed,
      mode: state.mode,
      power: state.power,
      quiet: state.quiet === true,
      powerful: state.powerful === true,
      swingHorizontal: state.swingHorizontal,
      swingVertical: state.swingVertical,
      temperature: state.temperature,
    },
  };
};

export async function fetchControllerStatus(
  controller: Controller,
): Promise<DeviceStateSnapshot> {
  const host = controller.ip.replace(/\/+$/, "");
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), STATUS_TIMEOUT_MS);

  try {
    const response = await fetch(`${host}/status`, {
      headers: {
        Authorization: `Bearer ${controller.token}`,
      },
      method: "GET",
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Controller status failed with HTTP ${response.status}`);
    }

    const snapshot = parseDeviceStateSnapshot((await response.json()) as unknown);
    if (snapshot === null) {
      throw new Error("Controller returned invalid status payload");
    }

    return snapshot;
  } finally {
    clearTimeout(timeout);
  }
}
