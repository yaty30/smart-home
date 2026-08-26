export type PairedDevice = {
  host: string;
  token: string;
};

export type EspAcMode = "auto" | "cool" | "dry" | "fan" | "heat";
export type EspFanSpeed = "auto" | "1" | "2" | "3" | "4" | "5";
export type EspAirflow = "auto" | "1" | "2" | "3" | "4" | "5";

export type DeviceStateSnapshot = {
  ac: {
    power: boolean;
    temperature: number;
    mode: EspAcMode;
    fan: EspFanSpeed;
    quiet: boolean;
    powerful: boolean;
    swingVertical: EspAirflow;
    swingHorizontal: EspAirflow;
  };
  display: {
    pairingMode: boolean;
    screenOn: boolean;
    qrVisible: boolean;
  };
};
