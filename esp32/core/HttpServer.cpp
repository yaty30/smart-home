#include "HttpServer.h"

#include <WiFi.h>

#include "ACController.h"
#include "Config.h"
#include "Pairing.h"
#include "ScheduleManager.h"
#include "State.h"
#include "StateManager.h"
#include "StorageManager.h"
#include "WebSocketServer.h"
#include "WiFiManager.h"

WebServer server(80);

const char* AUTH_HEADER_KEYS[] = { "Authorization" };

void sendJson(int statusCode, const String& body) {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(statusCode, "application/json", body);
}

void sendNotFound() {
  sendJson(404, "{\"success\":false,\"error\":\"Not found\"}");
}

String methodString(HTTPMethod method) {
  switch (method) {
    case HTTP_GET:
      return "GET";
    case HTTP_POST:
      return "POST";
    case HTTP_PUT:
      return "PUT";
    case HTTP_PATCH:
      return "PATCH";
    case HTTP_DELETE:
      return "DELETE";
    case HTTP_OPTIONS:
      return "OPTIONS";
    default:
      return "OTHER";
  }
}

void logRequestContent(const char* handlerName) {
  Serial.println();
  Serial.print("[HTTP] ");
  Serial.print(handlerName);
  Serial.print(" ");
  Serial.print(methodString(server.method()));
  Serial.print(" ");
  Serial.println(server.uri());

  if (server.args() == 0) {
    Serial.println("[HTTP] args: none");
  } else {
    Serial.println("[HTTP] args:");
    for (uint8_t i = 0; i < server.args(); i++) {
      Serial.print("  ");
      Serial.print(server.argName(i));
      Serial.print(" = ");
      if (server.argName(i).equalsIgnoreCase("password")) {
        Serial.println("<redacted>");
      } else {
        Serial.println(server.arg(i));
      }
    }
  }

  if (server.hasArg("plain")) {
    if (server.uri() == "/setup/wifi") {
      Serial.println("[HTTP] body: <redacted>");
    } else {
      Serial.print("[HTTP] body: ");
      Serial.println(server.arg("plain"));
    }
  }

  Serial.print("[HTTP] Authorization header present: ");
  Serial.println(server.header("Authorization").length() > 0 ? "yes" : "no");
}

void applyACStateAndRespond(const AcState& nextState) {
  applyACState(nextState);

  String body = "{";
  body += "\"success\":true,";
  body += "\"power\":\"" + powerString(acState.power) + "\",";
  body += "\"temperature\":" + String(acState.temperature) + ",";
  body += "\"mode\":\"" + modeString(acState.mode) + "\",";
  body += "\"fan\":\"" + fanString(acState.fan) + "\",";
  body += "\"swingVertical\":\"" + swingVerticalString(acState.swingVertical) + "\",";
  body += "\"swingHorizontal\":\"" + swingHorizontalString(acState.swingHorizontal) + "\",";
  body += "\"quiet\":" + boolString(acState.quiet) + ",";
  body += "\"powerful\":" + boolString(acState.powerful) + ",";
  body += "\"message\":\"IR command queued\"";
  body += "}";

  sendJson(200, body);
}

String statusJson() {
  String body = "{";
  body += "\"ac\":" + acStateJson() + ",";
  body += "\"controllerId\":\"" + jsonEscape(controllerId()) + "\",";
  body += "\"wifi\":{";
  body += "\"connected\":" + boolString(isWiFiConnected()) + ",";
  body += "\"rssi\":" + String(isWiFiConnected() ? WiFi.RSSI() : 0) + ",";
  body += "\"ip\":\"" + currentIPString() + "\"";
  body += "},";
  body += "\"power\":\"" + powerString(acState.power) + "\",";
  body += "\"temperature\":" + String(acState.temperature) + ",";
  body += "\"mode\":\"" + modeString(acState.mode) + "\",";
  body += "\"fan\":\"" + fanString(acState.fan) + "\",";
  body += "\"swingVertical\":\"" + swingVerticalString(acState.swingVertical) + "\",";
  body += "\"swingHorizontal\":\"" + swingHorizontalString(acState.swingHorizontal) + "\",";
  body += "\"quiet\":" + boolString(acState.quiet) + ",";
  body += "\"powerful\":" + boolString(acState.powerful) + ",";
  body += "\"paired\":" + boolString(isPaired) + ",";
  body += "\"pendingIR\":" + boolString(pendingIR) + ",";
  body += "\"wifiConnected\":" + boolString(isWiFiConnected()) + ",";
  body += "\"rssi\":" + String(isWiFiConnected() ? WiFi.RSSI() : 0) + ",";
  body += "\"ip\":\"" + currentIPString() + "\",";
  body += "\"websocket\":\"" + jsonEscape(webSocketUrl()) + "\"";
  body += "}";
  return body;
}

