#include <SPI.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <qrcode.h>
#include <IRremoteESP8266.h>
#include <IRsend.h>
#include <ir_Panasonic.h>

#define IR_PIN 4

#define TFT_SCLK 18
#define TFT_MOSI 23
#define TFT_RST  17
#define TFT_DC   16
#define TFT_CS   5

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 128

const char* WIFI_SSID = "KSQ";
const char* WIFI_PASSWORD = "Briannothome";
const char* PAIRING_TOKEN = "abc123";
const char* AUTH_HEADER_KEYS[] = { "Authorization" };

Adafruit_ST7735 tft(TFT_CS, TFT_DC, TFT_RST);
WebServer server(80);
IRPanasonicAc ac(IR_PIN);

struct AcState {
  bool power;
  int temperature;
  uint8_t mode;
  uint8_t fan;
  uint8_t swingVertical;
};

enum DisplayMode {
  DISPLAY_QR,
  DISPLAY_STATUS,
  DISPLAY_CLEAR
};

AcState acState = {
  true,
  24,
  kPanasonicAcCool,
  kPanasonicAcFanAuto,
  kPanasonicAcSwingVAuto
};

bool pendingIR = false;
AcState pendingState = acState;
unsigned long pendingIRQueuedAt = 0;

bool isPaired = false;
bool qrIsDisplayed = false;
bool wasWiFiConnected = false;
bool lastRenderedWiFiConnected = false;
IPAddress displayedIP;
DisplayMode displayMode = DISPLAY_QR;

const unsigned long IR_SEND_DELAY_MS = 50;

String ipToString(const IPAddress& ip) {
  return String(ip[0]) + "." + String(ip[1]) + "." + String(ip[2]) + "." + String(ip[3]);
}

String jsonEscape(const String& value) {
  String escaped;
  escaped.reserve(value.length() + 8);

  for (size_t i = 0; i < value.length(); i++) {
    char c = value[i];
    if (c == '\"' || c == '\\') {
      escaped += '\\';
      escaped += c;
    } else if (c == '\n') {
      escaped += "\\n";
    } else if (c == '\r') {
      escaped += "\\r";
    } else if (c == '\t') {
      escaped += "\\t";
    } else {
      escaped += c;
    }
  }

  return escaped;
}

void sendJson(int statusCode, const String& body) {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(statusCode, "application/json", body);
}

void sendNotFound() {
  sendJson(404, "{\"success\":false,\"error\":\"Not found\"}");
}

bool isWiFiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

String currentIPString() {
  if (!isWiFiConnected()) {
    return "0.0.0.0";
  }

  return ipToString(WiFi.localIP());
}

String boolString(bool value) {
  return value ? "true" : "false";
}

String powerString(bool power) {
  return power ? "on" : "off";
}

String modeString(uint8_t mode) {
  switch (mode) {
    case kPanasonicAcAuto:
      return "auto";
    case kPanasonicAcCool:
      return "cool";
    case kPanasonicAcDry:
      return "dry";
    case kPanasonicAcFan:
      return "fan";
    case kPanasonicAcHeat:
      return "heat";
    default:
      return "unknown";
  }
}

String modeDisplayLabel(uint8_t mode) {
  switch (mode) {
    case kPanasonicAcAuto:
      return "Auto";
    case kPanasonicAcCool:
      return "Cool";
    case kPanasonicAcDry:
      return "Dry";
    case kPanasonicAcFan:
      return "Fan";
    case kPanasonicAcHeat:
      return "Heat";
    default:
      return "Mode";
  }
}

String modeDisplayIcon(uint8_t mode) {
  switch (mode) {
    case kPanasonicAcAuto:
      return "A";
    case kPanasonicAcCool:
      return "*";
    case kPanasonicAcDry:
      return "~";
    case kPanasonicAcFan:
      return "F";
    case kPanasonicAcHeat:
      return "O";
    default:
      return "-";
  }
}

