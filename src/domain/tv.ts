export type TvProtocol = "webos" | "unknown";

export type DiscoveredTv = {
  id: string;
  name: string;
  brand: string;
  model: string;
  ip: string;
  mac?: string;
  protocol: TvProtocol;
  discoveryProtocol?: string;
};

export type TvPairingState =
  | "idle"
  | "connecting"
  | "waiting_for_pin"
  | "waiting_for_approval"
  | "paired"
  | "failed";

export type TvDevice = {
  id: string;
  name: string;
  roomId: string;
  controllerId: string;
  controllerDeviceId: string;  // ID on ESP32 side
  type: "tv";
  brand: string;
  protocol: TvProtocol;
};
