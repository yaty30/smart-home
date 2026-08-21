#pragma once

#include <Arduino.h>

#define IR_PIN 4

#define TFT_SCLK 18
#define TFT_MOSI 23
#define TFT_RST 17
#define TFT_DC 16
#define TFT_CS 5

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 128

#define WEBSOCKET_PORT 81
#define WEBSOCKET_PATH "/ws"

static const char WIFI_SSID[] = "RVD17WL06";
static const char WIFI_PASSWORD[] = "rvdky388941";
static const char PAIRING_TOKEN[] = "abc123";

static const unsigned long IR_SEND_DELAY_MS = 50;