bool parseMode(const String& value, uint8_t& mode) {
  if (value == "auto") {
    mode = kPanasonicAcAuto;
    return true;
  }

  if (value == "cool" || value == "cold") {
    mode = kPanasonicAcCool;
    return true;
  }

  if (value == "dry") {
    mode = kPanasonicAcDry;
    return true;
  }

  if (value == "fan") {
    mode = kPanasonicAcFan;
    return true;
  }

  if (value == "heat") {
    mode = kPanasonicAcHeat;
    return true;
  }

  return false;
}

String fanString(uint8_t fan) {
  if (fan == kPanasonicAcFanAuto) {
    return "auto";
  }

  return String(fan);
}

String fanDisplayLabel(uint8_t fan) {
  if (fan == kPanasonicAcFanAuto) {
    return "Auto";
  }

  return "Fan " + String(fan);
}

void initDisplay() {
  SPI.begin(TFT_SCLK, -1, TFT_MOSI, TFT_CS);
  tft.initR(INITR_144GREENTAB);
  tft.setRotation(0);
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextWrap(true);
  qrIsDisplayed = false;
}

void showDisplayMessage(const char* line1, const char* line2 = nullptr) {
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tft.setTextSize(2);

  int16_t y = line2 == nullptr ? 54 : 42;
  int16_t x1;
  int16_t y1;
  uint16_t w;
  uint16_t h;
  tft.getTextBounds(line1, 0, y, &x1, &y1, &w, &h);
  tft.setCursor((SCREEN_WIDTH - w) / 2, y);
  tft.println(line1);

  if (line2 != nullptr) {
    tft.getTextBounds(line2, 0, y + 24, &x1, &y1, &w, &h);
    tft.setCursor((SCREEN_WIDTH - w) / 2, y + 24);
    tft.println(line2);
  }

  qrIsDisplayed = false;
}

void drawWiFiIndicator(int16_t x, int16_t y, bool connected) {
  uint16_t color = connected ? ST77XX_WHITE : ST77XX_ORANGE;

  tft.drawCircle(x + 8, y + 16, 2, color);
  tft.drawFastHLine(x + 6, y + 12, 5, color);
  tft.drawFastHLine(x + 3, y + 8, 11, color);
  tft.drawFastHLine(x, y + 4, 17, color);

  if (!connected) {
    tft.drawLine(x, y + 2, x + 17, y + 18, color);
  }
}

void renderStatusScreen() {
  displayMode = DISPLAY_STATUS;
  qrIsDisplayed = false;
  lastRenderedWiFiConnected = isWiFiConnected();

  tft.fillScreen(ST77XX_BLACK);

  tft.setTextWrap(false);
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_ORANGE, ST77XX_BLACK);
  tft.setCursor(6, 7);
  tft.print("SmartHome");

  drawWiFiIndicator(104, 4, lastRenderedWiFiConnected);

  if (acState.power) {
    String tempText = String(acState.temperature) + "C";
    int16_t x1;
    int16_t y1;
    uint16_t w;
    uint16_t h;

    tft.setTextSize(4);
    tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
    tft.getTextBounds(tempText, 0, 48, &x1, &y1, &w, &h);
    tft.setCursor((SCREEN_WIDTH - w) / 2, 46);
    tft.print(tempText);
  } else {
    String offText = "OFF";
    int16_t x1;
    int16_t y1;
    uint16_t w;
    uint16_t h;

    tft.setTextSize(3);
    tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
    tft.getTextBounds(offText, 0, 52, &x1, &y1, &w, &h);
    tft.setCursor((SCREEN_WIDTH - w) / 2, 52);
    tft.print(offText);
  }

  tft.setTextSize(1);
  tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tft.setCursor(7, 112);
  tft.print(modeDisplayIcon(acState.mode));
  tft.print(" ");
  tft.print(modeDisplayLabel(acState.mode));

  String fanText = fanDisplayLabel(acState.fan);
  int16_t x1;
  int16_t y1;
  uint16_t w;
  uint16_t h;
  tft.getTextBounds(fanText, 0, 112, &x1, &y1, &w, &h);
  tft.setCursor(SCREEN_WIDTH - w - 7, 112);
  tft.print(fanText);
}

