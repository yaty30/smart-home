import type { Controller } from '../domain/controller';
import type { Device } from '../domain/device';
import type { Room } from '../domain/room';

export const DEBUG_ROOMS: Room[] = [
  {
    id: 'debug-room-living',
    name: 'Living Room',
    icon: 'sofa',
  },
  {
    id: 'debug-room-bedroom',
    name: 'Bedroom',
    icon: 'bed-double',
  },
];

export const DEBUG_CONTROLLERS: Controller[] = [
  {
    id: 'debug-controller-living',
    controllerId: 'esp32-debug-living',
    name: 'Living Room Controller',
    roomId: 'debug-room-living',
    ip: 'http://192.0.2.10',
    token: 'debug-token-living',
    online: true,
  },
  {
    id: 'debug-controller-bedroom',
    controllerId: 'esp32-debug-bedroom',
    name: 'Bedroom Controller',
    roomId: 'debug-room-bedroom',
    ip: 'http://192.0.2.11',
    token: 'debug-token-bedroom',
    online: true,
  },
];

const panasonicAcCapabilities = {
  power: true,
  temperature: { min: 16, max: 30 },
  modes: ['auto', 'cool', 'dry', 'fan', 'heat'],
  fanSpeeds: ['auto', '1', '2', '3', '4', '5'],
  swing: true,
};

export const DEBUG_DEVICES: Device[] = [
  {
    id: 'debug-device-living-ac',
    name: 'Living Room Air Conditioner',
    roomId: 'debug-room-living',
    controllerId: 'debug-controller-living',
    type: 'ac',
    brand: 'panasonic',
    transport: 'ir',
    capabilities: panasonicAcCapabilities,
    state: {
      power: true,
      temperature: 24,
      mode: 'cool',
      fanSpeed: 'auto',
      swingVertical: 'auto',
      swingHorizontal: 'center',
      quiet: false,
      powerful: false,
    },
  },
  {
    id: 'debug-device-living-tv',
    name: 'Living Room TV',
    roomId: 'debug-room-living',
    controllerId: 'debug-controller-living',
    type: 'tv',
    brand: 'lg',
    transport: 'ir',
    capabilities: { power: true },
    state: { power: false },
  },
  {
    id: 'debug-device-living-lamp',
    name: 'Floor Lamp',
    roomId: 'debug-room-living',
    controllerId: 'debug-controller-living',
    type: 'light',
    brand: 'lg',
    transport: 'ir',
    capabilities: { power: true },
    state: { power: true },
  },
  {
    id: 'debug-device-bedroom-ac',
    name: 'Bedroom Air Conditioner',
    roomId: 'debug-room-bedroom',
    controllerId: 'debug-controller-bedroom',
    type: 'ac',
    brand: 'panasonic',
    transport: 'ir',
    capabilities: panasonicAcCapabilities,
    state: {
      power: false,
      temperature: 23,
      mode: 'cool',
      fanSpeed: '2',
      swingVertical: 'auto',
      swingHorizontal: 'center',
      quiet: true,
      powerful: false,
    },
  },
  {
    id: 'debug-device-bedroom-lamp',
    name: 'Bedside Lamp',
    roomId: 'debug-room-bedroom',
    controllerId: 'debug-controller-bedroom',
    type: 'light',
    brand: 'lg',
    transport: 'ir',
    capabilities: { power: true },
    state: { power: false },
  },
];
