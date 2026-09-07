# Smart Home AC Controller

Smart Home AC Controller is a React Native app and ESP32 firmware pair for controlling room devices from a phone. The first-class use case is an infrared air-conditioner controller: the app gives the user a polished AC remote, schedule editor, room/device organization, and controller status, while an ESP32 on the same LAN translates those commands into IR signals.

The firmware also includes early support for network TV discovery, pairing, and commands, so the ESP32 can act as a small room controller instead of only an IR blaster.

## Why this exists

Most split AC units still expose their best control surface through an IR remote. That makes them awkward to integrate into a modern smart home because the current state lives in the remote, schedules are usually limited, and phone control depends on brand-specific cloud integrations.

This project keeps control local:

- The mobile app stores rooms, controllers, devices, presets, and schedules.
- The ESP32 exposes a local HTTP/WebSocket API over Wi-Fi.
- AC commands are converted into brand-specific IR frames on the ESP32.
- Schedules can be saved to the controller so they continue to run even when the app is closed.
- The controller can report live state back to the app without relying on a cloud service.

## Product overview

The app lets a user:

- Create rooms and assign controllers to them.
- Add AC, TV, light, and fan devices.
- Control AC power, temperature, mode, fan speed, vertical airflow, horizontal airflow, quiet mode, and powerful mode.
- Save AC presets for common comfort settings.
- Create AC schedules with start/end behavior, repeat days, temperature, mode, fan, and airflow.
- See whether each controller/device is online, syncing, offline, or connected.
- Discover and pair supported TVs through the ESP32 controller.

## Architecture

This repository contains two cooperating systems:

- `src/` and `App.tsx`: the Expo/React Native mobile app.
- `esp32/`: the PlatformIO firmware for an ESP32-S3 controller.

### Mobile app

The app is organized around React contexts and domain services:

- `App.tsx` wires navigation, theme, room/controller/device providers, and background controller status polling.
- `src/store/` owns in-app room, controller, device, and debug state.
- `src/domain/` defines the core room, device, TV, and controller models.
- `src/screens/` contains product flows such as home, rooms, controller pairing, AC control, TV discovery, and settings.
- `src/context/DeviceConnectionContext.tsx` manages live controller connectivity for a selected device. It fetches REST status, opens a WebSocket, authenticates, keeps a ping loop, applies incoming device state, and marks devices offline when the controller is unreachable.
- `src/api/` contains focused API clients for AC commands and AC schedules.
- `src/services/` contains controller, pairing, status, health, TV, and device services.

The app currently pairs controllers manually by asking for the ESP32 host/IP address and token. The intended BLE provisioning flow is documented in [esp32_connection.md](./esp32_connection.md).

### ESP32 firmware

The firmware runs an Arduino-style loop:

1. Load persisted state and device configuration.
2. Initialize pairing state and the AC IR controller.
3. Connect to Wi-Fi.
4. Start the HTTP server on port `80`.
5. Start the WebSocket server on port `81` at `/ws`.
6. Initialize AC schedule execution and TV management.
7. Continuously handle HTTP, WebSocket, pairing button, queued IR commands, schedules, and TV events.

Important firmware files:

- `esp32/core/core.ino`: firmware entrypoint.
- `esp32/core/HttpServer.cpp`: REST endpoints for status, AC control, schedules, pairing completion, Wi-Fi info, and TV operations.
- `esp32/core/WebSocketServer.cpp`: live state, auth, ping/pong, and command message handling.
- `esp32/core/ACController.cpp`: queues IR state changes before sending.
- `esp32/core/src/ac/`: brand-specific AC drivers built on `IRremoteESP8266`.
- `esp32/core/ScheduleManager.cpp`: executes saved AC schedules.
- `esp32/core/WiFiManager.cpp`: connects the ESP32 to the configured 2.4 GHz Wi-Fi network.
- `esp32/core/Config.h`: hardware pins, Wi-Fi settings, token, WebSocket settings, and schedule timezone.

### Communication model

The app and ESP32 communicate locally over LAN after the controller has joined Wi-Fi:

- REST `GET /status` returns the current AC and Wi-Fi state.
- REST `GET /ac?...` applies an AC state patch and queues an IR command.
- REST `GET|PUT|DELETE /ac/schedule` reads and writes schedules.
- REST `POST /pair/complete` marks initial pairing complete.
- WebSocket `ws://<esp32-ip>:81/ws` authenticates with the controller token, pushes state snapshots, and supports ping/pong health checks.

App REST requests include `Authorization: Bearer <token>`. The WebSocket requires an auth message containing the same token before it accepts state or command traffic.

Implementation note: the checked-in firmware visibly enforces token auth for WebSocket traffic and `/pair/complete`. The REST clients already send bearer auth for status, AC, schedule, and TV APIs, so the firmware should enforce that header on all private endpoints before this is used outside a trusted development network.

More detail:

- [esp32_IR_control.md](./esp32_IR_control.md) explains AC/IR command flow.
- [esp32_connection.md](./esp32_connection.md) explains the intended BLE-based ESP32 provisioning flow.

## Hardware notes

