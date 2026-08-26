#include "Display.h"

#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <Fonts/FreeSans9pt7b.h>
#include <Fonts/FreeSans12pt7b.h>
#include <Fonts/FreeSansBold18pt7b.h>
#include <Fonts/FreeSansBold24pt7b.h>
#include <SPI.h>
#include <WiFi.h>
#include <math.h>
#include <qrcode.h>

#include "Config.h"
#include "Pairing.h"
#include "State.h"
#include "WiFiManager.h"

enum DisplayMode {
  DISPLAY_QR,
  DISPLAY_STATUS,
  DISPLAY_CLEAR
};

Adafruit_ST7735 tft(TFT_CS, TFT_DC, TFT_RST);

constexpr int16_t HEADER_X = 0;
constexpr int16_t HEADER_Y = 0;
constexpr int16_t HEADER_W = 100;
constexpr int16_t HEADER_H = 28;
constexpr int16_t WIFI_X = 100;
constexpr int16_t WIFI_Y = 0;
constexpr int16_t WIFI_W = 28;
constexpr int16_t WIFI_H = 28;
constexpr int16_t TEMP_X = 0;
constexpr int16_t TEMP_Y = 34;
constexpr int16_t TEMP_W = SCREEN_WIDTH;
constexpr int16_t TEMP_H = 70;
constexpr int16_t MODE_X = 0;
constexpr int16_t MODE_Y = 106;
constexpr int16_t MODE_W = 64;
constexpr int16_t MODE_H = 22;
constexpr int16_t FAN_X = 64;
constexpr int16_t FAN_Y = 106;
constexpr int16_t FAN_W = 64;
constexpr int16_t FAN_H = 22;
constexpr uint16_t BACKGROUND_COLOR = ST77XX_BLACK;
constexpr uint16_t PRIMARY_TEXT_COLOR = ST77XX_WHITE;
constexpr uint16_t ACCENT_COLOR = ST77XX_ORANGE;
constexpr uint16_t DISCONNECTED_COLOR = ST77XX_ORANGE;
constexpr uint16_t ICON_COLOR = ST77XX_WHITE;
constexpr float ICON_DEG_TO_RAD = 0.01745329252f;

struct DisplayedState {
  bool initialized;
  bool power;
  int temperature;
  uint8_t mode;
  uint8_t fan;
  uint8_t swingVertical;
  uint8_t swingHorizontal;
  bool wifiConnected;
};

bool qrIsDisplayed = false;
bool displayHardwareOn = true;
bool wasWiFiConnected = false;
bool lastRenderedWiFiConnected = false;
IPAddress displayedIP;
DisplayMode displayMode = DISPLAY_QR;
DisplayedState displayedState = {
  false,
  false,
  0,
  0,
  0,
  0,
  0,
  false
};

void invalidateDisplayedState() {
  displayedState.initialized = false;
}

void syncDisplayedState() {
  displayedState.initialized = true;
  displayedState.power = acState.power;
  displayedState.temperature = acState.temperature;
  displayedState.mode = acState.mode;
  displayedState.fan = acState.fan;
  displayedState.swingVertical = acState.swingVertical;
  displayedState.swingHorizontal = acState.swingHorizontal;
  displayedState.wifiConnected = isWiFiConnected();
}

bool effectiveScreenOn() {
  return pairingMode || displayState.screenOn;
}

bool effectiveQrVisible() {
  return pairingMode || displayState.qrVisible;
}

void setBacklight(bool on) {
  if (TFT_BL < 0) {
    return;
  }

  digitalWrite(TFT_BL, on ? HIGH : LOW);
}

void setDisplayHardwarePower(bool on) {
  if (displayHardwareOn == on) {
    setBacklight(on);
    return;
  }

  if (on) {
    tft.enableSleep(false);
    delay(120);
    tft.enableDisplay(true);
    setBacklight(true);
  } else {
    setBacklight(false);
    tft.enableDisplay(false);
    tft.enableSleep(true);
  }

  displayHardwareOn = on;
}

