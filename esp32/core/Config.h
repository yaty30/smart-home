#pragma once

#include <Arduino.h>

#define IR_PIN 13
// JKE remotes do not encode horizontal airflow. DKE/PKR supports all five
// manual positions plus auto in IRremoteESP8266.
#define PANASONIC_AC_MODEL kPanasonicDke
#define BOOT_BUTTON_PIN 0
static const unsigned long PAIRING_BUTTON_HOLD_MS = 3000;

#define TFT_SCLK 18
#define TFT_MOSI 19
#define TFT_RST 17
#define TFT_DC 16
#define TFT_CS 5
// Set this to the GPIO connected to TFT BL for full backlight power control.
// A value of -1 still turns the ST7735 panel itself on and off.
#define TFT_BL -1

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 128

#define WEBSOCKET_PORT 81
#define WEBSOCKET_PATH "/ws"

// static const char WIFI_SSID[] = "RVD17WL06";
// static const char WIFI_PASSWORD[] = "rvdky388941";

static const char WIFI_SSID[] = "KSQ";
static const char WIFI_PASSWORD[] = "Briannothome";

static const char PAIRING_TOKEN[] = "abc123";

static const unsigned long IR_SEND_DELAY_MS = 50;

// Schedule times are entered in the app as local wall-clock times.
#define SCHEDULE_GMT_OFFSET_SEC (8 * 60 * 60)
#define SCHEDULE_DAYLIGHT_OFFSET_SEC 0
