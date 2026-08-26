import type { Controller } from '../domain/controller';
import { createController } from '../domain/controller';

export type PairingQRCodePayload = {
  controllerId: string;
  ip: string;
  token: string;
  name?: string;
};

const LEGACY_DEFAULT_PAIRING_TOKEN = 'abc123';

export const parsePairingQRCode = (data: string): PairingQRCodePayload | null => {
  try {
    const parsed = parseQRCodeJson(data);

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const candidate = parsed as Partial<PairingQRCodePayload> & {
      host?: string;
      websocket?: string;
      endpoints?: string[];
    };

    const ip = stringValue(candidate.ip);
    const host = stringValue(candidate.host);
    const websocket = stringValue(candidate.websocket);
    const name = stringValue(candidate.name);
    const rawHost = ip || host || httpUrlFromWebsocket(websocket);

    if (!rawHost) {
      return null;
    }

    const normalizedIp = normalizeHttpHost(rawHost);
    if (!normalizedIp) {
      return null;
    }

    const controllerId = stringValue(candidate.controllerId) || generateControllerIdFromIp(normalizedIp);

    // Older ESP32 root metadata omitted the token. Keep this fallback aligned
    // with the bundled firmware default so those QR codes can still pair.
    const token = stringValue(candidate.token) || LEGACY_DEFAULT_PAIRING_TOKEN;

    return {
      controllerId,
      ip: normalizedIp,
      token,
      name,
    };
  } catch {
    return null;
  }
};

function parseQRCodeJson(data: string): unknown {
  try {
    return JSON.parse(data) as unknown;
  } catch (error) {
    if (!data.includes('\\://')) {
      throw error;
    }

    return JSON.parse(data.replace(/\\:\/\//g, '://')) as unknown;
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

function normalizeHttpHost(value: string): string | null {
  let normalized = value;
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `http://${normalized}`;
  }

  try {
    const parsedUrl = new URL(normalized);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null;
    }

    return `${parsedUrl.protocol}//${parsedUrl.host}`;
  } catch {
    return null;
  }
}

function httpUrlFromWebsocket(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.protocol === 'ws:') {
      return `http://${parsedUrl.hostname}`;
    }
    if (parsedUrl.protocol === 'wss:') {
      return `https://${parsedUrl.hostname}`;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function generateControllerIdFromIp(ip: string): string {
  // Extract just the IP address part (remove protocol, port, path)
  const cleanIp = ip
    .replace(/^https?:\/\//, '')
    .replace(/:\d+.*$/, '')
    .replace(/\/.*$/, '');

  // Create a stable ID from the IP
  return `ctrl-${cleanIp.replace(/\./g, '-')}`;
}

export const notifyPairingComplete = async (controller: Controller): Promise<void> => {
  const host = controller.ip.replace(/\/+$/, '');

  try {
    const response = await fetch(`${host}/pair/complete`, {
      headers: {
        Authorization: `Bearer ${controller.token}`,
      },
      method: 'POST',
    });

    if (!response.ok) {
      console.warn('Controller pair completion returned', response.status);
    }
  } catch (error) {
    console.warn('Pairing completed locally, but controller display update failed.', error);
  }
};

export const createControllerFromQRCode = (
  payload: PairingQRCodePayload,
  roomName: string,
  roomId?: string
): Controller => {
  const name = `${roomName} Controller`;
  return createController(payload.controllerId, name, payload.ip, payload.token, roomId);
};
