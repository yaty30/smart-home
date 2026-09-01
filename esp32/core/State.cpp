#include "State.h"

AcState acState = {
  true,
  24,
  AC_MODE_COOL,
  AC_FAN_AUTO,
  AC_SWING_V_AUTO,
  AC_SWING_H_AUTO,
  false,
  false
};

bool pendingIR = false;
AcState pendingState = acState;
unsigned long pendingIRQueuedAt = 0;
bool isPaired = false;
bool pairingMode = true;

AcSchedule acSchedules[MAX_AC_SCHEDULES] = {};
uint8_t acScheduleCount = 0;

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

String boolString(bool value) {
  return value ? "true" : "false";
}

String powerString(bool power) {
  return power ? "on" : "off";
}

String modeString(uint8_t mode) {
  switch (mode) {
    case AC_MODE_AUTO: return "auto";
    case AC_MODE_COOL: return "cool";
    case AC_MODE_DRY:  return "dry";
    case AC_MODE_FAN:  return "fan";
    case AC_MODE_HEAT: return "heat";
    default:           return "unknown";
  }
}

String modeDisplayLabel(uint8_t mode) {
  switch (mode) {
    case AC_MODE_AUTO: return "Auto";
    case AC_MODE_COOL: return "Cool";
    case AC_MODE_DRY:  return "Dry";
    case AC_MODE_FAN:  return "Fan";
    case AC_MODE_HEAT: return "Heat";
    default:           return "Mode";
  }
}

String modeDisplayIcon(uint8_t mode) {
  switch (mode) {
    case AC_MODE_AUTO: return "A";
    case AC_MODE_COOL: return "*";
    case AC_MODE_DRY:  return "~";
    case AC_MODE_FAN:  return "F";
    case AC_MODE_HEAT: return "O";
    default:           return "-";
  }
}

String fanString(uint8_t fan) {
  if (fan == AC_FAN_AUTO) return "auto";
  if (fan >= AC_FAN_1 && fan <= AC_FAN_5) return String(fan);
  return "unknown";
}

String fanDisplayLabel(uint8_t fan) {
  if (fan == AC_FAN_AUTO) return "Auto";
  if (fan >= AC_FAN_1 && fan <= AC_FAN_5) return "Fan " + String(fan);
  return "Fan";
}

String swingVerticalString(uint8_t swingVertical) {
  if (swingVertical == AC_SWING_V_AUTO) return "auto";
  if (swingVertical >= AC_SWING_V_HIGHEST && swingVertical <= AC_SWING_V_LOWEST)
    return String(swingVertical);
  return "unknown";
}

String swingHorizontalString(uint8_t swingHorizontal) {
  switch (swingHorizontal) {
    case AC_SWING_H_AUTO:       return "auto";
    case AC_SWING_H_FULL_LEFT:  return "1";
    case AC_SWING_H_LEFT:       return "2";
    case AC_SWING_H_MIDDLE:     return "3";
    case AC_SWING_H_RIGHT:      return "4";
    case AC_SWING_H_FULL_RIGHT: return "5";
    default:                    return "unknown";
  }
}

String acStateJson() {
  String body = "{";
  body += "\"power\":" + boolString(acState.power) + ",";
  body += "\"temperature\":" + String(acState.temperature) + ",";
  body += "\"mode\":\"" + modeString(acState.mode) + "\",";
  body += "\"fan\":\"" + fanString(acState.fan) + "\",";
  body += "\"swing\":\"" + swingVerticalString(acState.swingVertical) + "\",";
  body += "\"swingVertical\":\"" + swingVerticalString(acState.swingVertical) + "\",";
  body += "\"swingHorizontal\":\"" + swingHorizontalString(acState.swingHorizontal) + "\",";
  body += "\"quiet\":" + boolString(acState.quiet) + ",";
  body += "\"powerful\":" + boolString(acState.powerful);
  body += "}";
  return body;
}

bool parsePower(const String& value, bool& power) {
  if (value == "on")  { power = true;  return true; }
  if (value == "off") { power = false; return true; }
  return false;
}