void handleRoot() {
  logRequestContent("handleRoot");

  String ip = currentIPString();
  String body = "{";
  body += "\"name\":\"ESP32-C3 Panasonic AC Controller\",";
  body += "\"controllerId\":\"" + jsonEscape(controllerId()) + "\",";
  body += "\"shortId\":\"" + jsonEscape(controllerShortId()) + "\",";
  body += "\"ip\":\"" + ip + "\",";
  body += "\"token\":\"" + jsonEscape(PAIRING_TOKEN) + "\",";
  body += "\"websocket\":\"" + jsonEscape(webSocketUrl()) + "\",";
  body += "\"endpoints\":[";
  body += "\"GET /\",";
  body += "\"GET /status\",";
  body += "\"GET /ac?power=on|off&temp=16-30&mode=auto|cool|dry|fan|heat&fan=auto|1..5&swingVertical=auto|1..5&swingHorizontal=auto|1..5&quiet=on|off&powerful=on|off\",";
  body += "\"GET /power/on\",";
  body += "\"GET /power/off\",";
  body += "\"GET /temp/16..30\",";
  body += "\"GET /mode/auto|cool|dry|fan|heat\",";
  body += "\"GET /wifi\",";
  body += "\"GET /setup/info\",";
  body += "\"GET /setup/networks\",";
  body += "\"POST /setup/wifi\",";
  body += "\"POST /pair/complete\"";
  body += "]";
  body += "}";

  sendJson(200, body);
}

void handleAC() {
  logRequestContent("handleAC");

  AcState nextState = acState;

  if (!server.hasArg("power") && !server.hasArg("temp") && !server.hasArg("mode") && !server.hasArg("fan") && !server.hasArg("swing") && !server.hasArg("swingVertical") && !server.hasArg("swingHorizontal") && !server.hasArg("verticalAirflow") && !server.hasArg("horizontalAirflow") && !server.hasArg("quiet") && !server.hasArg("powerful")) {
    sendJson(400, "{\"success\":false,\"error\":\"Provide power=on|off, temp=16-30, mode=auto|cool|dry|fan|heat, fan=auto|1..5, swingVertical=auto|1..5, swingHorizontal=auto|1..5, quiet=on|off, and/or powerful=on|off\"}");
    return;
  }

  if (server.hasArg("power") && !parsePower(server.arg("power"), nextState.power)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid power. Use on or off\"}");
    return;
  }

  if (server.hasArg("temp") && !parseTemperature(server.arg("temp"), nextState.temperature)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid temperature. Use 16-30\"}");
    return;
  }

  if (server.hasArg("mode") && !parseMode(server.arg("mode"), nextState.mode)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid mode. Use auto, cool, dry, fan, or heat\"}");
    return;
  }

  if (server.hasArg("fan") && !parseFan(server.arg("fan"), nextState.fan)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid fan. Use auto or 1-5\"}");
    return;
  }

  if (server.hasArg("swing") && !parseSwing(server.arg("swing"), nextState.swingVertical)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid swing. Use auto or 1-5\"}");
    return;
  }

  if (server.hasArg("swingVertical") && !parseSwingVertical(server.arg("swingVertical"), nextState.swingVertical)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid swingVertical. Use auto or 1-5\"}");
    return;
  }

  if (server.hasArg("verticalAirflow") && !parseSwingVertical(server.arg("verticalAirflow"), nextState.swingVertical)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid verticalAirflow. Use auto or 1-5\"}");
    return;
  }

  if (server.hasArg("swingHorizontal") && !parseSwingHorizontal(server.arg("swingHorizontal"), nextState.swingHorizontal)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid swingHorizontal. Use auto or 1-5\"}");
    return;
  }

  if (server.hasArg("horizontalAirflow") && !parseSwingHorizontal(server.arg("horizontalAirflow"), nextState.swingHorizontal)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid horizontalAirflow. Use auto or 1-5\"}");
    return;
  }

  if (server.hasArg("quiet")) {
    bool nextQuiet;
    if (!parseToggle(server.arg("quiet"), nextQuiet)) {
      sendJson(400, "{\"success\":false,\"error\":\"Invalid quiet. Use on or off\"}");
      return;
    }

    nextState.quiet = nextQuiet;
    if (nextQuiet) {
      nextState.powerful = false;
    }
  }

  if (server.hasArg("powerful")) {
    bool nextPowerful;
    if (!parseToggle(server.arg("powerful"), nextPowerful)) {
      sendJson(400, "{\"success\":false,\"error\":\"Invalid powerful. Use on or off\"}");
      return;
    }

    nextState.powerful = nextPowerful;
    if (nextPowerful) {
      nextState.quiet = false;
    }
  }

  applyACStateAndRespond(nextState);
}

