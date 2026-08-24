import type { PairedDevice } from "../types/device";

export const parsePairedDeviceQRCode = (data: string): PairedDevice | null => {
  try {
    const parsedPayload = JSON.parse(data) as unknown;

    if (typeof parsedPayload !== "object" || parsedPayload === null) {
      return null;
    }

    const candidate = parsedPayload as Partial<PairedDevice>;
    const host = candidate.host?.trim();
    const token = candidate.token?.trim();

    if (!host || !token) {
      return null;
    }

    const parsedHost = new URL(host);
    if (parsedHost.protocol !== "http:" && parsedHost.protocol !== "https:") {
      return null;
    }

    return {
      host,
      token,
    };
  } catch {
    return null;
  }
};

export const notifyPairingComplete = async (device: PairedDevice) => {
  const host = device.host.replace(/\/+$/, "");

  try {
    const response = await fetch(`${host}/pair/complete`, {
      headers: {
        Authorization: `Bearer ${device.token}`,
      },
      method: "POST",
    });

    if (!response.ok) {
      console.warn("ESP32 pair completion returned", response.status);
    }
  } catch (error) {
    console.warn(
      "Pairing completed locally, but ESP32 display update failed.",
      error,
    );
  }
};
