import type { Device } from '../domain/device';
import type { DeviceCommand } from './controllerClient';
import { controllerClient } from './controllerClient';

export class DeviceService {
  private getDevice: ((deviceId: string) => Device | undefined) | null = null;
  private getController: ((controllerId: string) => unknown) | null = null;

  initialize(
    getDevice: (deviceId: string) => Device | undefined,
    getController: (controllerId: string) => unknown
  ) {
    this.getDevice = getDevice;
    this.getController = getController;
  }

  async executeDeviceCommand(
    deviceId: string,
    command: DeviceCommand
  ): Promise<boolean> {
    if (!this.getDevice || !this.getController) {
      throw new Error('DeviceService not initialized');
    }

    const device = this.getDevice(deviceId);
    if (!device) {
      console.warn(`[DeviceService] Device not found: ${deviceId}`);
      return false;
    }

    const controller = this.getController(device.controllerId);
    if (!controller || typeof controller !== 'object') {
      console.warn(
        `[DeviceService] Controller not found for device: ${device.name}`
      );
      return false;
    }

    return controllerClient.sendCommand(
      controller as never,
      device,
      command
    );
  }
}

export const deviceService = new DeviceService();

// Standalone function for convenience
export async function executeDeviceCommand(
  deviceId: string,
  command: DeviceCommand
): Promise<void> {
  const success = await deviceService.executeDeviceCommand(deviceId, command);
  if (!success) {
    throw new Error('Failed to execute device command');
  }
}
