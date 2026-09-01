export type ControllerConnectionStatus =
  | "unknown"
  | "connecting"
  | "online"
  | "offline";

export type Controller = {
  id: string;
  controllerId: string;
  name: string;
  logo?: string;
  roomId?: string;

  ip: string;
  token: string;

  online: boolean;
  connectionStatus?: ControllerConnectionStatus;
};

export const controllerStatusText = (
  connectionStatus: ControllerConnectionStatus | undefined,
  online: boolean | undefined,
): string => {
  if (connectionStatus === "connecting") {
    return "Offline";
  }

  if (connectionStatus === "unknown" || connectionStatus === undefined) {
    return "Unknown";
  }

  return online ? "Online" : "Offline";
};

export const createController = (
  controllerId: string,
  name: string,
  ip: string,
  token: string,
  roomId?: string
): Controller => ({
  id: `controller-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  controllerId,
  name,
  roomId,
  ip,
  token,
  online: false,
  connectionStatus: "unknown",
});
