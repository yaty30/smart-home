#include "LgWebOsTv.h"
#include <WebSocketsClient.h>
#include <Arduino.h>
#include <ArduinoJson.h>

constexpr uint16_t LG_WEBOS_PORT = 3000;
constexpr unsigned long PAIRING_TIMEOUT_MS = 60000;  // 60 seconds
constexpr unsigned long POWER_OFF_GRACE_MS = 5000;   // 5 seconds before marking SLEEPING

LgWebOsTv* LgWebOsTv::instance = nullptr;

LgWebOsTv::LgWebOsTv()
    : ws(nullptr),
      pointerWs(nullptr),
      pairingState(LgPairingState::Idle),
      connectionState(LgConnectionState::Idle),
      wsConnected(false),
      pointerConnected(false),
      registrationSent(false),
      pairingTimeout(0),
      lastSuccessfulResponse(0),
      reconnectAttemptTime(0),
      reconnectAttempts(0),
      requestId(0),
      powerOffSent(false),
      powerOffTime(0) {
  clientKey[0] = '\0';
  tvIp[0] = '\0';
  tvMac[0] = '\0';
  pointerSocketPath[0] = '\0';
  instance = this;
}

LgWebOsTv::~LgWebOsTv() {
  stopSession();
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

void LgWebOsTv::startPairing(const char* ip, const char* mac) {
  if (pairingState == LgPairingState::WaitingForApproval ||
      pairingState == LgPairingState::WaitingForPin) {
    Serial.println("[LG webOS] Pairing already in progress");
    return;
  }

  stopSession();
  resetReconnectState();

  strncpy(tvIp, ip, sizeof(tvIp) - 1);
  tvIp[sizeof(tvIp) - 1] = '\0';

  if (mac && strlen(mac) > 0) {
    strncpy(tvMac, mac, sizeof(tvMac) - 1);
    tvMac[sizeof(tvMac) - 1] = '\0';
  }

  clientKey[0] = '\0';
  pairingState = LgPairingState::Connecting;
  connectionState = LgConnectionState::Connecting;
  powerOffSent = false;

  Serial.print("[LG webOS] Starting first-time pairing with ");
  Serial.print(ip);
  Serial.println(":3000");

  initiateConnection();
  pairingTimeout = millis() + PAIRING_TIMEOUT_MS;
}

void LgWebOsTv::startSession(const char* ip, const char* storedClientKey, const char* mac) {
  if (connectionState == LgConnectionState::Connecting ||
      connectionState == LgConnectionState::Registering) {
    Serial.println("[LG webOS] Session start already in progress");
    return;
  }

  stopSession();
  resetReconnectState();

  strncpy(tvIp, ip, sizeof(tvIp) - 1);
  tvIp[sizeof(tvIp) - 1] = '\0';

  strncpy(clientKey, storedClientKey, sizeof(clientKey) - 1);
  clientKey[sizeof(clientKey) - 1] = '\0';

  if (mac && strlen(mac) > 0) {
    strncpy(tvMac, mac, sizeof(tvMac) - 1);
    tvMac[sizeof(tvMac) - 1] = '\0';
  }

  pairingState = LgPairingState::Idle;  // Not a pairing flow
  connectionState = LgConnectionState::Connecting;
  powerOffSent = false;

  Serial.print("[LG webOS] Starting session with ");
  Serial.print(ip);
  Serial.println(" using stored credentials");

  initiateConnection();
}

void LgWebOsTv::stopSession() {
  Serial.println("[LG webOS] Stopping session");

  if (ws) {
    ws->disconnect();
  }
  if (pointerWs) {
    pointerWs->disconnect();
  }

  wsConnected = false;
  pointerConnected = false;
  registrationSent = false;

  // Keep credential and MAC, mark transport as idle
  if (connectionState != LgConnectionState::Idle) {
    connectionState = LgConnectionState::Idle;
  }

  // Reset pairing state only if not already paired
  if (pairingState != LgPairingState::Paired) {
    pairingState = LgPairingState::Idle;
  }

  powerOffSent = false;
  resetReconnectState();
}

void LgWebOsTv::disconnect() {
  // Alias for stopSession - preserves credential
  stopSession();
}

void LgWebOsTv::initiateConnection() {
  if (!ws) {
    ws = new WebSocketsClient();
  }

  ws->begin(tvIp, LG_WEBOS_PORT, "/");
  ws->onEvent([](WStype_t type, uint8_t* payload, size_t length) {
    if (instance) {
      instance->onWebSocketEvent(static_cast<int>(type), payload, length);
    }
  });

  registrationSent = false;
  Serial.println("[LG webOS] WebSocket connection initiated");
}

void LgWebOsTv::onWebSocketEvent(int type, uint8_t* payload, size_t length) {
  WStype_t wsType = static_cast<WStype_t>(type);

  switch (wsType) {
    case WStype_CONNECTED: {
      Serial.println("[LG webOS] WebSocket connected");
      wsConnected = true;
      registrationSent = false;

      bool isFirstTimePairing = (pairingState == LgPairingState::Connecting);
      bool hasStoredKey = (clientKey[0] != '\0');

      connectionState = LgConnectionState::Registering;

      if (isFirstTimePairing) {
        // First-time pairing: request new credential
        sendRegisterRequest(true, false);
      } else if (hasStoredKey) {
        // Session reconnect: use stored credential
        sendRegisterRequest(false, false);
      } else {
        Serial.println("[LG webOS] ERROR: Connected without pairing flow or stored key");
        markConnectionFailed();
      }
      break;
    }

    case WStype_DISCONNECTED:
      Serial.println("[LG webOS] WebSocket disconnected");
      wsConnected = false;
      registrationSent = false;

      // If we recently sent power_off, this is expected
      if (powerOffSent && (millis() - powerOffTime < POWER_OFF_GRACE_MS)) {
        Serial.println("[LG webOS] Expected disconnect after power_off");
        markSleeping();
        return;
      }

      // Only schedule reconnect if we have a valid credential and session is active
      if (clientKey[0] != '\0' &&
          connectionState != LgConnectionState::Idle &&
          connectionState != LgConnectionState::Sleeping &&
          connectionState != LgConnectionState::Failed) {
        connectionState = LgConnectionState::Reconnecting;
        scheduleReconnect();
      } else {
        if (pairingState == LgPairingState::Connecting ||
            pairingState == LgPairingState::WaitingForPin ||
            pairingState == LgPairingState::WaitingForApproval) {
          pairingState = LgPairingState::Failed;
        }
        if (connectionState != LgConnectionState::Sleeping) {
          connectionState = LgConnectionState::Failed;
        }
      }
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
      markConnectionFailed();
      break;

    default:
      break;
  }
}

bool LgWebOsTv::submitPin(const char* pin) {
  if (!wsConnected || !ws || pairingState != LgPairingState::WaitingForPin) {
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

  if (ws && wsConnected) {
    ws->sendTXT(output);
    registrationSent = true;

    if (usePin) {
      Serial.println("[LG webOS] Sent PIN pairing request");
      pairingState = LgPairingState::WaitingForPin;
    } else if (forcePairing) {
      Serial.println("[LG webOS] Sent pairing request - approve on TV");
      pairingState = LgPairingState::WaitingForApproval;
    } else {
      Serial.println("[LG webOS] Sent registration with stored client key");
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

  lastSuccessfulResponse = millis();

  if (type && strcmp(type, "registered") == 0) {
    const char* key = doc["payload"]["client-key"];
    if (key) {
      strncpy(clientKey, key, sizeof(clientKey) - 1);
      clientKey[sizeof(clientKey) - 1] = '\0';
      pairingState = LgPairingState::Paired;
      connectionState = LgConnectionState::Ready;

      resetReconnectState();

      Serial.println("[LG webOS] Registration successful - connection READY");

      // Request pointer socket for navigation
      connectPointerSocket();

      // Try to get MAC address if we don't have it
      if (tvMac[0] == '\0') {
        requestNetworkInfo();
      }
    }
  } else if (type && strcmp(type, "error") == 0) {
    const char* errorMsg = doc["error"];
    Serial.print("[LG webOS] Error response: ");
    Serial.println(errorMsg ? errorMsg : payload);

    // If registration failed, the stored key might be revoked
    if (id && strcmp(id, "register_0") == 0) {
      Serial.println("[LG webOS] Registration failed - stored key may be revoked");
      markConnectionFailed();
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

    // Check for network info response (to extract MAC)
    if (id && strcmp(id, "network_info") == 0) {
      const char* wiredMac = doc["payload"]["wiredInfo"]["macAddress"];
      const char* wirelessMac = doc["payload"]["wifiInfo"]["macAddress"];
      const char* ethernetMac = doc["payload"]["ethernet"]["macAddress"];

      const char* foundMac = nullptr;
      if (wiredMac && strlen(wiredMac) > 0) {
        foundMac = wiredMac;
      } else if (ethernetMac && strlen(ethernetMac) > 0) {
        foundMac = ethernetMac;
      } else if (wirelessMac && strlen(wirelessMac) > 0) {
        foundMac = wirelessMac;
      }

      if (foundMac && tvMac[0] == '\0') {
        strncpy(tvMac, foundMac, sizeof(tvMac) - 1);
        tvMac[sizeof(tvMac) - 1] = '\0';
        Serial.print("[LG webOS] Obtained MAC address: ");
        Serial.println(tvMac);
      }
    }
  }
}

void LgWebOsTv::connectPointerSocket() {
  if (!wsConnected || !ws) {
    return;
  }

  requestId++;

  JsonDocument doc;
  doc["type"] = "request";
  doc["id"] = "pointer_socket";
  doc["uri"] = "ssap://com.webos.service.networkinput/getPointerInputSocket";

  String output;
  serializeJson(doc, output);

  ws->sendTXT(output);
  Serial.println("[LG webOS] Requested pointer input socket");
}

void LgWebOsTv::requestNetworkInfo() {
  if (!wsConnected || !ws) {
    return;
  }

  JsonDocument doc;
  doc["type"] = "request";
  doc["id"] = "network_info";
  doc["uri"] = "ssap://com.webos.service.connectionmanager/getInfo";

  String output;
  serializeJson(doc, output);

  ws->sendTXT(output);
  Serial.println("[LG webOS] Requested network info for MAC address");
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

      // Try to reconnect pointer socket if main connection is ready
      if (connectionState == LgConnectionState::Ready && wsConnected) {
        Serial.println("[LG webOS] Attempting pointer socket reconnect");
        connectPointerSocket();
      }
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
}

bool LgWebOsTv::sendPointerCommand(const char* type) {
  if (!pointerConnected || !pointerWs) {
    Serial.println("[LG webOS] Cannot send pointer command: socket not connected");
    return false;
  }

  if (connectionState != LgConnectionState::Ready) {
    Serial.println("[LG webOS] Cannot send pointer command: connection not ready");
    return false;
  }

  pointerWs->sendTXT(type);
  return true;
}

bool LgWebOsTv::sendCommand(const char* uri) {
  if (!wsConnected || !ws) {
    Serial.println("[LG webOS] Cannot send command: not connected");
    return false;
  }

  if (connectionState != LgConnectionState::Ready) {
    Serial.println("[LG webOS] Cannot send command: connection not ready");
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
  bool result = sendCommand("ssap://system/turnOff");
  if (result) {
    powerOffSent = true;
    powerOffTime = millis();
    Serial.println("[LG webOS] Power off sent - will mark SLEEPING on disconnect");
  }
  return result;
}

void LgWebOsTv::startWakeSequence() {
  if (connectionState == LgConnectionState::Sleeping) {
    connectionState = LgConnectionState::Waking;
    resetReconnectState();
    Serial.println("[LG webOS] Starting wake sequence - will attempt reconnect");
  }
}

void LgWebOsTv::markSleeping() {
  connectionState = LgConnectionState::Sleeping;
  Serial.println("[LG webOS] TV marked as SLEEPING");
}

bool LgWebOsTv::sendVolumeUp() {
  return sendCommand("ssap://audio/volumeUp");
}

bool LgWebOsTv::sendVolumeDown() {
  return sendCommand("ssap://audio/volumeDown");
}

bool LgWebOsTv::sendMute() {
  return sendCommand("ssap://audio/setMute") && sendCommand("ssap://audio/volumeMute");
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

bool LgWebOsTv::sendRewind() {
  return sendCommand("ssap://media.controls/rewind");
}

bool LgWebOsTv::sendFastForward() {
  return sendCommand("ssap://media.controls/fastForward");
}

bool LgWebOsTv::sendUp() {
  if (!pointerConnected || !pointerWs) {
    Serial.println("[LG webOS] Pointer socket not ready, cannot send UP");
    return false;
  }
  return sendPointerCommand("type:button\n\n") && sendPointerCommand("type:move\ndx:0\ndy:-1\ndown:0\n\n");
}

bool LgWebOsTv::sendDown() {
  if (!pointerConnected || !pointerWs) {
    Serial.println("[LG webOS] Pointer socket not ready, cannot send DOWN");
    return false;
  }
  return sendPointerCommand("type:button\n\n") && sendPointerCommand("type:move\ndx:0\ndy:1\ndown:0\n\n");
}

bool LgWebOsTv::sendLeft() {
  if (!pointerConnected || !pointerWs) {
    Serial.println("[LG webOS] Pointer socket not ready, cannot send LEFT");
    return false;
  }
  return sendPointerCommand("type:button\n\n") && sendPointerCommand("type:move\ndx:-1\ndy:0\ndown:0\n\n");
}

bool LgWebOsTv::sendRight() {
  if (!pointerConnected || !pointerWs) {
    Serial.println("[LG webOS] Pointer socket not ready, cannot send RIGHT");
    return false;
  }
  return sendPointerCommand("type:button\n\n") && sendPointerCommand("type:move\ndx:1\ndy:0\ndown:0\n\n");
}

bool LgWebOsTv::sendOk() {
  if (!pointerConnected || !pointerWs) {
    Serial.println("[LG webOS] Pointer socket not ready, cannot send OK/CLICK");
    return false;
  }
  return sendPointerCommand("type:click\n\n");
}

bool LgWebOsTv::sendBack() {
  return sendCommand("ssap://system.launcher/close");
}

bool LgWebOsTv::sendHome() {
  return sendCommand("ssap://system.launcher/open");
}

bool LgWebOsTv::sendMenu() {
  return sendCommand("ssap://com.webos.service.menu/getMenu");
}

bool LgWebOsTv::sendInput() {
  return sendCommand("ssap://tv/switchInput");
}

void LgWebOsTv::handle() {
  if (ws) {
    ws->loop();
  }

  if (pointerWs) {
    pointerWs->loop();
  }

  // Check pairing timeout (first-time pairing only)
  if (pairingState == LgPairingState::WaitingForPin ||
      pairingState == LgPairingState::WaitingForApproval) {
    if (millis() > pairingTimeout) {
      Serial.println("[LG webOS] Pairing timeout");
      pairingState = LgPairingState::Failed;
      markConnectionFailed();
    }
  }

  // Handle automatic reconnect (non-blocking)
  handleReconnect();
}

void LgWebOsTv::handleReconnect() {
  // Only reconnect if in Reconnecting or Waking state
  if (connectionState != LgConnectionState::Reconnecting &&
      connectionState != LgConnectionState::Waking) {
    return;
  }

  if (clientKey[0] == '\0') {
    // No credential to use for reconnect
    return;
  }

  unsigned long now = millis();

  // Check if it's time to attempt reconnect
  if (now < reconnectAttemptTime) {
    return;
  }

  reconnectAttempts++;
  Serial.print("[LG webOS] Reconnect attempt ");
  Serial.println(reconnectAttempts);

  connectionState = LgConnectionState::Connecting;
  initiateConnection();

  // Schedule next attempt in case this one fails
  scheduleReconnect();
}

void LgWebOsTv::scheduleReconnect() {
  unsigned long delay = getReconnectDelay();
  reconnectAttemptTime = millis() + delay;

  Serial.print("[LG webOS] Next reconnect in ");
  Serial.print(delay / 1000);
  Serial.println(" seconds");
}

unsigned long LgWebOsTv::getReconnectDelay() const {
  // Exponential backoff: 2s, 4s, 8s, 16s, 30s (capped)
  unsigned long delay = RECONNECT_INITIAL_DELAY_MS * (1 << reconnectAttempts);
  return min(delay, RECONNECT_MAX_DELAY_MS);
}

void LgWebOsTv::resetReconnectState() {
  reconnectAttempts = 0;
  reconnectAttemptTime = 0;
}

void LgWebOsTv::markConnectionFailed() {
  connectionState = LgConnectionState::Failed;
  stopSession();
  Serial.println("[LG webOS] Connection marked as FAILED");
}
