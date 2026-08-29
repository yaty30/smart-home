import type { PairedDevice } from "../types/device";

const TIMEOUT_MS = 1500;

export type AcCommandParams = Record<string, string | number>;

export function describeAcCommand(params: AcCommandParams): string {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(",");
}

export async function sendAcCommandToDevice(
  device: PairedDevice,
  params: AcCommandParams,
): Promise<boolean> {
  const host = device.host.replace(/\/+$/, "");
  const searchParams = new URLSearchParams();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  Object.entries(params).forEach(([key, value]) => {
    searchParams.append(key, String(value));
  });

  try {
    const response = await fetch(`${host}/ac?${searchParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${device.token}`,
      },
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("ESP32 AC request failed", response.status);
      return false;
    }

    return true;
  } finally {
    clearTimeout(timeout);
  }
}