void drawQRCodeToTFT(esp_qrcode_handle_t qrcode) {
  const int quietZoneModules = 4;
  const int qrModules = esp_qrcode_get_size(qrcode);
  const int totalModules = qrModules + (quietZoneModules * 2);
  const int moduleSize = min(SCREEN_WIDTH / totalModules, SCREEN_HEIGHT / totalModules);
  const int qrPixelSize = totalModules * moduleSize;
  const int startX = (SCREEN_WIDTH - qrPixelSize) / 2;
  const int startY = (SCREEN_HEIGHT - qrPixelSize) / 2;

  tft.fillScreen(ST77XX_BLACK);
  tft.fillRect(startX, startY, qrPixelSize, qrPixelSize, ST77XX_WHITE);

  for (int y = 0; y < qrModules; y++) {
    for (int x = 0; x < qrModules; x++) {
      if (esp_qrcode_get_module(qrcode, x, y)) {
        tft.fillRect(
          startX + ((x + quietZoneModules) * moduleSize),
          startY + ((y + quietZoneModules) * moduleSize),
          moduleSize,
          moduleSize,
          ST77XX_BLACK
        );
      }
    }
  }

  qrIsDisplayed = true;
}

void drawEspQRCode(const char* text) {
  esp_qrcode_config_t qrConfig = ESP_QRCODE_CONFIG_DEFAULT();
  qrConfig.display_func = drawQRCodeToTFT;
  qrConfig.max_qrcode_version = 10;
  qrConfig.qrcode_ecc_level = ESP_QRCODE_ECC_LOW;

  if (esp_qrcode_generate(&qrConfig, text) != ESP_OK) {
    showDisplayMessage("QR Error");
  }
}

void displayQRCodeForIP() {
  if (!isWiFiConnected()) {
    showDisplayMessage("No WiFi");
    return;
  }

  String host = "http://" + currentIPString();
  String payload = "{";
  payload += "\"host\":\"" + jsonEscape(host) + "\",";
  payload += "\"token\":\"" + jsonEscape(PAIRING_TOKEN) + "\"";
  payload += "}";

  displayMode = DISPLAY_QR;
  drawEspQRCode(payload.c_str());
  displayedIP = WiFi.localIP();
}

void showStatusScreen() {
  renderStatusScreen();
}

void updateDisplayForWiFi() {
  bool connected = isWiFiConnected();

  if (!connected) {
    if (displayMode == DISPLAY_STATUS && lastRenderedWiFiConnected) {
      renderStatusScreen();
    }

    wasWiFiConnected = false;
    return;
  }

  IPAddress currentIP = WiFi.localIP();
  if (displayMode == DISPLAY_STATUS && !lastRenderedWiFiConnected) {
    renderStatusScreen();
  }

  if (!isPaired && (!wasWiFiConnected || !(currentIP == displayedIP))) {
    displayQRCodeForIP();
  }

  wasWiFiConnected = true;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to WiFi");
  showDisplayMessage("Connecting", "WiFi...");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("WiFi connected. IP: ");
  Serial.println(WiFi.localIP());

  wasWiFiConnected = true;
  displayQRCodeForIP();
}

void sendAC(const AcState& state) {
  ac.setPower(state.power);
  ac.setMode(state.mode);
  ac.setTemp(state.temperature);
  ac.setFan(state.fan);
  ac.setSwingVertical(state.swingVertical);
  ac.send();

  Serial.print("Panasonic AC IR sent: power=");
  Serial.print(powerString(state.power));
  Serial.print(", temp=");
  Serial.print(state.temperature);
  Serial.print(", mode=");
  Serial.print(modeString(state.mode));
  Serial.print(", fan=");
  Serial.println(fanString(state.fan));
}

void queueACCommand(const AcState& state) {
  pendingState = state;
  pendingIRQueuedAt = millis();
  pendingIR = true;
}

void processQueuedIR() {
  if (!pendingIR) {
    return;
  }

  if (millis() - pendingIRQueuedAt < IR_SEND_DELAY_MS) {
    return;
  }

  AcState state = pendingState;
  pendingIR = false;
  sendAC(state);
}

