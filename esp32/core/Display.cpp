#include "Display.h"

#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <SPI.h>
#include <WiFi.h>
#include <qrcode.h>

#include "Config.h"
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
constexpr int16_t HEADER_W = SCREEN_WIDTH;
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

struct DisplayedState {
  bool initialized;
  bool power;
  int temperature;
  uint8_t mode;
  uint8_t fan;
  uint8_t swingVertical;
  bool wifiConnected;
};

bool qrIsDisplayed = false;
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
  displayedState.wifiConnected = isWiFiConnected();
}

void initDisplay() {
  SPI.begin(TFT_SCLK, -1, TFT_MOSI, TFT_CS);
  tft.initR(INITR_144GREENTAB);
  tft.setRotation(0);
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextWrap(true);
  qrIsDisplayed = false;
  invalidateDisplayedState();
}

void showDisplayMessage(const char* line1, const char* line2) {
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
  displayMode = DISPLAY_CLEAR;
  invalidateDisplayedState();
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

void drawHeader() {
  tft.fillRect(HEADER_X, HEADER_Y, HEADER_W, HEADER_H, ST77XX_BLACK);
  tft.setTextWrap(false);
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_ORANGE, ST77XX_BLACK);
  tft.setCursor(6, 7);
  tft.print("SmartHome");
}

void drawWifi(bool connected) {
  tft.fillRect(WIFI_X, WIFI_Y, WIFI_W, WIFI_H, ST77XX_BLACK);
  drawWiFiIndicator(104, 4, connected);
}

void drawTemperature(bool power, int temperature) {
  tft.fillRect(TEMP_X, TEMP_Y, TEMP_W, TEMP_H, ST77XX_BLACK);

  if (power) {
    String tempText = String(temperature) + "C";
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
}

void drawMode(uint8_t mode) {
  tft.fillRect(MODE_X, MODE_Y, MODE_W, MODE_H, ST77XX_BLACK);
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tft.setCursor(7, 112);
  tft.print(modeDisplayIcon(mode));
  tft.print(" ");
  tft.print(modeDisplayLabel(mode));
}

void drawFan(uint8_t fan) {
  tft.fillRect(FAN_X, FAN_Y, FAN_W, FAN_H, ST77XX_BLACK);
  String fanText = fanDisplayLabel(fan);
  int16_t x1;
  int16_t y1;
  uint16_t w;
  uint16_t h;
  tft.getTextBounds(fanText, 0, 112, &x1, &y1, &w, &h);
  tft.setCursor(SCREEN_WIDTH - w - 7, 112);
  tft.print(fanText);
}

void renderStatusScreenFull() {
  displayMode = DISPLAY_STATUS;
  qrIsDisplayed = false;
  lastRenderedWiFiConnected = isWiFiConnected();

  tft.fillScreen(ST77XX_BLACK);
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

  displayedState.swingVertical = acState.swingVertical;
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
  invalidateDisplayedState();
}

void showStatusScreen() {
  renderStatusScreenFull();
}

void updateDisplayForWiFi() {
  bool connected = isWiFiConnected();

  if (!connected) {
    if (displayMode == DISPLAY_STATUS) {
      updateStatusScreen();
    }

    wasWiFiConnected = false;
    return;
  }

  IPAddress currentIP = WiFi.localIP();
  if (displayMode == DISPLAY_STATUS) {
    updateStatusScreen();
  }

  if (!isPaired && (!wasWiFiConnected || !(currentIP == displayedIP))) {
    displayQRCodeForIP();
  }

  wasWiFiConnected = true;
}

void clearDisplay() {
  tft.fillScreen(ST77XX_BLACK);
  displayMode = DISPLAY_CLEAR;
  qrIsDisplayed = false;
  invalidateDisplayedState();
}

void noteWiFiConnectedForDisplay() {
  wasWiFiConnected = true;
}
