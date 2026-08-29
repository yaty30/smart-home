import {
  SETUP_AP_PREFIX,
  SETUP_CONTROLLER_HOST,
} from '../config/provisioning';

export type SetupInfo = {
  controllerId: string;
  shortId: string;
  setupMode: boolean;
};

export type SetupNetwork = {
  ssid: string;
  rssi: number;
};

export type SetupWifiResult = {
  controllerId: string;
  shortId: string;
  ip: string;
  token: string;
};

const SETUP_REQUEST_TIMEOUT_MS = 6000;
const SETUP_WIFI_TIMEOUT_MS = 28000;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const fetchJson = async <T>(
  path: string,
  init?: RequestInit,
  timeoutMs = SETUP_REQUEST_TIMEOUT_MS,
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${SETUP_CONTROLLER_HOST}${path}`, {
      ...init,
      signal: controller.signal,
    });

    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      const message =
        isRecord(payload) && typeof payload.error === 'string'
          ? payload.error
          : `Setup request failed with HTTP ${response.status}`;
      throw new Error(message);
    }

    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
};

export const setupShortIdFromSSID = (ssid: string): string | null => {
  const trimmed = ssid.trim().toUpperCase();
  if (/^[A-F0-9]{6}$/.test(trimmed)) {
    return trimmed;
  }

  const setupPrefix = SETUP_AP_PREFIX.toUpperCase();
  if (!trimmed.startsWith(setupPrefix)) {
    return null;
  }

  const shortId = trimmed.slice(setupPrefix.length);
  return /^[A-F0-9]{6}$/.test(shortId) ? shortId : null;
};

export const setupControllerLabel = (shortId: string): string => {
  return `SmartHome Controller • ${shortId}`;
};

export const fetchSetupInfo = async (): Promise<SetupInfo> => {
  const payload = await fetchJson<unknown>('/setup/info');
  if (
    !isRecord(payload) ||
    typeof payload.controllerId !== 'string' ||
    typeof payload.shortId !== 'string' ||
    typeof payload.setupMode !== 'boolean'
  ) {
    throw new Error('Controller returned invalid setup info');
  }

  return {
    controllerId: payload.controllerId,
    shortId: payload.shortId.toUpperCase(),
    setupMode: payload.setupMode,
  };
};

export const fetchSetupNetworks = async (): Promise<SetupNetwork[]> => {
  const payload = await fetchJson<unknown>('/setup/networks');
  if (!isRecord(payload) || !Array.isArray(payload.networks)) {
    throw new Error('Controller returned invalid Wi-Fi network list');
  }

  return payload.networks
    .filter(
      (network): network is SetupNetwork =>
        isRecord(network) &&
        typeof network.ssid === 'string' &&
        network.ssid.length > 0 &&
        typeof network.rssi === 'number',
    )
    .sort((a, b) => b.rssi - a.rssi);
};

export const sendSetupWifi = async (
  ssid: string,
  password: string,
): Promise<SetupWifiResult> => {
  const payload = await fetchJson<unknown>(
    '/setup/wifi',
    {
      body: JSON.stringify({ ssid, password }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
    SETUP_WIFI_TIMEOUT_MS,
  );

  if (
    !isRecord(payload) ||
    typeof payload.controllerId !== 'string' ||
    typeof payload.shortId !== 'string' ||
    typeof payload.ip !== 'string' ||
    typeof payload.token !== 'string'
  ) {
    throw new Error('Controller returned invalid provisioning result');
  }

  return {
    controllerId: payload.controllerId,
    shortId: payload.shortId.toUpperCase(),
    ip: payload.ip,
    token: payload.token,
  };
};