bool parseTemperature(const String& value, int& temp) {
  if (value.length() == 0) {
    return false;
  }

  for (size_t i = 0; i < value.length(); i++) {
    if (!isDigit(value[i])) {
      return false;
    }
  }

  temp = value.toInt();
  return temp >= 16 && temp <= 30;
}

bool parsePower(const String& value, bool& power) {
  if (value == "on") {
    power = true;
    return true;
  }

  if (value == "off") {
    power = false;
    return true;
  }

  return false;
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
  acState = nextState;

  renderStatusScreen();

  String body = "{";
  body += "\"success\":true,";
  body += "\"power\":\"" + powerString(acState.power) + "\",";
  body += "\"temperature\":" + String(acState.temperature) + ",";
  body += "\"mode\":\"" + modeString(acState.mode) + "\",";
  body += "\"fan\":\"" + fanString(acState.fan) + "\",";
  body += "\"message\":\"IR command queued\"";
  body += "}";

  sendJson(200, body);
  queueACCommand(acState);
}

void handleRoot() {
  logRequestContent("handleRoot");

  String body = "{";
  body += "\"name\":\"ESP32-C3 Panasonic AC Controller\",";
  body += "\"ip\":\"" + currentIPString() + "\",";
  body += "\"endpoints\":[";
  body += "\"GET /\",";
  body += "\"GET /status\",";
  body += "\"GET /ac?power=on|off&temp=16-30&mode=auto|cool|dry|fan|heat\",";
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

  if (!server.hasArg("power") && !server.hasArg("temp") && !server.hasArg("mode")) {
    sendJson(400, "{\"success\":false,\"error\":\"Provide power=on|off, temp=16-30, and/or mode=auto|cool|dry|fan|heat\"}");
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

  applyACStateAndRespond(nextState);
}

void handleStatus() {
  logRequestContent("handleStatus");

  String body = "{";
  body += "\"power\":\"" + powerString(acState.power) + "\",";
  body += "\"temperature\":" + String(acState.temperature) + ",";
  body += "\"mode\":\"" + modeString(acState.mode) + "\",";
  body += "\"fan\":\"" + fanString(acState.fan) + "\",";
  body += "\"swingVertical\":\"auto\",";
  body += "\"paired\":" + boolString(isPaired) + ",";
  body += "\"pendingIR\":" + boolString(pendingIR) + ",";
  body += "\"wifiConnected\":" + boolString(isWiFiConnected()) + ",";
  body += "\"rssi\":" + String(isWiFiConnected() ? WiFi.RSSI() : 0) + ",";
  body += "\"ip\":\"" + currentIPString() + "\"";
  body += "}";

  sendJson(200, body);
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

bool isAuthorizedRequest() {
  String expected = "Bearer ";
  expected += PAIRING_TOKEN;

  return server.header("Authorization") == expected;
}

void handlePairComplete() {
  logRequestContent("handlePairComplete");

  if (!isAuthorizedRequest()) {
    sendJson(401, "{\"success\":false,\"error\":\"Unauthorized\"}");
    return;
  }

  isPaired = true;
  renderStatusScreen();

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

  isPaired = false;
  displayQRCodeForIP();
  sendJson(200, "{\"success\":true,\"display\":\"qr\"}");
}

void handleDisplayStatus() {
  logRequestContent("handleDisplayStatus");

  showStatusScreen();
  sendJson(200, "{\"success\":true,\"display\":\"status\"}");
}

void handleDisplayClear() {
  logRequestContent("handleDisplayClear");

  tft.fillScreen(ST77XX_BLACK);
  displayMode = DISPLAY_CLEAR;
  qrIsDisplayed = false;
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

void setup() {
  Serial.begin(115200);
  delay(200);

  ac.begin();
  ac.setModel(kPanasonicJke);

  initDisplay();
  showDisplayMessage("Starting...");

  connectWiFi();

  server.collectHeaders(AUTH_HEADER_KEYS, 1);
  setupRoutes();
  server.begin();

  Serial.println("HTTP server started on port 80");
}

void loop() {
  server.handleClient();
  updateDisplayForWiFi();
  processQueuedIR();
  delay(1);
}
