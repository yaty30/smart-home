#pragma once

#include <Arduino.h>
#include <ir_Panasonic.h>

struct AcState {
  bool power;
  int temperature;
  uint8_t mode;
  uint8_t fan;
  uint8_t swingVertical;
};

extern AcState acState;
extern bool pendingIR;
extern AcState pendingState;
extern unsigned long pendingIRQueuedAt;
extern bool isPaired;

String jsonEscape(const String& value);
String boolString(bool value);
String powerString(bool power);
String modeString(uint8_t mode);
String modeDisplayLabel(uint8_t mode);
String modeDisplayIcon(uint8_t mode);
String fanString(uint8_t fan);
String fanDisplayLabel(uint8_t fan);
String swingString(uint8_t swingVertical);
String acStateJson();

bool parsePower(const String& value, bool& power);
bool parseTemperature(const String& value, int& temp);
bool parseTemperatureValue(int value, int& temp);
bool parseMode(const String& value, uint8_t& mode);
bool parseFan(const String& value, uint8_t& fan);
bool parseSwing(const String& value, uint8_t& swingVertical);