void handleStatus() {
  logRequestContent("handleStatus");
  sendJson(200, statusJson());
}

void handleWifi() {
  logRequestContent("handleWifi");

  String body = "{";
  body += "\"connected\":" + boolString(isWiFiConnected()) + ",";
  body += "\"ssid\":\"" + jsonEscape(currentWiFiSSID()) + "\",";
  body += "\"ip\":\"" + currentIPString() + "\",";
  body += "\"rssi\":" + String(isWiFiConnected() ? WiFi.RSSI() : 0);
  body += "}";

  sendJson(200, body);
}

bool getJsonStringField(const String& json, const String& key, String& value) {
  String pattern = "\"" + key + "\"";
  int keyIndex = json.indexOf(pattern);
  if (keyIndex < 0) {
    return false;
  }

  int colonIndex = json.indexOf(':', keyIndex + pattern.length());
  if (colonIndex < 0) {
    return false;
  }

  int quoteIndex = json.indexOf('"', colonIndex + 1);
  if (quoteIndex < 0) {
    return false;
  }

  String parsed;
  bool escaped = false;
  for (int i = quoteIndex + 1; i < json.length(); i++) {
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

void handleSetupInfo() {
  logRequestContent("handleSetupInfo");

  String body = "{";
  body += "\"controllerId\":\"" + jsonEscape(controllerId()) + "\",";
  body += "\"shortId\":\"" + jsonEscape(controllerShortId()) + "\",";
  body += "\"setupMode\":" + boolString(isSetupMode());
  body += "}";

  sendJson(200, body);
}

void handleSetupNetworks() {
  logRequestContent("handleSetupNetworks");

  if (!isSetupMode()) {
    sendJson(409, "{\"success\":false,\"error\":\"Controller is not in setup mode\"}");
    return;
  }

  int networkCount = WiFi.scanNetworks(false, false);
  if (networkCount < 0) {
    sendJson(500, "{\"success\":false,\"error\":\"WiFi scan failed\"}");
    return;
  }

  String body = "{";
  body += "\"success\":true,";
  body += "\"networks\":[";

  bool first = true;
  for (int i = 0; i < networkCount; i++) {
    String ssid = WiFi.SSID(i);
    if (ssid.length() == 0) {
      continue;
    }

    bool seenEarlier = false;
    int strongestRssi = WiFi.RSSI(i);
    for (int j = 0; j < networkCount; j++) {
      if (j < i && WiFi.SSID(j) == ssid) {
        seenEarlier = true;
        break;
      }
      if (j > i && WiFi.SSID(j) == ssid && WiFi.RSSI(j) > strongestRssi) {
        strongestRssi = WiFi.RSSI(j);
      }
    }

    if (seenEarlier) {
      continue;
    }

    if (!first) {
      body += ",";
    }
    first = false;
    body += "{";
    body += "\"ssid\":\"" + jsonEscape(ssid) + "\",";
    body += "\"rssi\":" + String(strongestRssi);
    body += "}";
  }

  body += "]";
  body += "}";
  WiFi.scanDelete();

  sendJson(200, body);
}

void handleSetupWifi() {
  logRequestContent("handleSetupWifi");

  if (!isSetupMode()) {
    sendJson(409, "{\"success\":false,\"error\":\"Controller is not in setup mode\"}");
    return;
  }

  if (!server.hasArg("plain")) {
    sendJson(400, "{\"success\":false,\"error\":\"JSON body required\"}");
    return;
  }

  String body = server.arg("plain");
  String ssid;
  String password;
  if (!getJsonStringField(body, "ssid", ssid) || ssid.length() == 0) {
    sendJson(400, "{\"success\":false,\"error\":\"ssid is required\"}");
    return;
  }
  if (!getJsonStringField(body, "password", password)) {
    password = "";
  }

  String assignedIP;
  if (!connectProvisionedWiFi(ssid, password, assignedIP)) {
    sendJson(400, "{\"success\":false,\"error\":\"Could not connect to WiFi\"}");
    return;
  }

  String response = "{";
  response += "\"success\":true,";
  response += "\"controllerId\":\"" + jsonEscape(controllerId()) + "\",";
  response += "\"shortId\":\"" + jsonEscape(controllerShortId()) + "\",";
  response += "\"ip\":\"" + jsonEscape(assignedIP) + "\",";
  response += "\"token\":\"" + jsonEscape(PAIRING_TOKEN) + "\"";
  response += "}";

  sendJson(200, response);
}

void handlePairComplete() {
  logRequestContent("handlePairComplete");

  if (!isAuthorizedBearer(server.header("Authorization"))) {
    sendJson(401, "{\"success\":false,\"error\":\"Unauthorized\"}");
    return;
  }

  completePairing();

  String body = "{";
  body += "\"success\":true,";
  body += "\"paired\":true";
  body += "}";

  sendJson(200, body);
}

void handlePowerOn() {
  logRequestContent("handlePowerOn");

  AcState nextState = acState;
  nextState.power = true;
  applyACStateAndRespond(nextState);
}

void handlePowerOff() {
  logRequestContent("handlePowerOff");

  AcState nextState = acState;
  nextState.power = false;
  applyACStateAndRespond(nextState);
}

void handleTemp() {
  logRequestContent("handleTemp");

  String uri = server.uri();
  const String prefix = "/temp/";

  if (!uri.startsWith(prefix)) {
    sendNotFound();
    return;
  }

  String tempText = uri.substring(prefix.length());
  int nextTemp;
  if (!parseTemperature(tempText, nextTemp)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid temperature. Use /temp/16 through /temp/30\"}");
    return;
  }

  AcState nextState = acState;
  nextState.temperature = nextTemp;
  applyACStateAndRespond(nextState);
}

void handleMode() {
  logRequestContent("handleMode");

  String uri = server.uri();
  const String prefix = "/mode/";

  if (!uri.startsWith(prefix)) {
    sendNotFound();
    return;
  }

  String modeText = uri.substring(prefix.length());
  uint8_t nextMode;
  if (!parseMode(modeText, nextMode)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid mode. Use /mode/auto, /mode/cool, /mode/dry, /mode/fan, or /mode/heat\"}");
    return;
  }

  AcState nextState = acState;
  nextState.mode = nextMode;
  applyACStateAndRespond(nextState);
}

