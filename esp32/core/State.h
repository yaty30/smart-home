#pragma once

#include <Arduino.h>
#include "ac/AcTypes.h"

// Generic AC state — brand-neutral values throughout.
// Drivers are responsible for translating these to protocol-specific constants.
struct AcState {
  bool    power;
  int     temperature;
  uint8_t mode;             // AC_MODE_*
  uint8_t fan;              // AC_FAN_*
  uint8_t swingVertical;    // AC_SWING_V_*
  uint8_t swingHorizontal;  // AC_SWING_H_*
  bool    quiet;
  bool    powerful;
};

enum ScheduleType : uint8_t {
  ScheduleTypeScheduleTime = 0,
  ScheduleTypeAutoOn = 1,
  ScheduleTypeAutoOff = 2
};

constexpr uint8_t MAX_AC_SCHEDULES = 8;

struct AcSchedule {
  bool    valid;
  char    id[40];
  bool    enabled;
  uint8_t type;
  char    startTime[6];    // "HH:MM"
  char    endTime[6];      // "HH:MM", or empty for no automatic off
  bool    days[7];         // Mon-Sun, index 0 = Monday
  bool    repeatEnabled;
  char    repeatFrequency[12];
  uint8_t mode;
  int     temperature;
  uint8_t fan;
  bool    quiet;
  bool    powerful;
  uint8_t swingVertical;
  uint8_t swingHorizontal;
};

extern AcState acState;
extern AcSchedule acSchedules[MAX_AC_SCHEDULES];
extern uint8_t acScheduleCount;
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

bool parsePower(const String& value, bool& power);
bool parseToggle(const String& value, bool& enabled);
bool parseTemperature(const String& value, int& temp);
bool parseTemperatureValue(int value, int& temp);
bool parseMode(const String& value, uint8_t& mode);
bool parseFan(const String& value, uint8_t& fan);
bool parseSwingVertical(const String& value, uint8_t& swingVertical);
bool parseSwingHorizontal(const String& value, uint8_t& swingHorizontal);
bool parseSwing(const String& value, uint8_t& swingVertical);