void initDisplay() {
  if (TFT_BL >= 0) {
    pinMode(TFT_BL, OUTPUT);
    setBacklight(true);
  }

  SPI.begin(TFT_SCLK, -1, TFT_MOSI, TFT_CS);
  tft.initR(INITR_144GREENTAB);
  tft.setRotation(0);
  tft.fillScreen(BACKGROUND_COLOR);
  tft.setTextWrap(true);
  displayHardwareOn = true;
  qrIsDisplayed = false;
  invalidateDisplayedState();
  setDisplayHardwarePower(effectiveScreenOn());
}

void setUIFont(const GFXfont* font) {
  tft.setFont(font);
  tft.setTextSize(1);
}

void drawCenteredText(const String& text, const GFXfont* font, int16_t x, int16_t y, int16_t w, int16_t baseline, uint16_t color) {
  int16_t x1;
  int16_t y1;
  uint16_t textW;
  uint16_t textH;

  setUIFont(font);
  tft.setTextColor(color);
  tft.getTextBounds(text, 0, baseline, &x1, &y1, &textW, &textH);
  tft.setCursor(x + ((w - textW) / 2) - x1, baseline);
  tft.print(text);
}

void drawRightAlignedText(const String& text, const GFXfont* font, int16_t right, int16_t baseline, uint16_t color) {
  int16_t x1;
  int16_t y1;
  uint16_t textW;
  uint16_t textH;

  setUIFont(font);
  tft.setTextColor(color);
  tft.getTextBounds(text, 0, baseline, &x1, &y1, &textW, &textH);
  tft.setCursor(right - textW - x1, baseline);
  tft.print(text);
}

void showDisplayMessage(const char* line1, const char* line2) {
  if (!effectiveScreenOn()) {
    return;
  }

  tft.fillScreen(BACKGROUND_COLOR);

  int16_t baseline = line2 == nullptr ? 68 : 56;
  drawCenteredText(line1, &FreeSans12pt7b, 0, 0, SCREEN_WIDTH, baseline, PRIMARY_TEXT_COLOR);

  if (line2 != nullptr) {
    drawCenteredText(line2, &FreeSans9pt7b, 0, 0, SCREEN_WIDTH, baseline + 24, PRIMARY_TEXT_COLOR);
  }

  qrIsDisplayed = false;
  displayMode = DISPLAY_CLEAR;
  invalidateDisplayedState();
}

int16_t iconX(int16_t x, int16_t size, float lucideX) {
  return x + static_cast<int16_t>((lucideX * size / 24.0f) + 0.5f);
}

int16_t iconY(int16_t y, int16_t size, float lucideY) {
  return y + static_cast<int16_t>((lucideY * size / 24.0f) + 0.5f);
}

void drawScaledLine(int16_t x, int16_t y, int16_t size, float x1, float y1, float x2, float y2, uint16_t color) {
  tft.drawLine(iconX(x, size, x1), iconY(y, size, y1), iconX(x, size, x2), iconY(y, size, y2), color);
}

void drawThickLine(int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint16_t color) {
  tft.drawLine(x1, y1, x2, y2, color);
  tft.drawLine(x1 + 1, y1, x2 + 1, y2, color);
}

void drawArcByAngle(int16_t cx, int16_t cy, int16_t rx, int16_t ry, int16_t startDeg, int16_t endDeg, uint16_t color) {
  int16_t previousX = cx + static_cast<int16_t>(cos(startDeg * ICON_DEG_TO_RAD) * rx);
  int16_t previousY = cy + static_cast<int16_t>(sin(startDeg * ICON_DEG_TO_RAD) * ry);

  for (int16_t angle = startDeg + 8; angle <= endDeg; angle += 8) {
    int16_t nextX = cx + static_cast<int16_t>(cos(angle * ICON_DEG_TO_RAD) * rx);
    int16_t nextY = cy + static_cast<int16_t>(sin(angle * ICON_DEG_TO_RAD) * ry);
    drawThickLine(previousX, previousY, nextX, nextY, color);
    previousX = nextX;
    previousY = nextY;
  }
}

