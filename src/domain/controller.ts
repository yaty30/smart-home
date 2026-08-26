export type Controller = {
  id: string;
  controllerId: string;
  name: string;
  roomId?: string;

  ip: string;
  token: string;

  online: boolean;
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
});
