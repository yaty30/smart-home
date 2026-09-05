import type { Controller } from '../domain/controller';
import type { DiscoveredTv, TvPairingState } from '../domain/tv';
import { isDebugMode } from '../config/debug';

const DISCOVERY_TIMEOUT_MS = 5000;
const PAIRING_STATUS_POLL_INTERVAL_MS = 1000;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parseDiscoveredTv = (value: unknown): DiscoveredTv | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.brand !== 'string' ||
    typeof value.ip !== 'string'
  ) {
    return null;
  }

  const protocol = value.protocol === 'webos' ? 'webos' : 'unknown';

  return {
    id: value.id,
    name: value.name,
    brand: value.brand,
    model: typeof value.model === 'string' ? value.model : '',
    ip: value.ip,
    ...(typeof value.mac === 'string' ? { mac: value.mac } : {}),
    protocol,
    ...(typeof value.discoveryProtocol === 'string'
      ? { discoveryProtocol: value.discoveryProtocol }
      : {}),
  };
};

const discoveredTvKey = (tv: DiscoveredTv): string => {
  if (tv.mac && tv.mac.length > 0) {
    return `mac:${tv.mac.toLowerCase()}`;
  }

  if (tv.ip.length > 0) {
    return `ip:${tv.ip}`;
  }

  const rootId = tv.id.split('::')[0] ?? tv.id;
  return `id:${rootId}`;
};

const dedupeDiscoveredTvs = (devices: DiscoveredTv[]): DiscoveredTv[] => {
  const seen = new Set<string>();
  const uniqueDevices: DiscoveredTv[] = [];

  for (const tv of devices) {
    const key = discoveredTvKey(tv);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueDevices.push(tv);
  }

  return uniqueDevices;
};

const parsePairingState = (value: unknown): TvPairingState => {
  if (
    value === 'idle' ||
    value === 'connecting' ||
    value === 'waiting_for_pin' ||
    value === 'waiting_for_approval' ||
    value === 'paired' ||
    value === 'failed'
  ) {
    return value;
  }

  return 'idle';
};

export class TvService {
  private discoveryAbortController: AbortController | null = null;
  private pairingPollInterval: NodeJS.Timeout | null = null;

  async startDiscovery(controller: Controller): Promise<void> {
    if (isDebugMode) {
      console.log('[TvService] Debug: Skipping actual discovery');
      return;
    }

    if (!controller.online) {
      throw new Error('Controller is offline');
    }

    this.discoveryAbortController?.abort();
    this.discoveryAbortController = new AbortController();

    const host = controller.ip.replace(/\/+$/, '');
    const response = await fetch(`${host}/tv/discover`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${controller.token}`,
      },
      signal: this.discoveryAbortController.signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Discovery failed');
    }
  }

  async getDiscoveryStatus(controller: Controller): Promise<{
    scanning: boolean;
    devices: DiscoveredTv[];
  }> {
    if (isDebugMode) {
      return {
        scanning: false,
        devices: [
          {
            id: 'debug-lg-tv',
            name: 'LG webOS TV',
            brand: 'LG',
            model: 'OLED55B8PCA',
            ip: '192.168.1.100',
            mac: 'AA:BB:CC:DD:EE:FF',
            protocol: 'webos',
            discoveryProtocol: 'ssdp',
          },
        ],
      };
    }

    if (!controller.online) {
      throw new Error('Controller is offline');
    }

    const host = controller.ip.replace(/\/+$/, '');
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), DISCOVERY_TIMEOUT_MS);

    try {
      const response = await fetch(`${host}/tv/discover`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${controller.token}`,
        },
        signal: abortController.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Failed to get discovery status');
      }

      const data = (await response.json()) as unknown;
      const devices = isRecord(data) && Array.isArray(data.devices)
        ? dedupeDiscoveredTvs(
            data.devices
              .map(parseDiscoveredTv)
              .filter((tv): tv is DiscoveredTv => tv !== null),
          )
        : [];
      const scanning = isRecord(data) && data.scanning === true;

      console.log(
        `[TvService] Discovery status: scanning=${scanning} devices=${devices.length}`,
      );