bool parseToggle(const String& value, bool& enabled) {
  if (value == "on" || value == "true" || value == "1") { enabled = true;  return true; }
  if (value == "off" || value == "false" || value == "0") { enabled = false; return true; }
  return false;
}

bool parseTemperatureValue(int value, int& temp) {
  if (value < 16 || value > 30) return false;
  temp = value;
  return true;
}

bool parseTemperature(const String& value, int& temp) {
  if (value.length() == 0) return false;
  for (size_t i = 0; i < value.length(); i++) {
    if (!isDigit(value[i])) return false;
  }
  return parseTemperatureValue(value.toInt(), temp);
}

bool parseMode(const String& value, uint8_t& mode) {
  if (value == "auto")               { mode = AC_MODE_AUTO; return true; }
  if (value == "cool" || value == "cold") { mode = AC_MODE_COOL; return true; }
  if (value == "dry")                { mode = AC_MODE_DRY;  return true; }
  if (value == "fan")                { mode = AC_MODE_FAN;  return true; }
  if (value == "heat")               { mode = AC_MODE_HEAT; return true; }
  return false;
}

bool parseFan(const String& value, uint8_t& fan) {
  if (value == "auto") { fan = AC_FAN_AUTO; return true; }
  if (value.length() == 0) return false;
  for (size_t i = 0; i < value.length(); i++) {
    if (!isDigit(value[i])) return false;
  }
  int v = value.toInt();
  if (v < 1 || v > 5) return false;
  fan = static_cast<uint8_t>(v);
  return true;
}

bool parseSwingVertical(const String& value, uint8_t& swingVertical) {
  if (value == "auto")    { swingVertical = AC_SWING_V_AUTO;    return true; }
  if (value == "highest") { swingVertical = AC_SWING_V_HIGHEST; return true; }
  if (value == "high")    { swingVertical = AC_SWING_V_HIGH;    return true; }
  if (value == "middle")  { swingVertical = AC_SWING_V_MIDDLE;  return true; }
  if (value == "low")     { swingVertical = AC_SWING_V_LOW;     return true; }
  if (value == "lowest")  { swingVertical = AC_SWING_V_LOWEST;  return true; }

  if (value.length() == 0) return false;
  for (size_t i = 0; i < value.length(); i++) {
    if (!isDigit(value[i])) return false;
  }
  int v = value.toInt();
  if (v < 1 || v > 5) return false;
  swingVertical = static_cast<uint8_t>(v);
  return true;
}

bool parseSwingHorizontal(const String& value, uint8_t& swingHorizontal) {
  if (value == "auto")       { swingHorizontal = AC_SWING_H_AUTO;       return true; }
  if (value == "full_left")  { swingHorizontal = AC_SWING_H_FULL_LEFT;  return true; }
  if (value == "left")       { swingHorizontal = AC_SWING_H_LEFT;       return true; }
  if (value == "middle")     { swingHorizontal = AC_SWING_H_MIDDLE;     return true; }
  if (value == "right")      { swingHorizontal = AC_SWING_H_RIGHT;      return true; }
  if (value == "full_right") { swingHorizontal = AC_SWING_H_FULL_RIGHT; return true; }

  if (value.length() == 0) return false;
  for (size_t i = 0; i < value.length(); i++) {
    if (!isDigit(value[i])) return false;
  }
  switch (value.toInt()) {
    case 1: swingHorizontal = AC_SWING_H_FULL_LEFT;  return true;
    case 2: swingHorizontal = AC_SWING_H_LEFT;       return true;
    case 3: swingHorizontal = AC_SWING_H_MIDDLE;     return true;
    case 4: swingHorizontal = AC_SWING_H_RIGHT;      return true;
    case 5: swingHorizontal = AC_SWING_H_FULL_RIGHT; return true;
    default: return false;
  }
}

bool parseSwing(const String& value, uint8_t& swingVertical) {
  return parseSwingVertical(value, swingVertical);
}