void drawWifiIcon(int16_t x, int16_t y, int16_t size, bool connected, uint16_t color) {
  int16_t cx = iconX(x, size, 12);
  int16_t dotY = iconY(y, size, 20);

  tft.fillCircle(cx, dotY, max(1, size / 16), color);
  drawArcByAngle(cx, iconY(y, size, 21), size * 7 / 24, size * 5 / 24, 220, 320, color);
  drawArcByAngle(cx, iconY(y, size, 21), size * 11 / 24, size * 9 / 24, 220, 320, color);
  drawArcByAngle(cx, iconY(y, size, 21), size * 15 / 24, size * 13 / 24, 220, 320, color);

  if (!connected) {
    drawThickLine(iconX(x, size, 2), iconY(y, size, 2), iconX(x, size, 22), iconY(y, size, 22), color);
  }
}

void drawSnowflakeIcon(int16_t x, int16_t y, int16_t size, uint16_t color) {
  drawScaledLine(x, y, size, 12, 3, 12, 21, color);
  drawScaledLine(x, y, size, 4, 12, 20, 12, color);
  drawScaledLine(x, y, size, 6, 5, 18, 19, color);
  drawScaledLine(x, y, size, 18, 5, 6, 19, color);
  drawScaledLine(x, y, size, 9, 4, 12, 7, color);
  drawScaledLine(x, y, size, 15, 4, 12, 7, color);
  drawScaledLine(x, y, size, 9, 20, 12, 17, color);
  drawScaledLine(x, y, size, 15, 20, 12, 17, color);
  drawScaledLine(x, y, size, 4, 9, 7, 12, color);
  drawScaledLine(x, y, size, 4, 15, 7, 12, color);
  drawScaledLine(x, y, size, 20, 9, 17, 12, color);
  drawScaledLine(x, y, size, 20, 15, 17, 12, color);
}

void drawSparklesIcon(int16_t x, int16_t y, int16_t size, uint16_t color) {
  int16_t cx = iconX(x, size, 12);
  int16_t cy = iconY(y, size, 12);
  drawScaledLine(x, y, size, 12, 3, 14, 10, color);
  drawScaledLine(x, y, size, 14, 10, 21, 12, color);
  drawScaledLine(x, y, size, 21, 12, 14, 14, color);
  drawScaledLine(x, y, size, 14, 14, 12, 21, color);
  drawScaledLine(x, y, size, 12, 21, 10, 14, color);
  drawScaledLine(x, y, size, 10, 14, 3, 12, color);
  drawScaledLine(x, y, size, 3, 12, 10, 10, color);
  drawScaledLine(x, y, size, 10, 10, 12, 3, color);
  tft.drawCircle(cx, cy, max(1, size / 18), color);
  drawScaledLine(x, y, size, 20, 2, 20, 6, color);
  drawScaledLine(x, y, size, 18, 4, 22, 4, color);
}

void drawDropletOffIcon(int16_t x, int16_t y, int16_t size, uint16_t color) {
  int16_t cx = iconX(x, size, 12);
  int16_t top = iconY(y, size, 4);
  int16_t bottom = iconY(y, size, 21);
  tft.drawTriangle(cx, top, iconX(x, size, 6), iconY(y, size, 13), iconX(x, size, 18), iconY(y, size, 13), color);
  tft.drawCircle(cx, iconY(y, size, 15), size * 6 / 24, color);
  drawThickLine(iconX(x, size, 2), iconY(y, size, 2), iconX(x, size, 22), iconY(y, size, 22), color);
  tft.drawFastHLine(cx - 2, bottom - 1, 5, BACKGROUND_COLOR);
}