      return {
        scanning,
        devices,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async startPairing(
    controller: Controller,
    discoveryId: string
  ): Promise<void> {
    if (isDebugMode) {
      console.log('[TvService] Debug: Skipping actual pairing');
      return;
    }

    if (!controller.online) {
      throw new Error('Controller is offline');
    }

    const host = controller.ip.replace(/\/+$/, '');
    const params = new URLSearchParams({ discoveryId });

    const response = await fetch(`${host}/tv/pair/start?${params.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${controller.token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to start pairing');
    }
  }

  async unpairTv(controller: Controller, tvId: string): Promise<void> {
    if (isDebugMode) {
      console.log(`[TvService] Debug: Skipping unpair for TV ${tvId}`);
      return;
    }

    if (!controller.online) {
      throw new Error('Controller is offline');
    }

    const host = controller.ip.replace(/\/+$/, '');
    const params = new URLSearchParams({ tvId });

    const response = await fetch(`${host}/tv/unpair?${params.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${controller.token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to unpair TV');
    }
  }

  async submitPairingPin(controller: Controller, pin: string): Promise<void> {
    if (isDebugMode) {
      console.log(`[TvService] Debug: Skipping PIN submit: ${pin}`);
      return;
    }

    if (!controller.online) {
      throw new Error('Controller is offline');
    }

    const host = controller.ip.replace(/\/+$/, '');
    const params = new URLSearchParams({ pin });

    const response = await fetch(`${host}/tv/pair/pin?${params.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${controller.token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to submit pairing PIN');
    }
  }

  async getPairingStatus(controller: Controller): Promise<TvPairingState> {
    if (isDebugMode) {
      return 'idle';
    }

    if (!controller.online) {
      throw new Error('Controller is offline');
    }

    const host = controller.ip.replace(/\/+$/, '');
    const response = await fetch(`${host}/tv/pair/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${controller.token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to get pairing status');
    }

    const data = (await response.json()) as unknown;
    return parsePairingState(isRecord(data) ? data.state : undefined);
  }

  async completePairing(
    controller: Controller,
    tvName: string
  ): Promise<void> {
    if (isDebugMode) {
      console.log('[TvService] Debug: Skipping pairing completion');
      return;
    }

    if (!controller.online) {
      throw new Error('Controller is offline');
    }

    const host = controller.ip.replace(/\/+$/, '');
    const params = new URLSearchParams({ name: tvName });

    const response = await fetch(`${host}/tv/pair/complete?${params.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${controller.token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to complete pairing');
    }
  }

  async sendTvCommand(
    controller: Controller,
    tvId: string,
    command: string
  ): Promise<void> {
    if (isDebugMode) {
      console.log(`[TvService] Debug: ${command} command for TV ${tvId}`);
      return;
    }

    if (!controller.online) {
      throw new Error('Controller is offline');
    }

    const host = controller.ip.replace(/\/+$/, '');
    const params = new URLSearchParams({ tvId, command });

    const response = await fetch(`${host}/tv/command?${params.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${controller.token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Command failed');
    }
  }

  startPairingStatusPolling(
    controller: Controller,
    onStateChange: (state: TvPairingState) => void
  ): void {
    this.stopPairingStatusPolling();

    this.pairingPollInterval = setInterval(async () => {
      try {
        const state = await this.getPairingStatus(controller);
        onStateChange(state);

        if (state === 'paired' || state === 'failed') {
          this.stopPairingStatusPolling();
        }
      } catch (error) {
        console.warn('[TvService] Pairing status poll failed:', error);
      }
    }, PAIRING_STATUS_POLL_INTERVAL_MS);
  }

  stopPairingStatusPolling(): void {
    if (this.pairingPollInterval) {
      clearInterval(this.pairingPollInterval);
      this.pairingPollInterval = null;
    }
  }

  cancelDiscovery(): void {
    this.discoveryAbortController?.abort();
    this.discoveryAbortController = null;
  }

  cleanup(): void {
    this.cancelDiscovery();
    this.stopPairingStatusPolling();
  }
}

export const tvService = new TvService();