The current firmware target is a Waveshare ESP32-S3-Zero style board configured through PlatformIO as `esp32-s3-devkitm-1`.

Default important pins:

- IR LED output: `GPIO13`
- BOOT pairing/reset button: `GPIO0`
- WebSocket port: `81`
- WebSocket path: `/ws`

TFT wiring note from the original project README:

| TFT pin | ESP32 pin |
| --- | --- |
| GND | GND |
| VCC | 3V3 |
| SCL | GPIO18 |
| SDA | GPIO19 |
| RES | GPIO17 |
| DC | GPIO16 |
| CS | GPIO5 |
| BL | 3V3 |

## Requirements

For the mobile app:

- Node.js and npm
- Expo CLI through `npx expo`
- iOS Simulator, Android Emulator, Expo Go, or a development build

For the firmware:

- PlatformIO
- ESP32-S3 board connected over USB
- 2.4 GHz Wi-Fi network
- IR LED/transmitter circuit connected to the configured IR pin

## Run the mobile app

Install dependencies:

```sh
npm install
```

Start Expo:

```sh
npm start
```

Run on a target:

```sh
npm run ios
npm run android
npm run web
```

Enable debug mode when you want simulated controller behavior instead of a physical ESP32:

```sh
EXPO_PUBLIC_DEBUG_MODE=true npm start
```

Type-check the app:

```sh
npm run typecheck
```

## Build and flash the ESP32 firmware

Install PlatformIO if needed, then build from the firmware directory:

```sh
cd esp32
pio run
```

Upload to the board:

```sh
pio run --target upload
```

Open the serial monitor:

```sh
pio device monitor
```

Before flashing, review `esp32/core/Config.h` and configure:

- `IR_PIN`
- `WIFI_SSID`
- `WIFI_PASSWORD`
- `PAIRING_TOKEN`
- `SCHEDULE_GMT_OFFSET_SEC`
- `SCHEDULE_DAYLIGHT_OFFSET_SEC`

The current firmware uses compile-time Wi-Fi credentials. The intended user-facing BLE provisioning design is described in [esp32_connection.md](./esp32_connection.md).

## Pair a controller today

1. Flash the ESP32 firmware and wait for it to connect to Wi-Fi.
2. Read the ESP32 IP address from the serial monitor or your router.
3. Open the app.
4. Go to the controller pairing flow.
5. Enter the controller name, ESP32 IP address, and pairing token.
6. The app calls `/status`; if that succeeds, it saves the controller, syncs device state, and calls `/pair/complete`.

After pairing, the app polls `/status` in the background and opens a WebSocket while controlling a selected device.

## API quick reference

Common controller endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Controller identity, IP, token, WebSocket URL, and endpoint list. |
| `GET` | `/status` | AC state, Wi-Fi status, pairing flag, pending IR flag, IP, and WebSocket URL. |
| `GET` | `/wifi` | Wi-Fi SSID, connection state, IP, and RSSI. |
| `POST` | `/pair/complete` | Marks pairing complete. Requires bearer token. |
| `GET` | `/ac` | Applies AC parameters and queues IR. |
| `GET` | `/power/on` | Turns AC state on and queues IR. |
| `GET` | `/power/off` | Turns AC state off and queues IR. |
| `GET` | `/temp/16..30` | Sets AC temperature and queues IR. |
| `GET` | `/mode/auto|cool|dry|fan|heat` | Sets AC mode and queues IR. |
| `GET` | `/ac/schedule` | Reads saved AC schedules. |
| `PUT` | `/ac/schedule` | Replaces saved AC schedules. |
| `DELETE` | `/ac/schedule` | Clears saved AC schedules. |

AC query parameters accepted by `/ac`:

- `power=on|off`
- `temp=16..30`
- `mode=auto|cool|dry|fan|heat`
- `fan=auto|1|2|3|4|5`
- `swingVertical=auto|1|2|3|4|5`
- `swingHorizontal=auto|1|2|3|4|5`
- `quiet=on|off`
- `powerful=on|off`

WebSocket messages:

```json
{ "type": "auth", "token": "controller-token" }
{ "type": "ping", "requestId": "client-generated-id" }
{ "type": "state.get" }
{ "type": "command", "requestId": "client-generated-id", "command": "ac.setTemperature", "value": 24 }
```

The controller responds with messages such as:

```json
{ "type": "auth.result", "ok": true }
{ "type": "pong", "requestId": "client-generated-id" }
{ "type": "state", "ac": { "power": true, "temperature": 24, "mode": "cool", "fan": "auto", "swingVertical": "auto", "swingHorizontal": "auto", "quiet": false, "powerful": false }, "connection": { "wifi": true } }
{ "type": "command.ack", "requestId": "client-generated-id", "ok": true }
```

## Development notes

- Keep the app and firmware API contracts in sync. The TypeScript parsers are intentionally strict about AC state values.
- The ESP32-S3 supports 2.4 GHz Wi-Fi. The firmware scans for the configured SSID and skips channels above 13.
- Temperature commands are debounced in the app so slider movement does not flood the controller.
- AC state changes are queued briefly on the firmware before IR send, which keeps request handling responsive.
- Schedules are stored on-device and execute according to the schedule timezone constants.
