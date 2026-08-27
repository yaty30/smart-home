#pragma once

#include <Arduino.h>
#include <ir_Panasonic.h>

struct AcState {
  bool power;
  int temperature;
  uint8_t mode;
  uint8_t fan;
  uint8_t swingVertical;
  uint8_t swingHorizontal;
  bool quiet;
  bool powerful;
};

struct DisplayState {
  bool screenOn;
  bool qrVisible;
};

struct AcSchedule {
  bool valid;
  bool enabled;
  char startTime[6];    // "HH:MM"
  char endTime[6];      // "HH:MM"
  uint8_t mode;
  int temperature;
  uint8_t swingVertical;
  uint8_t swingHorizontal;
};

extern AcState acState;
extern DisplayState displayState;
extern AcSchedule acSchedule;
extern bool pendingIR;
extern AcState pendingState;
extern unsigned long pendingIRQueuedAt;
extern bool isPaired;
extern bool pairingMode;

String jsonEscape(const String& value);
String boolString(bool value);
String powerString(bool power);
String modeString(uint8_t mode);
String modeDisplayLabel(uint8_t mode);
String modeDisplayIcon(uint8_t mode);
String fanString(uint8_t fan);
String fanDisplayLabel(uint8_t fan);
String swingVerticalString(uint8_t swingVertical);
String swingHorizontalString(uint8_t swingHorizontal);
String acStateJson();
String displayStateJson();

bool parsePower(const String& value, bool& power);
bool parseToggle(const String& value, bool& enabled);
bool parseTemperature(const String& value, int& temp);
bool parseTemperatureValue(int value, int& temp);
bool parseMode(const String& value, uint8_t& mode);
bool parseFan(const String& value, uint8_t& fan);
bool parseSwingVertical(const String& value, uint8_t& swingVertical);
bool parseSwingHorizontal(const String& value, uint8_t& swingHorizontal);
bool parseSwing(const String& value, uint8_t& swingVertical);