void handleDynamicRoute() {
  String uri = server.uri();

  if (uri.startsWith("/temp/")) {
    handleTemp();
    return;
  }

  if (uri.startsWith("/mode/")) {
    handleMode();
    return;
  }

  logRequestContent("handleNotFound");
  sendNotFound();
}

// ─── Schedule helpers ──────────────────────────────────────────────────────────

static bool isValidTimeString(const String& t) {
  // Expects "HH:MM", 5 chars, digits and colon only
  if (t.length() != 5 || t[2] != ':') {
    return false;
  }
  for (int i = 0; i < 5; i++) {
    if (i == 2) {
      continue;
    }
    if (!isDigit(t[i])) {
      return false;
    }
  }
  int h = t.substring(0, 2).toInt();
  int m = t.substring(3, 5).toInt();
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

static String scheduleJson(const AcSchedule& s) {
  String body = "{";
  body += "\"enabled\":" + boolString(s.enabled) + ",";
  if (s.startTime[0] == '\0') {
    body += "\"startTime\":null,";
  } else {
    body += "\"startTime\":\"" + String(s.startTime) + "\",";
  }
  if (s.endTime[0] == '\0') {
    body += "\"endTime\":null,";
  } else {
    body += "\"endTime\":\"" + String(s.endTime) + "\",";
  }
  body += "\"mode\":\"" + modeString(s.mode) + "\",";
  body += "\"temperature\":" + String(s.temperature) + ",";
  body += "\"quiet\":" + boolString(s.quiet) + ",";
  body += "\"powerful\":" + boolString(s.powerful) + ",";
  body += "\"swingVertical\":\"" + swingVerticalString(s.swingVertical) + "\",";
  body += "\"swingHorizontal\":\"" + swingHorizontalString(s.swingHorizontal) + "\"";
  body += "}";
  return body;
}

void handleGetSchedule() {
  logRequestContent("handleGetSchedule");

  if (!acSchedule.valid) {
    sendJson(404, "{\"success\":false,\"error\":\"No schedule set\"}");
    return;
  }

  String body = "{\"success\":true,\"schedule\":" + scheduleJson(acSchedule) + "}";
  sendJson(200, body);
}

void handlePutSchedule() {
  logRequestContent("handlePutSchedule");

  if (!server.hasArg("plain")) {
    sendJson(400, "{\"success\":false,\"error\":\"JSON body required\"}");
    return;
  }

  // Minimal JSON field extraction — avoids pulling in ArduinoJson
  String body = server.arg("plain");

  auto extractStr = [&](const char* key) -> String {
    String search = "\"" + String(key) + "\"";
    int pos = body.indexOf(search);
    if (pos < 0) return "";
    int colon = body.indexOf(':', pos + search.length());
    if (colon < 0) return "";
    int quote1 = colon + 1;
    while (quote1 < (int)body.length() && body[quote1] == ' ') quote1++;
    if (quote1 >= (int)body.length() || body[quote1] != '"') return "";
    int quote2 = body.indexOf('"', quote1 + 1);
    if (quote2 < 0) return "";
    return body.substring(quote1 + 1, quote2);
  };

  auto extractBool = [&](const char* key, bool fallback) -> bool {
    String search = "\"" + String(key) + "\"";
    int pos = body.indexOf(search);
    if (pos < 0) return fallback;
    int colon = body.indexOf(':', pos + search.length());
    if (colon < 0) return fallback;
    int start = colon + 1;
    while (start < (int)body.length() && body[start] == ' ') start++;
    if (body.substring(start, start + 4) == "true") return true;
    if (body.substring(start, start + 5) == "false") return false;
    return fallback;
  };

  auto extractInt = [&](const char* key, int fallback) -> int {
    String search = "\"" + String(key) + "\"";
    int pos = body.indexOf(search);
    if (pos < 0) return fallback;
    int colon = body.indexOf(':', pos + search.length());
    if (colon < 0) return fallback;
    int start = colon + 1;
    while (start < (int)body.length() && body[start] == ' ') start++;
    return body.substring(start).toInt();
  };

  String startTime = extractStr("startTime");
  String endTime   = extractStr("endTime");
  String modeStr   = extractStr("mode");
  int temperature  = extractInt("temperature", -1);
  String swingV    = extractStr("swingVertical");
  String swingH    = extractStr("swingHorizontal");
  bool enabled     = extractBool("enabled", true);
  bool quiet        = extractBool("quiet", false);
  bool powerful     = extractBool("powerful", false);

  if (startTime.length() > 0 && !isValidTimeString(startTime)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid startTime (HH:MM)\"}");
    return;
  }
  if (endTime.length() > 0 && !isValidTimeString(endTime)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid endTime (HH:MM)\"}");
    return;
  }
  if (startTime.length() == 0 && endTime.length() == 0) {
    sendJson(400, "{\"success\":false,\"error\":\"Provide startTime, endTime, or both (HH:MM)\"}");
    return;
  }
  if (startTime.length() > 0 && endTime.length() > 0 && startTime == endTime) {
    sendJson(400, "{\"success\":false,\"error\":\"startTime and endTime cannot be the same\"}");
    return;
  }

  uint8_t nextMode;
  if (!parseMode(modeStr, nextMode) || nextMode == kPanasonicAcFan) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid mode (auto|cool|dry|heat)\"}");
    return;
  }

  int nextTemp;
  if (!parseTemperatureValue(temperature, nextTemp)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid temperature (16-30)\"}");
    return;
  }

  uint8_t nextSwingV = kPanasonicAcSwingVAuto;
  if (swingV.length() > 0 && !parseSwingVertical(swingV, nextSwingV)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid swingVertical\"}");
    return;
  }

  uint8_t nextSwingH = kPanasonicAcSwingHAuto;
  if (swingH.length() > 0 && !parseSwingHorizontal(swingH, nextSwingH)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid swingHorizontal\"}");
    return;
  }

  acSchedule.valid    = true;
  acSchedule.enabled  = enabled;
  strncpy(acSchedule.startTime, startTime.c_str(), 5);
  acSchedule.startTime[5] = '\0';
  strncpy(acSchedule.endTime, endTime.c_str(), 5);
  acSchedule.endTime[5] = '\0';
  acSchedule.mode            = nextMode;
  acSchedule.temperature     = nextTemp;
  acSchedule.quiet           = quiet && !powerful;
  acSchedule.powerful        = powerful;
  acSchedule.swingVertical   = nextSwingV;
  acSchedule.swingHorizontal = nextSwingH;

  saveSchedule(acSchedule);
  resetScheduleExecutionCursor();

  String respBody = "{\"success\":true,\"schedule\":" + scheduleJson(acSchedule) + "}";
  sendJson(200, respBody);
}