void drawFlameIcon(int16_t x, int16_t y, int16_t size, uint16_t color) {
  drawScaledLine(x, y, size, 12, 3, 15, 9, color);
  drawScaledLine(x, y, size, 15, 9, 19, 14, color);
  drawScaledLine(x, y, size, 19, 14, 17, 20, color);
  drawScaledLine(x, y, size, 17, 20, 12, 22, color);
  drawScaledLine(x, y, size, 12, 22, 7, 20, color);
  drawScaledLine(x, y, size, 7, 20, 5, 15, color);
  drawScaledLine(x, y, size, 5, 15, 8, 10, color);
  drawScaledLine(x, y, size, 8, 10, 11, 14, color);
  drawScaledLine(x, y, size, 11, 14, 10, 8, color);
  drawScaledLine(x, y, size, 10, 8, 12, 3, color);
}

void drawFanIcon(int16_t x, int16_t y, int16_t size, uint16_t color) {
  int16_t cx = iconX(x, size, 12);
  int16_t cy = iconY(y, size, 12);
  int16_t blade = max(3, size / 4);

  tft.drawCircle(cx, cy, max(1, size / 12), color);
  tft.drawCircle(cx - blade / 2, cy - blade, blade, color);
  tft.drawCircle(cx + blade, cy - blade / 3, blade, color);
  tft.drawCircle(cx - blade / 2, cy + blade, blade, color);
  tft.drawLine(cx, cy, cx - blade / 2, cy - blade, color);
  tft.drawLine(cx, cy, cx + blade, cy - blade / 3, color);
  tft.drawLine(cx, cy, cx - blade / 2, cy + blade, color);
}

void drawAirflowIcon(int16_t x, int16_t y, int16_t size, uint16_t color) {
  drawScaledLine(x, y, size, 4, 7, 16, 7, color);
  drawScaledLine(x, y, size, 16, 7, 20, 11, color);
  drawScaledLine(x, y, size, 20, 11, 16, 15, color);
  drawScaledLine(x, y, size, 4, 12, 13, 12, color);
  drawScaledLine(x, y, size, 13, 12, 17, 16, color);
  drawScaledLine(x, y, size, 17, 16, 13, 20, color);
  drawScaledLine(x, y, size, 4, 17, 10, 17, color);
}

String airflowDisplayValue(const String& value) {
  if (value == "auto") {
    return "A";
  }

  return value;
}

void drawModeIcon(uint8_t mode, int16_t x, int16_t y, int16_t size, uint16_t color) {
  switch (mode) {
    case kPanasonicAcAuto:
      drawSparklesIcon(x, y, size, color);
      break;
    case kPanasonicAcCool:
      drawSnowflakeIcon(x, y, size, color);
      break;
    case kPanasonicAcDry:
      drawDropletOffIcon(x, y, size, color);
      break;
    case kPanasonicAcHeat:
      drawFlameIcon(x, y, size, color);
      break;
    case kPanasonicAcFan:
      drawFanIcon(x, y, size, color);
      break;
    default:
      drawScaledLine(x, y, size, 6, 12, 18, 12, color);
      break;
  }
}

void drawHeader() {
  tft.fillRect(HEADER_X, HEADER_Y, HEADER_W, HEADER_H, BACKGROUND_COLOR);
  tft.setTextWrap(false);
  drawAirflowIcon(2, 3, 20, ACCENT_COLOR);
  setUIFont(&FreeSans9pt7b);
  tft.setTextColor(PRIMARY_TEXT_COLOR);
  tft.setCursor(26, 17);
  tft.print("H");
  tft.print(airflowDisplayValue(swingHorizontalString(acState.swingHorizontal)));
  tft.print(" V");
  tft.print(airflowDisplayValue(swingVerticalString(acState.swingVertical)));
}

void drawWifi(bool connected) {
  tft.fillRect(WIFI_X, WIFI_Y, WIFI_W, WIFI_H, BACKGROUND_COLOR);
  drawWifiIcon(102, 4, 22, connected, connected ? ICON_COLOR : DISCONNECTED_COLOR);
}

