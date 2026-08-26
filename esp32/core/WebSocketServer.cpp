#include "WebSocketServer.h"

#include "Config.h"
#include "Pairing.h"
#include "State.h"
#include "StateManager.h"
#include "WiFiManager.h"

#include <ctype.h>
#include <WebSocketsServer.h>

const uint8_t MAX_AUTHENTICATED_CLIENTS = 8;
bool authenticatedClients[MAX_AUTHENTICATED_CLIENTS] = { false };

WebSocketsServer webSocket(WEBSOCKET_PORT);

String webSocketUrl() {
  if (!isWiFiConnected()) {
    return "";
  }

  String url = "ws://";
  url += currentIPString();
  if (WEBSOCKET_PORT != 80) {
    url += ":";
    url += String(WEBSOCKET_PORT);
  }
  url += WEBSOCKET_PATH;
  return url;
}

String deviceStateJson() {
  String body = "{";
  body += "\"type\":\"state\",";
  body += "\"ac\":" + acStateJson() + ",";
  body += "\"display\":" + displayStateJson() + ",";
  body += "\"connection\":{";
  body += "\"wifi\":" + boolString(isWiFiConnected());
  body += "}";
  body += "}";
  return body;
}

String commandAckJson(const String& requestId, bool ok, const String& error = "") {
  String body = "{";
  body += "\"type\":\"command.ack\",";
  body += "\"requestId\":\"" + jsonEscape(requestId) + "\",";
  body += "\"ok\":" + boolString(ok);
  if (!ok) {
    body += ",\"error\":\"" + jsonEscape(error) + "\"";
  }
  body += "}";
  return body;
}

int jsonStringStart(const String& json, const String& key) {
  String pattern = "\"" + key + "\"";
  int keyIndex = json.indexOf(pattern);
  if (keyIndex < 0) {
    return -1;
  }

  int colonIndex = json.indexOf(':', keyIndex + pattern.length());
  if (colonIndex < 0) {
    return -1;
  }

  int quoteIndex = json.indexOf('"', colonIndex + 1);
  if (quoteIndex < 0) {
    return -1;
  }

  return quoteIndex + 1;
}

bool getJsonString(const String& json, const String& key, String& value) {
  int start = jsonStringStart(json, key);
  if (start < 0) {
    return false;
  }

  String parsed;
  bool escaped = false;
  for (int i = start; i < json.length(); i++) {
    char c = json[i];
    if (escaped) {
      parsed += c;
      escaped = false;
      continue;
    }

    if (c == '\\') {
      escaped = true;
      continue;
    }

    if (c == '"') {
      value = parsed;
      return true;
    }

    parsed += c;
  }

  return false;
}

String payloadToString(const uint8_t* payload, size_t length) {
  String message;
  message.reserve(length);

  for (size_t i = 0; i < length; i++) {
    message += static_cast<char>(payload[i]);
  }

  return message;
}

bool getJsonBool(const String& json, const String& key, bool& value) {
  String pattern = "\"" + key + "\"";
  int keyIndex = json.indexOf(pattern);
  if (keyIndex < 0) {
    return false;
  }

  int colonIndex = json.indexOf(':', keyIndex + pattern.length());
  if (colonIndex < 0) {
    return false;
  }

  int valueIndex = colonIndex + 1;
  while (valueIndex < json.length() && isspace(json[valueIndex])) {
    valueIndex++;
  }

  if (json.substring(valueIndex, valueIndex + 4) == "true") {
    value = true;
    return true;
  }

  if (json.substring(valueIndex, valueIndex + 5) == "false") {
    value = false;
    return true;
  }

  return false;
}

bool getJsonInt(const String& json, const String& key, int& value) {
  String pattern = "\"" + key + "\"";
  int keyIndex = json.indexOf(pattern);
  if (keyIndex < 0) {
    return false;
  }

  int colonIndex = json.indexOf(':', keyIndex + pattern.length());
  if (colonIndex < 0) {
    return false;
  }

  int valueIndex = colonIndex + 1;
  while (valueIndex < json.length() && isspace(json[valueIndex])) {
    valueIndex++;
  }

  int endIndex = valueIndex;
  if (endIndex < json.length() && json[endIndex] == '-') {
    endIndex++;
  }

  while (endIndex < json.length() && isDigit(json[endIndex])) {
    endIndex++;
  }

  if (endIndex == valueIndex) {
    return false;
  }

  value = json.substring(valueIndex, endIndex).toInt();
  return true;
}

