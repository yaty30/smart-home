#include "LgWebOsTv.h"
#include <WebSocketsClient.h>
#include <Arduino.h>
#include <ArduinoJson.h>

constexpr uint16_t LG_WEBOS_PORT = 3000;
constexpr unsigned long PAIRING_TIMEOUT_MS = 60000;  // 60 seconds

LgWebOsTv* LgWebOsTv::instance = nullptr;

LgWebOsTv::LgWebOsTv()
    : ws(nullptr),
      pointerWs(nullptr),
      pairingState(LgPairingState::Idle),
      pairingTimeout(0),
      connected(false),
      pointerConnected(false),
      requestId(0) {
  clientKey[0] = '\0';
  tvIp[0] = '\0';
  pointerSocketPath[0] = '\0';
  instance = this;
}

LgWebOsTv::~LgWebOsTv() {
  disconnect();
  if (ws) {
    delete ws;
    ws = nullptr;
  }
  if (pointerWs) {
    delete pointerWs;
    pointerWs = nullptr;
  }
  instance = nullptr;
}

void LgWebOsTv::startPairing(const char* ip) {
  if (pairingState == LgPairingState::WaitingForApproval) {
    Serial.println("[LG webOS] Pairing already in progress");
    return;
  }

  disconnect();

  strncpy(tvIp, ip, sizeof(tvIp) - 1);
  tvIp[sizeof(tvIp) - 1] = '\0';

  if (!ws) {
    ws = new WebSocketsClient();
  }

  pairingState = LgPairingState::Connecting;
  clientKey[0] = '\0';

  Serial.print("[LG webOS] Connecting to ");
  Serial.print(ip);
  Serial.println(":3000");

  ws->begin(ip, LG_WEBOS_PORT, "/");
  ws->onEvent([](WStype_t type, uint8_t* payload, size_t length) {
    if (instance) {
      instance->onWebSocketEvent(static_cast<int>(type), payload, length);
    }
  });

  pairingTimeout = millis() + PAIRING_TIMEOUT_MS;
}

bool LgWebOsTv::connect(const char* ip, const char* storedClientKey) {
  if (connected && isPaired()) {
    return true;
  }

  strncpy(tvIp, ip, sizeof(tvIp) - 1);
  tvIp[sizeof(tvIp) - 1] = '\0';
  strncpy(clientKey, storedClientKey, sizeof(clientKey) - 1);
  clientKey[sizeof(clientKey) - 1] = '\0';

  if (!ws) {
    ws = new WebSocketsClient();
  }

  ws->begin(ip, LG_WEBOS_PORT, "/");
  ws->onEvent([](WStype_t type, uint8_t* payload, size_t length) {
    if (instance) {
      instance->onWebSocketEvent(static_cast<int>(type), payload, length);
    }
  });

  pairingState = LgPairingState::Connecting;
  Serial.println("[LG webOS] Reconnecting with stored credentials");

  return true;
}

void LgWebOsTv::disconnect() {
  if (ws) {
    ws->disconnect();
  }
  if (pointerWs) {
    pointerWs->disconnect();
  }
  connected = false;
  pointerConnected = false;
  if (pairingState != LgPairingState::Paired) {
    pairingState = LgPairingState::Idle;
  }
}

void LgWebOsTv::onWebSocketEvent(int type, uint8_t* payload, size_t length) {
  WStype_t wsType = static_cast<WStype_t>(type);

  switch (wsType) {
    case WStype_CONNECTED:
      Serial.println("[LG webOS] WebSocket connected");
      connected = true;
      if (pairingState == LgPairingState::Connecting) {
        sendRegisterRequest(clientKey[0] == '\0', clientKey[0] == '\0');
      }
      break;

    case WStype_DISCONNECTED:
      Serial.println("[LG webOS] WebSocket disconnected");
      connected = false;
      break;

    case WStype_TEXT:
      if (payload && length > 0) {
        processMessage(reinterpret_cast<const char*>(payload));
      }
      break;

    case WStype_ERROR:
      Serial.println("[LG webOS] WebSocket error");
      if (pairingState == LgPairingState::Connecting ||
          pairingState == LgPairingState::WaitingForPin ||
          pairingState == LgPairingState::WaitingForApproval) {
        pairingState = LgPairingState::Failed;
      }
      break;

    default:
      break;
  }
}

bool LgWebOsTv::submitPin(const char* pin) {
  if (!connected || !ws || pairingState != LgPairingState::WaitingForPin) {
    Serial.println("[LG webOS] Cannot submit PIN: pairing is not waiting for PIN");
    return false;
  }

  JsonDocument doc;
  doc["type"] = "request";
  doc["id"] = "pairing_pin";
  doc["uri"] = "ssap://pairing/setPin";
  doc["payload"]["pin"] = pin;

  String output;
  serializeJson(doc, output);

  ws->sendTXT(output);
  pairingState = LgPairingState::WaitingForApproval;
  Serial.println("[LG webOS] Submitted pairing PIN");
  return true;
}