void drawTemperature(bool power, int temperature) {
  tft.fillRect(TEMP_X, TEMP_Y, TEMP_W, TEMP_H, BACKGROUND_COLOR);

  if (power) {
    String tempText = String(temperature);
    int16_t x1;
    int16_t y1;
    uint16_t w;
    uint16_t h;
    int16_t baseline = 83;
    int16_t degreeRadius = 4;
    int16_t degreeGap = 4;
    int16_t degreeW = (degreeRadius * 2) + 1;

    setUIFont(&FreeSansBold24pt7b);
    tft.setTextColor(PRIMARY_TEXT_COLOR);
    tft.getTextBounds(tempText, 0, baseline, &x1, &y1, &w, &h);

    int16_t totalW = w + degreeGap + degreeW;
    int16_t textX = ((SCREEN_WIDTH - totalW) / 2) - x1;
    int16_t degreeX = textX + x1 + w + degreeGap + degreeRadius;
    int16_t degreeY = y1 + 6;

    tft.setCursor(textX, baseline);
    tft.print(tempText);
    tft.drawCircle(degreeX, degreeY, degreeRadius, PRIMARY_TEXT_COLOR);
  } else {
    String offText = "OFF";
    drawCenteredText(offText, &FreeSansBold18pt7b, TEMP_X, TEMP_Y, TEMP_W, 78, PRIMARY_TEXT_COLOR);
  }
}

void drawMode(uint8_t mode) {
  tft.fillRect(MODE_X, MODE_Y, MODE_W, MODE_H, BACKGROUND_COLOR);
  drawModeIcon(mode, 5, 108, 16, ICON_COLOR);
  setUIFont(&FreeSans9pt7b);
  tft.setTextColor(PRIMARY_TEXT_COLOR);
  tft.setCursor(24, 123);
  tft.print(modeDisplayLabel(mode));
}

String fanValueLabel(uint8_t fan) {
  String value = fanString(fan);
  if (value == "auto") {
    return "Auto";
  }

  return value;
}

void drawFan(uint8_t fan) {
  tft.fillRect(FAN_X, FAN_Y, FAN_W, FAN_H, BACKGROUND_COLOR);
  String fanText = fanValueLabel(fan);
  drawFanIcon(70, 108, 16, ICON_COLOR);
  drawRightAlignedText(fanText, &FreeSans9pt7b, SCREEN_WIDTH - 5, 123, PRIMARY_TEXT_COLOR);
}

void renderStatusScreenFull() {
  if (!effectiveScreenOn()) {
    invalidateDisplayedState();
    return;
  }

  displayMode = DISPLAY_STATUS;
  qrIsDisplayed = false;
  lastRenderedWiFiConnected = isWiFiConnected();

  tft.fillScreen(BACKGROUND_COLOR);
  drawHeader();
  drawWifi(lastRenderedWiFiConnected);
  drawTemperature(acState.power, acState.temperature);
  drawMode(acState.mode);
  drawFan(acState.fan);
  syncDisplayedState();
}

void renderStatusScreen() {
  renderStatusScreenFull();
}

void updateStatusScreen() {
  if (!effectiveScreenOn()) {
    invalidateDisplayedState();
    return;
  }

  if (displayMode != DISPLAY_STATUS || !displayedState.initialized) {
    renderStatusScreenFull();
    return;
  }

  bool wifiConnected = isWiFiConnected();

  if (displayedState.wifiConnected != wifiConnected) {
    drawWifi(wifiConnected);
    displayedState.wifiConnected = wifiConnected;
    lastRenderedWiFiConnected = wifiConnected;
  }

  if (displayedState.power != acState.power || displayedState.temperature != acState.temperature) {
    drawTemperature(acState.power, acState.temperature);
    displayedState.power = acState.power;
    displayedState.temperature = acState.temperature;
  }

  if (displayedState.mode != acState.mode) {
    drawMode(acState.mode);
    displayedState.mode = acState.mode;
  }

  if (displayedState.fan != acState.fan) {
    drawFan(acState.fan);
    displayedState.fan = acState.fan;
  }

  if (displayedState.swingVertical != acState.swingVertical || displayedState.swingHorizontal != acState.swingHorizontal) {
    drawHeader();
    displayedState.swingVertical = acState.swingVertical;
    displayedState.swingHorizontal = acState.swingHorizontal;
  }
}