void markAuthenticated(uint8_t clientId, bool authenticated) {
  if (clientId < MAX_AUTHENTICATED_CLIENTS) {
    authenticatedClients[clientId] = authenticated;
  }
}

bool isAuthenticated(uint8_t clientId) {
  return clientId < MAX_AUTHENTICATED_CLIENTS && authenticatedClients[clientId];
}

void sendText(uint8_t clientId, String message) {
  webSocket.sendTXT(clientId, message);
}

void closeClient(uint8_t clientId) {
  webSocket.disconnect(clientId);
}

void handleAuthMessage(uint8_t clientId, const String& message) {
  String token;
  if (!getJsonString(message, "token", token) || !isAuthorizedToken(token)) {
    sendText(clientId, "{\"type\":\"auth.result\",\"ok\":false,\"error\":\"invalid_token\"}");
    closeClient(clientId);
    return;
  }

  if (pairingMode && !isPaired) {
    completePairing();
  }

  markAuthenticated(clientId, true);
  sendText(clientId, "{\"type\":\"auth.result\",\"ok\":true}");
  sendText(clientId, deviceStateJson());
}

void handleCommandMessage(uint8_t clientId, const String& message) {
  String requestId;
  String command;
  if (!getJsonString(message, "requestId", requestId) || !getJsonString(message, "command", command)) {
    sendText(clientId, commandAckJson(requestId, false, "invalid_command"));
    return;
  }

  AcState nextState = acState;

  if (command == "display.screenPower" || command == "display.setScreen") {
    bool screenOn;
    if (!getJsonBool(message, "value", screenOn)) {
      sendText(clientId, commandAckJson(requestId, false, "invalid_screen_power"));
      return;
    }

    DisplayState nextDisplayState = displayState;
    nextDisplayState.screenOn = screenOn;
    applyDisplayState(nextDisplayState);
    sendText(clientId, commandAckJson(requestId, true));
    return;
  }

  if (command == "display.qrVisibility" || command == "display.setQrVisible") {
    bool qrVisible;
    if (!getJsonBool(message, "value", qrVisible)) {
      sendText(clientId, commandAckJson(requestId, false, "invalid_qr_visibility"));
      return;
    }

    DisplayState nextDisplayState = displayState;
    nextDisplayState.qrVisible = qrVisible;
    applyDisplayState(nextDisplayState);
    sendText(clientId, commandAckJson(requestId, true));
    return;
  }

  if (command == "ac.power") {
    bool power;
    if (!getJsonBool(message, "value", power)) {
      sendText(clientId, commandAckJson(requestId, false, "invalid_power"));
      return;
    }
    nextState.power = power;
  } else if (command == "ac.quiet" || command == "ac.setQuiet") {
    bool quiet;
    if (!getJsonBool(message, "value", quiet)) {
      sendText(clientId, commandAckJson(requestId, false, "invalid_quiet"));
      return;
    }
    nextState.quiet = quiet;
    if (quiet) {
      nextState.powerful = false;
    }
  } else if (command == "ac.powerful" || command == "ac.setPowerful") {
    bool powerful;
    if (!getJsonBool(message, "value", powerful)) {
      sendText(clientId, commandAckJson(requestId, false, "invalid_powerful"));
      return;
    }
    nextState.powerful = powerful;
    if (powerful) {
      nextState.quiet = false;
    }
  } else if (command == "ac.setTemperature") {
    int temp;
    if (!getJsonInt(message, "value", temp) || !parseTemperatureValue(temp, nextState.temperature)) {
      sendText(clientId, commandAckJson(requestId, false, "invalid_temperature"));
      return;
    }
  } else if (command == "ac.setMode") {
    String mode;
    if (!getJsonString(message, "value", mode) || !parseMode(mode, nextState.mode)) {
      sendText(clientId, commandAckJson(requestId, false, "invalid_mode"));
      return;
    }
  } else if (command == "ac.setFan") {
    String fanText;
    int fanNumber;
    if (getJsonString(message, "value", fanText)) {
      if (!parseFan(fanText, nextState.fan)) {
        sendText(clientId, commandAckJson(requestId, false, "invalid_fan"));
        return;
      }
    } else if (getJsonInt(message, "value", fanNumber)) {
      if (fanNumber < 1 || fanNumber > 5) {
        sendText(clientId, commandAckJson(requestId, false, "invalid_fan"));
        return;
      }
      nextState.fan = static_cast<uint8_t>(fanNumber - 1);
    } else {
      sendText(clientId, commandAckJson(requestId, false, "invalid_fan"));
      return;
    }
  } else if (command == "ac.setSwing" || command == "ac.setSwingVertical") {
    String swing;
    int swingNumber;
    if (getJsonString(message, "value", swing)) {
      if (!parseSwingVertical(swing, nextState.swingVertical)) {
        sendText(clientId, commandAckJson(requestId, false, "invalid_swing"));
        return;
      }
    } else if (getJsonInt(message, "value", swingNumber)) {
      if (!parseSwingVertical(String(swingNumber), nextState.swingVertical)) {
        sendText(clientId, commandAckJson(requestId, false, "invalid_swing"));
        return;
      }
    } else {
      sendText(clientId, commandAckJson(requestId, false, "invalid_swing"));
      return;
    }
  } else if (command == "ac.setSwingHorizontal") {
    String swing;
    int swingNumber;
    if (getJsonString(message, "value", swing)) {
      if (!parseSwingHorizontal(swing, nextState.swingHorizontal)) {
        sendText(clientId, commandAckJson(requestId, false, "invalid_swing"));
        return;
      }
    } else if (getJsonInt(message, "value", swingNumber)) {
      if (!parseSwingHorizontal(String(swingNumber), nextState.swingHorizontal)) {
        sendText(clientId, commandAckJson(requestId, false, "invalid_swing"));
        return;
      }
    } else {
      sendText(clientId, commandAckJson(requestId, false, "invalid_swing"));
      return;
    }
  } else {
    sendText(clientId, commandAckJson(requestId, false, "unsupported_command"));
    return;
  }

  applyACState(nextState);
  sendText(clientId, commandAckJson(requestId, true));
}

