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
      Serial.println(server.arg(i));
    }
  }

  if (server.hasArg("plain")) {
    Serial.print("[HTTP] body: ");
    Serial.println(server.arg("plain"));
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
  body += "\"controllerId\":\"" + jsonEscape(controllerIdFromIP(ip)) + "\",";
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
  body += "\"ssid\":\"" + jsonEscape(WIFI_SSID) + "\",";
  body += "\"ip\":\"" + currentIPString() + "\",";
  body += "\"rssi\":" + String(isWiFiConnected() ? WiFi.RSSI() : 0);
  body += "}";

  sendJson(200, body);
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

static String scheduleTypeString(uint8_t type) {
  switch (type) {
    case ScheduleTypeAutoOn:
      return "auto_on";
    case ScheduleTypeAutoOff:
      return "auto_off";
    case ScheduleTypeScheduleTime:
    default:
      return "schedule_time";
  }
}

static bool parseScheduleType(const String& value, uint8_t& type) {
  if (value.length() == 0 || value == "schedule_time") {
    type = ScheduleTypeScheduleTime;
    return true;
  }
  if (value == "auto_on") {
    type = ScheduleTypeAutoOn;
    return true;
  }
  if (value == "auto_off") {
    type = ScheduleTypeAutoOff;
    return true;
  }
  return false;
}

static bool isValidRepeatFrequency(const String& value) {
  return value == "one-time" || value == "weekly" || value == "bi-weekly";
}

static void setAllScheduleDays(bool days[7]) {
  for (uint8_t i = 0; i < 7; i++) {
    days[i] = true;
  }
}

static String scheduleDaysJson(const bool days[7]) {
  String body = "[";
  for (uint8_t i = 0; i < 7; i++) {
    if (i > 0) {
      body += ",";
    }
    body += boolString(days[i]);
  }
  body += "]";
  return body;
}

static String scheduleJson(const AcSchedule& s) {
  String body = "{";
  body += "\"id\":\"" + jsonEscape(String(s.id)) + "\",";
  body += "\"type\":\"" + scheduleTypeString(s.type) + "\",";
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
  body += "\"days\":" + scheduleDaysJson(s.days) + ",";
  body += "\"repeatEnabled\":" + boolString(s.repeatEnabled) + ",";
  body += "\"repeatFrequency\":\"" + String(s.repeatFrequency) + "\",";
  body += "\"mode\":\"" + modeString(s.mode) + "\",";
  body += "\"temperature\":" + String(s.temperature) + ",";
  body += "\"fan\":\"" + fanString(s.fan) + "\",";
  body += "\"quiet\":" + boolString(s.quiet) + ",";
  body += "\"powerful\":" + boolString(s.powerful) + ",";
  body += "\"swingVertical\":\"" + swingVerticalString(s.swingVertical) + "\",";
  body += "\"swingHorizontal\":\"" + swingHorizontalString(s.swingHorizontal) + "\"";
  body += "}";
  return body;
}

static String schedulesJson(const AcSchedule schedules[], uint8_t count) {
  String body = "[";
  for (uint8_t i = 0; i < count; i++) {
    if (i > 0) {
      body += ",";
    }
    body += scheduleJson(schedules[i]);
  }
  body += "]";
  return body;
}

void handleGetSchedule() {
  logRequestContent("handleGetSchedule");

  if (acScheduleCount == 0) {
    sendJson(404, "{\"success\":false,\"error\":\"No schedule set\"}");
    return;
  }

  String body = "{\"success\":true,\"schedules\":" + schedulesJson(acSchedules, acScheduleCount) + "}";
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

  auto extractScheduleObjects = [&](String objects[], uint8_t& count) -> bool {
    count = 0;
    int schedulesPos = body.indexOf("\"schedules\"");
    if (schedulesPos < 0) {
      objects[count++] = body;
      return true;
    }

    int arrayStart = body.indexOf('[', schedulesPos);
    if (arrayStart < 0) return false;
    int depth = 0;
    int objectStart = -1;
    bool inString = false;
    bool escaping = false;

    for (int i = arrayStart + 1; i < (int)body.length(); i++) {
      char c = body[i];
      if (inString) {
        if (escaping) {
          escaping = false;
        } else if (c == '\\') {
          escaping = true;
        } else if (c == '"') {
          inString = false;
        }
        continue;
      }

      if (c == '"') {
        inString = true;
        continue;
      }
      if (c == '{') {
        if (depth == 0) {
          objectStart = i;
        }
        depth++;
      } else if (c == '}') {
        depth--;
        if (depth < 0) return false;
        if (depth == 0 && objectStart >= 0) {
          if (count >= MAX_AC_SCHEDULES) return false;
          objects[count++] = body.substring(objectStart, i + 1);
          objectStart = -1;
        }
      } else if (c == ']' && depth == 0) {
        return true;
      }
    }

    return false;
  };

  auto parseScheduleObject = [&](const String& scheduleBody, AcSchedule& schedule, uint8_t index) -> bool {
    auto extractStr = [&](const char* key) -> String {
    String search = "\"" + String(key) + "\"";
    int pos = scheduleBody.indexOf(search);
    if (pos < 0) return "";
    int colon = scheduleBody.indexOf(':', pos + search.length());
    if (colon < 0) return "";
    int quote1 = colon + 1;
    while (quote1 < (int)scheduleBody.length() && scheduleBody[quote1] == ' ') quote1++;
    if (quote1 >= (int)scheduleBody.length() || scheduleBody[quote1] != '"') return "";
    int quote2 = scheduleBody.indexOf('"', quote1 + 1);
    if (quote2 < 0) return "";
    return scheduleBody.substring(quote1 + 1, quote2);
    };

    auto extractBool = [&](const char* key, bool fallback) -> bool {
    String search = "\"" + String(key) + "\"";
    int pos = scheduleBody.indexOf(search);
    if (pos < 0) return fallback;
    int colon = scheduleBody.indexOf(':', pos + search.length());
    if (colon < 0) return fallback;
    int start = colon + 1;
    while (start < (int)scheduleBody.length() && scheduleBody[start] == ' ') start++;
    if (scheduleBody.substring(start, start + 4) == "true") return true;
    if (scheduleBody.substring(start, start + 5) == "false") return false;
    return fallback;
    };

    auto extractInt = [&](const char* key, int fallback) -> int {
    String search = "\"" + String(key) + "\"";
    int pos = scheduleBody.indexOf(search);
    if (pos < 0) return fallback;
    int colon = scheduleBody.indexOf(':', pos + search.length());
    if (colon < 0) return fallback;
    int start = colon + 1;
    while (start < (int)scheduleBody.length() && scheduleBody[start] == ' ') start++;
    return scheduleBody.substring(start).toInt();
    };

    auto extractBoolArray7 = [&](const char* key, bool values[7]) -> bool {
    String search = "\"" + String(key) + "\"";
    int pos = scheduleBody.indexOf(search);
    if (pos < 0) return false;
    int colon = scheduleBody.indexOf(':', pos + search.length());
    if (colon < 0) return false;
    int start = scheduleBody.indexOf('[', colon);
    if (start < 0) return false;
    int end = scheduleBody.indexOf(']', start);
    if (end < 0) return false;

    int cursor = start + 1;
    for (uint8_t i = 0; i < 7; i++) {
      while (cursor < end && (scheduleBody[cursor] == ' ' || scheduleBody[cursor] == ',')) {
        cursor++;
      }
      if (scheduleBody.substring(cursor, cursor + 4) == "true") {
        values[i] = true;
        cursor += 4;
      } else if (scheduleBody.substring(cursor, cursor + 5) == "false") {
        values[i] = false;
        cursor += 5;
      } else {
        return false;
      }
    }
    return true;
    };

    String id = extractStr("id");
    String typeStr = extractStr("type");
    String startTime = extractStr("startTime");
    String endTime = extractStr("endTime");
    String modeStr = extractStr("mode");
    String fanStr = extractStr("fan");
    int temperature = extractInt("temperature", -1);
    String swingV = extractStr("swingVertical");
    String swingH = extractStr("swingHorizontal");
    String repeatFrequency = extractStr("repeatFrequency");
    bool enabled = extractBool("enabled", true);
    bool quiet = extractBool("quiet", false);
    bool powerful = extractBool("powerful", false);
    bool repeatEnabled = extractBool("repeatEnabled", false);
    bool days[7];
    setAllScheduleDays(days);
    bool hasDays = scheduleBody.indexOf("\"days\"") >= 0;
    if (hasDays && !extractBoolArray7("days", days)) {
      sendJson(400, "{\"success\":false,\"error\":\"Invalid days array\"}");
      return false;
    }

    if (repeatFrequency.length() == 0) {
      repeatFrequency = "one-time";
    }
    if (!isValidRepeatFrequency(repeatFrequency)) {
      sendJson(400, "{\"success\":false,\"error\":\"Invalid repeatFrequency\"}");
      return false;
    }

    if (startTime.length() > 0 && !isValidTimeString(startTime)) {
      sendJson(400, "{\"success\":false,\"error\":\"Invalid startTime (HH:MM)\"}");
      return false;
    }
    if (endTime.length() > 0 && !isValidTimeString(endTime)) {
      sendJson(400, "{\"success\":false,\"error\":\"Invalid endTime (HH:MM)\"}");
      return false;
    }
    if (startTime.length() == 0 && endTime.length() == 0) {
      sendJson(400, "{\"success\":false,\"error\":\"Provide startTime, endTime, or both (HH:MM)\"}");
      return false;
    }
    if (startTime.length() > 0 && endTime.length() > 0 && startTime == endTime) {
      sendJson(400, "{\"success\":false,\"error\":\"startTime and endTime cannot be the same\"}");
      return false;
    }

    uint8_t nextType;
    if (typeStr.length() == 0) {
      nextType = startTime.length() > 0 && endTime.length() == 0
        ? ScheduleTypeAutoOn
        : startTime.length() == 0 && endTime.length() > 0
          ? ScheduleTypeAutoOff
          : ScheduleTypeScheduleTime;
    } else if (!parseScheduleType(typeStr, nextType)) {
      sendJson(400, "{\"success\":false,\"error\":\"Invalid schedule type\"}");
      return false;
    }

    if (nextType == ScheduleTypeScheduleTime &&
        (startTime.length() == 0 || endTime.length() == 0)) {
      sendJson(400, "{\"success\":false,\"error\":\"schedule_time requires startTime and endTime\"}");
      return false;
    }
    if (nextType == ScheduleTypeAutoOn &&
        (startTime.length() == 0 || endTime.length() > 0)) {
      sendJson(400, "{\"success\":false,\"error\":\"auto_on requires startTime only\"}");
      return false;
    }
    if (nextType == ScheduleTypeAutoOff &&
        (endTime.length() == 0 || startTime.length() > 0)) {
      sendJson(400, "{\"success\":false,\"error\":\"auto_off requires endTime only\"}");
      return false;
    }

    uint8_t nextMode = AC_MODE_COOL;
    int nextTemp = 24;
    uint8_t nextFan = AC_FAN_AUTO;
    uint8_t nextSwingV = AC_SWING_V_AUTO;
    uint8_t nextSwingH = AC_SWING_H_AUTO;

    if (nextType != ScheduleTypeAutoOff) {
      if (!parseMode(modeStr, nextMode) || nextMode == AC_MODE_FAN) {
        sendJson(400, "{\"success\":false,\"error\":\"Invalid mode (auto|cool|dry|heat)\"}");
        return false;
      }

      if (!parseTemperatureValue(temperature, nextTemp)) {
        sendJson(400, "{\"success\":false,\"error\":\"Invalid temperature (16-30)\"}");
        return false;
      }

      if (fanStr.length() > 0 && !parseFan(fanStr, nextFan)) {
        sendJson(400, "{\"success\":false,\"error\":\"Invalid fan\"}");
        return false;
      }

      if (swingV.length() > 0 && !parseSwingVertical(swingV, nextSwingV)) {
        sendJson(400, "{\"success\":false,\"error\":\"Invalid swingVertical\"}");
        return false;
      }

      if (swingH.length() > 0 && !parseSwingHorizontal(swingH, nextSwingH)) {
        sendJson(400, "{\"success\":false,\"error\":\"Invalid swingHorizontal\"}");
        return false;
      }
    }

    if (id.length() == 0) {
      id = "schedule-" + String(index + 1);
    }

    schedule.valid = true;
    strncpy(schedule.id, id.c_str(), sizeof(schedule.id) - 1);
    schedule.id[sizeof(schedule.id) - 1] = '\0';
    schedule.enabled = enabled;
    schedule.type = nextType;
    strncpy(schedule.startTime, startTime.c_str(), 5);
    schedule.startTime[5] = '\0';
    strncpy(schedule.endTime, endTime.c_str(), 5);
    schedule.endTime[5] = '\0';
    for (uint8_t i = 0; i < 7; i++) {
      schedule.days[i] = days[i];
    }
    schedule.repeatEnabled = repeatEnabled;
    strncpy(schedule.repeatFrequency, repeatFrequency.c_str(), 11);
    schedule.repeatFrequency[11] = '\0';
    schedule.mode = nextMode;
    schedule.temperature = nextTemp;
    schedule.fan = nextFan;
    schedule.quiet = quiet && !powerful;
    schedule.powerful = powerful;
    schedule.swingVertical = nextSwingV;
    schedule.swingHorizontal = nextSwingH;
    return true;
  };

  String scheduleObjects[MAX_AC_SCHEDULES];
  uint8_t nextCount = 0;
  if (!extractScheduleObjects(scheduleObjects, nextCount)) {
    sendJson(400, "{\"success\":false,\"error\":\"Invalid schedules payload or more than 8 schedules\"}");
    return;
  }

  AcSchedule nextSchedules[MAX_AC_SCHEDULES] = {};
  for (uint8_t i = 0; i < nextCount; i++) {
    if (!parseScheduleObject(scheduleObjects[i], nextSchedules[i], i)) {
      return;
    }
  }

  for (uint8_t i = 0; i < nextCount; i++) {
    acSchedules[i] = nextSchedules[i];
  }
  acScheduleCount = nextCount;

  saveSchedules(acSchedules, acScheduleCount);
  resetScheduleExecutionCursor();

  String respBody = "{\"success\":true,\"schedules\":" + schedulesJson(acSchedules, acScheduleCount) + "}";
  sendJson(200, respBody);
}

void handleDeleteSchedule() {
  logRequestContent("handleDeleteSchedule");

  acScheduleCount = 0;
  clearSchedules();
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