void drawQRCodeToTFT(esp_qrcode_handle_t qrcode) {
  const int quietZoneModules = 4;
  const int qrModules = esp_qrcode_get_size(qrcode);
  const int totalModules = qrModules + (quietZoneModules * 2);
  const int moduleSize = min(SCREEN_WIDTH / totalModules, SCREEN_HEIGHT / totalModules);
  const int qrPixelSize = totalModules * moduleSize;
  const int startX = (SCREEN_WIDTH - qrPixelSize) / 2;
  const int startY = (SCREEN_HEIGHT - qrPixelSize) / 2;

  tft.fillScreen(BACKGROUND_COLOR);
  tft.fillRect(startX, startY, qrPixelSize, qrPixelSize, ST77XX_WHITE);

  for (int y = 0; y < qrModules; y++) {
    for (int x = 0; x < qrModules; x++) {
      if (esp_qrcode_get_module(qrcode, x, y)) {
        tft.fillRect(
          startX + ((x + quietZoneModules) * moduleSize),
          startY + ((y + quietZoneModules) * moduleSize),
          moduleSize,
          moduleSize,
          BACKGROUND_COLOR
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
  if (!effectiveScreenOn()) {
    return;
  }

  if (!isWiFiConnected()) {
    showDisplayMessage("No WiFi");
    return;
  }

  String ip = currentIPString();
  String payload = "{";
  payload += "\"controllerId\":\"" + jsonEscape(controllerIdFromIP(ip)) + "\",";
  payload += "\"ip\":\"" + jsonEscape(ip) + "\",";
  payload += "\"token\":\"" + jsonEscape(PAIRING_TOKEN) + "\"";
  payload += "}";

  displayMode = DISPLAY_QR;
  drawEspQRCode(payload.c_str());
  displayedIP = WiFi.localIP();
  invalidateDisplayedState();
}

void showStatusScreen() {
  renderStatusScreenFull();
}

void updateDisplayForWiFi() {
  if (!effectiveScreenOn()) {
    wasWiFiConnected = isWiFiConnected();
    return;
  }

  bool connected = isWiFiConnected();

  if (!connected) {
    if (effectiveQrVisible()) {
      if (displayMode != DISPLAY_CLEAR) {
        showDisplayMessage("No WiFi");
      }
    } else {
      updateStatusScreen();
    }
    wasWiFiConnected = false;
    return;
  }

  IPAddress currentIP = WiFi.localIP();
  if (!effectiveQrVisible()) {
    updateStatusScreen();
  } else if (!wasWiFiConnected || !(currentIP == displayedIP) || !qrIsDisplayed) {
    displayQRCodeForIP();
  }

  wasWiFiConnected = true;
}

void clearDisplay() {
  tft.fillScreen(BACKGROUND_COLOR);
  displayMode = DISPLAY_CLEAR;
  qrIsDisplayed = false;
  invalidateDisplayedState();
}

void renderDisplayState() {
  if (!effectiveScreenOn()) {
    invalidateDisplayedState();
    qrIsDisplayed = false;
    setDisplayHardwarePower(false);
    return;
  }

  setDisplayHardwarePower(true);
  if (effectiveQrVisible()) {
    displayQRCodeForIP();
  } else {
    renderStatusScreenFull();
  }
}

void noteWiFiConnectedForDisplay() {
  wasWiFiConnected = true;
}