void handleDeleteSchedule() {
  logRequestContent("handleDeleteSchedule");

  acSchedule.valid   = false;
  acSchedule.enabled = false;
  acSchedule.quiet   = false;
  acSchedule.powerful = false;
  clearSchedule();
  resetScheduleExecutionCursor();

  sendJson(200, "{\"success\":true}");
}

void setupRoutes() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/ac", HTTP_GET, handleAC);
  server.on("/ac/schedule", HTTP_GET, handleGetSchedule);
  server.on("/ac/schedule", HTTP_PUT, handlePutSchedule);
  server.on("/ac/schedule", HTTP_DELETE, handleDeleteSchedule);
  server.on("/pair/complete", HTTP_POST, handlePairComplete);
  server.on("/power/on", HTTP_GET, handlePowerOn);
  server.on("/power/off", HTTP_GET, handlePowerOff);
  server.on("/wifi", HTTP_GET, handleWifi);
  server.on("/setup/info", HTTP_GET, handleSetupInfo);
  server.on("/setup/networks", HTTP_GET, handleSetupNetworks);
  server.on("/setup/wifi", HTTP_POST, handleSetupWifi);
  server.onNotFound(handleDynamicRoute);
}

void initHttpServer() {
  server.collectHeaders(AUTH_HEADER_KEYS, 1);
  setupRoutes();
  server.begin();

  Serial.println("HTTP server started on port 80");
}

void handleHttpClient() {
  server.handleClient();
}