void LgWebOsTv::sendRegisterRequest(bool forcePairing, bool usePin) {
  JsonDocument doc;
  doc["type"] = "register";
  doc["id"] = "register_0";

  JsonObject payload = doc["payload"].to<JsonObject>();
  payload["forcePairing"] = forcePairing;
  payload["pairingType"] = usePin ? "PIN" : "PROMPT";
  payload["manifest"]["manifestVersion"] = 1;
  payload["manifest"]["appVersion"] = "1.1";

  JsonArray permissions = payload["manifest"]["permissions"].to<JsonArray>();
  permissions.add("APP_TO_APP");
  permissions.add("CLOSE");
  permissions.add("CONTROL_AUDIO");
  permissions.add("CONTROL_DISPLAY");
  permissions.add("CONTROL_INPUT_JOYSTICK");
  permissions.add("CONTROL_INPUT_MEDIA_PLAYBACK");
  permissions.add("CONTROL_INPUT_MEDIA_RECORDING");
  permissions.add("CONTROL_INPUT_TEXT");
  permissions.add("CONTROL_INPUT_TV");
  permissions.add("CONTROL_MOUSE_AND_KEYBOARD");
  permissions.add("CONTROL_POWER");
  permissions.add("CONTROL_TV_SCREEN");
  permissions.add("LAUNCH");
  permissions.add("LAUNCH_WEBAPP");
  permissions.add("READ_APP_STATUS");
  permissions.add("READ_CURRENT_CHANNEL");
  permissions.add("READ_INPUT_DEVICE_LIST");
  permissions.add("READ_NETWORK_STATE");
  permissions.add("READ_POWER_STATE");
  permissions.add("READ_RUNNING_APPS");
  permissions.add("READ_TV_CHANNEL_LIST");
  permissions.add("WRITE_NOTIFICATION_TOAST");

  if (clientKey[0] != '\0') {
    payload["client-key"] = clientKey;
  }

  String output;
  serializeJson(doc, output);

  if (ws && connected) {
    ws->sendTXT(output);
    if (usePin) {
      Serial.println("[LG webOS] Sent PIN pairing request. Enter the TV code in the app.");
      pairingState = LgPairingState::WaitingForPin;
    } else if (forcePairing) {
      Serial.println("[LG webOS] Sent pairing request. Approve the prompt on the TV.");
      pairingState = LgPairingState::WaitingForApproval;
    } else {
      Serial.println("[LG webOS] Sent registration request with stored client key");
      pairingState = LgPairingState::WaitingForApproval;
    }
  }
}

void LgWebOsTv::processMessage(const char* payload) {
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, payload);

  if (error) {
    Serial.print("[LG webOS] JSON parse error: ");
    Serial.println(error.c_str());
    return;
  }

  const char* type = doc["type"];
  const char* id = doc["id"];

  if (type && strcmp(type, "registered") == 0) {
    const char* key = doc["payload"]["client-key"];
    if (key) {
      strncpy(clientKey, key, sizeof(clientKey) - 1);
      clientKey[sizeof(clientKey) - 1] = '\0';
      pairingState = LgPairingState::Paired;
      Serial.println("[LG webOS] Pairing successful!");
      Serial.print("[LG webOS] Client key: ");
      Serial.println(clientKey);

      // Request pointer socket for navigation
      connectPointerSocket();
    }
  } else if (type && strcmp(type, "error") == 0) {
    Serial.print("[LG webOS] Error response: ");
    Serial.println(payload);
    if (pairingState != LgPairingState::Paired) {
      pairingState = LgPairingState::Failed;
    }
  } else if (type && strcmp(type, "response") == 0) {
    if (id && strcmp(id, "register_0") == 0 &&
        pairingState == LgPairingState::WaitingForPin) {
      Serial.println("[LG webOS] TV is displaying a pairing PIN");
    }

    // Check if this is the pointer socket response
    if (id && strcmp(id, "pointer_socket") == 0) {
      const char* socketPath = doc["payload"]["socketPath"];
      if (socketPath) {
        strncpy(pointerSocketPath, socketPath, sizeof(pointerSocketPath) - 1);
        pointerSocketPath[sizeof(pointerSocketPath) - 1] = '\0';
        Serial.print("[LG webOS] Got pointer socket: ");
        Serial.println(pointerSocketPath);

        // Connect to pointer socket
        if (!pointerWs) {
          pointerWs = new WebSocketsClient();
        }

        pointerWs->begin(tvIp, LG_WEBOS_PORT, pointerSocketPath);
        pointerWs->onEvent([](WStype_t type, uint8_t* payload, size_t length) {
          if (instance) {
            instance->onPointerEvent(static_cast<int>(type), payload, length);
          }
        });
      }
    }

    // Command response
    Serial.print("[LG webOS] Command response: ");
    Serial.println(id ? id : "unknown");
  }
}

