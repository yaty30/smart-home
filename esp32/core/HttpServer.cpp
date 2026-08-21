#include "HttpServer.h"

#include <WiFi.h>

#include "ACController.h"
#include "Config.h"
#include "Display.h"
#include "Pairing.h"
#include "State.h"
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
  body += "\"message\":\"IR command queued\"";
  body += "}";

  sendJson(200, body);
  broadcastState();
}

String statusJson() {
  String body = "{";
  body += "\"power\":\"" + powerString(acState.power) + "\",";
  body += "\"temperature\":" + String(acState.temperature) + ",";
  body += "\"mode\":\"" + modeString(acState.mode) + "\",";
  body += "\"fan\":\"" + fanString(acState.fan) + "\",";
  body += "\"swingVertical\":\"" + swingString(acState.swingVertical) + "\",";
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

  String body = "{";
  body += "\"name\":\"ESP32-C3 Panasonic AC Controller\",";
  body += "\"ip\":\"" + currentIPString() + "\",";
  body += "\"websocket\":\"" + jsonEscape(webSocketUrl()) + "\",";
  body += "\"endpoints\":[";
  body += "\"GET /\",";
  body += "\"GET /status\",";
  body += "\"GET /ac?power=on|off&temp=16-30&mode=auto|cool|dry|fan|heat&fan=auto|1..5\",";
  body += "\"GET /power/on\",";
  body += "\"GET /power/off\",";
  body += "\"GET /temp/16..30\",";
  body += "\"GET /mode/auto|cool|dry|fan|heat\",";
  body += "\"GET /wifi\",";
  body += "\"POST /pair/complete\",";
  body += "\"GET /display/qr\",";
  body += "\"GET /display/status\",";
  body += "\"GET /display/clear\"";
  body += "]";
  body += "}";

  sendJson(200, body);
}

void handleAC() {
  logRequestContent("handleAC");

  AcState nextState = acState;

  if (!server.hasArg("power") && !server.hasArg("temp") && !server.hasArg("mode") && !server.hasArg("fan")) {
    sendJson(400, "{\"success\":false,\"error\":\"Provide power=on|off, temp=16-30, mode=auto|cool|dry|fan|heat, and/or fan=auto|1..5\"}");
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
  body += "\"paired\":true,";
  body += "\"display\":\"status\"";
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

void handleDisplayQR() {
  logRequestContent("handleDisplayQR");

  resetPairing();
  sendJson(200, "{\"success\":true,\"display\":\"qr\"}");
}

void handleDisplayStatus() {
  logRequestContent("handleDisplayStatus");

  showStatusScreen();
  sendJson(200, "{\"success\":true,\"display\":\"status\"}");
}

void handleDisplayClear() {
  logRequestContent("handleDisplayClear");

  clearDisplay();
  sendJson(200, "{\"success\":true,\"display\":\"clear\"}");
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

void setupRoutes() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/ac", HTTP_GET, handleAC);
  server.on("/pair/complete", HTTP_POST, handlePairComplete);
  server.on("/power/on", HTTP_GET, handlePowerOn);
  server.on("/power/off", HTTP_GET, handlePowerOff);
  server.on("/wifi", HTTP_GET, handleWifi);
  server.on("/display/qr", HTTP_GET, handleDisplayQR);
  server.on("/display/status", HTTP_GET, handleDisplayStatus);
  server.on("/display/clear", HTTP_GET, handleDisplayClear);
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