void handleTextMessage(uint8_t clientId, const String& message) {
  String type;
  if (!getJsonString(message, "type", type)) {
    sendText(clientId, "{\"type\":\"error\",\"error\":\"invalid_message\"}");
    return;
  }

  if (!isAuthenticated(clientId)) {
    if (type != "auth") {
      sendText(clientId, "{\"type\":\"auth.result\",\"ok\":false,\"error\":\"auth_required\"}");
      closeClient(clientId);
      return;
    }

    handleAuthMessage(clientId, message);
    return;
  }

  if (type == "command") {
    handleCommandMessage(clientId, message);
    return;
  }

  if (type == "state.get") {
    sendText(clientId, deviceStateJson());
    return;
  }

  sendText(clientId, "{\"type\":\"error\",\"error\":\"unsupported_type\"}");
}

void onWebSocketEvent(uint8_t clientId, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      markAuthenticated(clientId, false);
      break;
    case WStype_CONNECTED:
      markAuthenticated(clientId, false);
      break;
    case WStype_TEXT:
      handleTextMessage(clientId, payloadToString(payload, length));
      break;
    default:
      break;
  }
}

void initWebSocketServer() {
  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);

  Serial.print("WebSocket server started at ");
  Serial.println(webSocketUrl());
}

void handleWebSocketServer() {
  webSocket.loop();
}

void broadcastState() {
  String state = deviceStateJson();
  for (uint8_t clientId = 0; clientId < MAX_AUTHENTICATED_CLIENTS; clientId++) {
    if (authenticatedClients[clientId]) {
      webSocket.sendTXT(clientId, state);
    }
  }
}
