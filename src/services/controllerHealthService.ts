import { controllerClient } from './controllerClient';
import type { Controller } from '../domain/controller';

export class ControllerHealthService {
  private intervalId: NodeJS.Timeout | null = null;
  private healthCheckInterval = 30000; // 30 seconds

  start(
    controllers: Controller[],
    onStatusUpdate: (controllerId: string, online: boolean) => void,
    intervalMs = this.healthCheckInterval
  ): void {
    if (this.intervalId) {
      this.stop();
    }

    this.checkAllControllers(controllers, onStatusUpdate);

    this.intervalId = setInterval(() => {
      this.checkAllControllers(controllers, onStatusUpdate);
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async checkController(
    controller: Controller,
    onStatusUpdate: (controllerId: string, online: boolean) => void
  ): Promise<void> {
    const isOnline = await controllerClient.checkHealth(controller);
    if (controller.online !== isOnline) {
      onStatusUpdate(controller.id, isOnline);
    }
  }

  private async checkAllControllers(
    controllers: Controller[],
    onStatusUpdate: (controllerId: string, online: boolean) => void
  ): Promise<void> {
    await Promise.all(
      controllers.map((controller) =>
        this.checkController(controller, onStatusUpdate)
      )
    );
  }
}

export const controllerHealthService = new ControllerHealthService();