void LgWebOsTv::connectPointerSocket() {
  if (!connected || !ws) {
    return;
  }

  requestId++;

  JsonDocument doc;
  doc["type"] = "request";

  char idBuf[32];
  snprintf(idBuf, sizeof(idBuf), "pointer_socket");
  doc["id"] = idBuf;
  doc["uri"] = "ssap://com.webos.service.networkinput/getPointerInputSocket";

  String output;
  serializeJson(doc, output);

  ws->sendTXT(output);
  Serial.println("[LG webOS] Requested pointer input socket");
}

void LgWebOsTv::onPointerEvent(int type, uint8_t* payload, size_t length) {
  WStype_t wsType = static_cast<WStype_t>(type);

  switch (wsType) {
    case WStype_CONNECTED:
      Serial.println("[LG webOS] Pointer socket connected");
      pointerConnected = true;
      break;

    case WStype_DISCONNECTED:
      Serial.println("[LG webOS] Pointer socket disconnected");
      pointerConnected = false;
      break;

    case WStype_TEXT:
      if (payload && length > 0) {
        processPointerMessage(reinterpret_cast<const char*>(payload));
      }
      break;

    case WStype_ERROR:
      Serial.println("[LG webOS] Pointer socket error");
      pointerConnected = false;
      break;

    default:
      break;
  }
}

void LgWebOsTv::processPointerMessage(const char* payload) {
  // Pointer socket typically doesn't send much back
  Serial.print("[LG webOS] Pointer message: ");
  Serial.println(payload);
}

bool LgWebOsTv::sendPointerCommand(const char* type) {
  if (!pointerConnected || !pointerWs) {
    Serial.println("[LG webOS] Cannot send pointer command: socket not connected");
    return false;
  }

  JsonDocument doc;
  doc["type"] = type;

  String output;
  serializeJson(doc, output);

  pointerWs->sendTXT(output);
  return true;
}

bool LgWebOsTv::sendCommand(const char* uri) {
  if (!connected || !ws) {
    Serial.println("[LG webOS] Cannot send command: not connected");
    return false;
  }

  static uint32_t commandId = 0;
  commandId++;

  JsonDocument doc;
  doc["type"] = "request";

  char idBuf[32];
  snprintf(idBuf, sizeof(idBuf), "cmd_%u", commandId);
  doc["id"] = idBuf;
  doc["uri"] = uri;

  String output;
  serializeJson(doc, output);

  ws->sendTXT(output);
  return true;
}

bool LgWebOsTv::sendPowerOff() {
  return sendCommand("ssap://system/turnOff");
}

bool LgWebOsTv::sendVolumeUp() {
  return sendCommand("ssap://audio/volumeUp");
}

bool LgWebOsTv::sendVolumeDown() {
  return sendCommand("ssap://audio/volumeDown");
}

bool LgWebOsTv::sendMute() {
  return sendCommand("ssap://audio/setMute");
}

bool LgWebOsTv::sendChannelUp() {
  return sendCommand("ssap://tv/channelUp");
}

bool LgWebOsTv::sendChannelDown() {
  return sendCommand("ssap://tv/channelDown");
}

bool LgWebOsTv::sendPlay() {
  return sendCommand("ssap://media.controls/play");
}

bool LgWebOsTv::sendPause() {
  return sendCommand("ssap://media.controls/pause");
}

bool LgWebOsTv::sendStop() {
  return sendCommand("ssap://media.controls/stop");
}

bool LgWebOsTv::sendUp() {
  return sendPointerCommand("move") && sendPointerCommand("button") && sendCommand("ssap://com.webos.service.ime/sendEnterKey");
}

bool LgWebOsTv::sendDown() {
  return sendPointerCommand("move") && sendPointerCommand("button") && sendCommand("ssap://com.webos.service.ime/sendEnterKey");
}

bool LgWebOsTv::sendLeft() {
  return sendPointerCommand("move") && sendPointerCommand("button") && sendCommand("ssap://com.webos.service.ime/sendEnterKey");
}

bool LgWebOsTv::sendRight() {
  return sendPointerCommand("move") && sendPointerCommand("button") && sendCommand("ssap://com.webos.service.ime/sendEnterKey");
}

bool LgWebOsTv::sendOk() {
  return sendPointerCommand("click");
}

bool LgWebOsTv::sendBack() {
  return sendCommand("ssap://system.launcher/close");
}

bool LgWebOsTv::sendHome() {
  return sendCommand("ssap://system.launcher/open");
}

bool LgWebOsTv::sendMenu() {
  return sendCommand("ssap://com.webos.applicationManager/getForegroundAppInfo");
}

bool LgWebOsTv::sendInput() {
  return sendCommand("ssap://com.webos.applicationManager/launch") && sendCommand("ssap://system/turnOff");
}

void LgWebOsTv::handle() {
  if (ws) {
    ws->loop();
  }

  if (pointerWs) {
    pointerWs->loop();
  }

  // Check pairing timeout
  if (pairingState == LgPairingState::WaitingForPin ||
      pairingState == LgPairingState::WaitingForApproval) {
    if (millis() > pairingTimeout) {
      Serial.println("[LG webOS] Pairing timeout");
      pairingState = LgPairingState::Failed;
      disconnect();
    }
  }
}
