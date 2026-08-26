import type { Controller } from '../domain/controller';
import type { Device } from '../domain/device';

export type DeviceCommand = {
  type: string;
  value?: unknown;
  [key: string]: unknown;
};

const COMMAND_TIMEOUT_MS = 1500;

export class ControllerClient {
  async sendCommand(
    controller: Controller,
    device: Device,
    command: DeviceCommand
  ): Promise<boolean> {
    if (!controller.online) {
      console.log(
        `[ControllerClient] Command dropped: controller ${controller.name} is offline`
      );
      return false;
    }

    const host = controller.ip.replace(/\/+$/, '');
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), COMMAND_TIMEOUT_MS);

    try {
      const endpoint = this.getEndpointForDevice(device);
      const params = this.buildCommandParams(device, command);
      const searchParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });

      console.log(
        `[ControllerClient] Sending command to ${controller.name} (${device.name}): ${command.type}`
      );

      const response = await fetch(`${host}${endpoint}?${searchParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${controller.token}`,
        },
        method: 'GET',
        signal: abortController.signal,
      });

      if (!response.ok) {
        console.warn(
          `[ControllerClient] Command failed with status ${response.status}`
        );
        return false;
      }

      return true;
    } catch (error) {
      console.warn('[ControllerClient] Command failed:', error);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  private getEndpointForDevice(device: Device): string {
    switch (device.type) {
      case 'ac':
        return '/ac';
      case 'tv':
        return '/tv';
      case 'light':
        return '/light';
      default:
        return '/device';
    }
  }

  private buildCommandParams(
    device: Device,
    command: DeviceCommand
  ): Record<string, string | number> {
    if (device.type === 'ac') {
      return this.buildAcCommandParams(command);
    }

    return {
      command: command.type,
      ...(command.value !== undefined ? { value: String(command.value) } : {}),
    };
  }

  private buildAcCommandParams(
    command: DeviceCommand
  ): Record<string, string | number> {
    switch (command.type) {
      case 'power':
        return { power: this.powerValue(command.value) ? 'on' : 'off' };
      case 'temperature':
        return { temp: Number(command.value) };
      case 'mode':
        return { mode: String(command.value) };
      case 'fan':
        return { fan: String(command.value) };
      case 'swingVertical':
        return { vane: String(command.value) };
      case 'swingHorizontal':
        return { wvane: String(command.value) };
      case 'quiet':
        return {
          quiet: this.powerValue(command.value) ? 'on' : 'off',
          powerful: 'off',
        };
      case 'powerful':
        return {
          powerful: this.powerValue(command.value) ? 'on' : 'off',
          quiet: 'off',
        };
      default:
        return { [command.type]: String(command.value) };
    }
  }

  private powerValue(value: unknown): boolean {
    return value === true || value === 'on' || value === 1 || value === '1';
  }

  async checkHealth(controller: Controller): Promise<boolean> {
    const host = controller.ip.replace(/\/+$/, '');
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 3000);

    try {
      const response = await fetch(`${host}/status`, {
        headers: {
          Authorization: `Bearer ${controller.token}`,
        },
        method: 'GET',
        signal: abortController.signal,
      });

      return response.ok;
    } catch (error) {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const controllerClient = new ControllerClient();
