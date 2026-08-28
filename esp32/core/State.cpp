#include "State.h"

AcState acState = {
  true,
  24,
  kPanasonicAcCool,
  kPanasonicAcFanAuto,
  kPanasonicAcSwingVAuto,
  kPanasonicAcSwingHAuto,
  false,
  false
};

bool pendingIR = false;
AcState pendingState = acState;
unsigned long pendingIRQueuedAt = 0;
bool isPaired = false;
bool pairingMode = true;

AcSchedule acSchedule = {
  false,                    // valid
  false,                    // enabled
  "22:30",                  // startTime
  "",                       // endTime
  kPanasonicAcCool,         // mode
  24,                       // temperature
  false,                    // quiet
  false,                    // powerful
  kPanasonicAcSwingVAuto,   // swingVertical
  kPanasonicAcSwingHAuto    // swingHorizontal
};

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

String fanString(uint8_t fan) {
  if (fan == kPanasonicAcFanAuto) {
    return "auto";
  }

  if (fan >= kPanasonicAcFanMin && fan <= kPanasonicAcFanMax) {
    return String(fan + 1);
  }

  return "unknown";
}

String fanDisplayLabel(uint8_t fan) {
  if (fan == kPanasonicAcFanAuto) {
    return "Auto";
  }

  if (fan >= kPanasonicAcFanMin && fan <= kPanasonicAcFanMax) {
    return "Fan " + String(fan + 1);
  }

  return "Fan";
}

String swingVerticalString(uint8_t swingVertical) {
  if (swingVertical == kPanasonicAcSwingVAuto) {
    return "auto";
  }

  return String(swingVertical);
}

String swingHorizontalString(uint8_t swingHorizontal) {
  if (swingHorizontal == kPanasonicAcSwingHAuto) {
    return "auto";
  }

  if (swingHorizontal == kPanasonicAcSwingHFullLeft) {
    return "1";
  }

  if (swingHorizontal == kPanasonicAcSwingHLeft) {
    return "2";
  }

  if (swingHorizontal == kPanasonicAcSwingHMiddle) {
    return "3";
  }

  if (swingHorizontal == kPanasonicAcSwingHRight) {
    return "4";
  }

  if (swingHorizontal == kPanasonicAcSwingHFullRight) {
    return "5";
  }

  return "unknown";
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

bool parseToggle(const String& value, bool& enabled) {
  if (value == "on" || value == "true" || value == "1") {
    enabled = true;
    return true;
  }

  if (value == "off" || value == "false" || value == "0") {
    enabled = false;
    return true;
  }

  return false;
}

bool parseTemperatureValue(int value, int& temp) {
  if (value < 16 || value > 30) {
    return false;
  }

  temp = value;
  return true;
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

  return parseTemperatureValue(value.toInt(), temp);
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

bool parseFan(const String& value, uint8_t& fan) {
  if (value == "auto") {
    fan = kPanasonicAcFanAuto;
    return true;
  }

  if (value.length() == 0) {
    return false;
  }

  for (size_t i = 0; i < value.length(); i++) {
    if (!isDigit(value[i])) {
      return false;
    }
  }

  int numericFan = value.toInt();
  if (numericFan < 1 || numericFan > 5) {
    return false;
  }

  fan = static_cast<uint8_t>(numericFan - 1);
  return true;
}

bool parseSwingVertical(const String& value, uint8_t& swingVertical) {
  if (value == "auto") {
    swingVertical = kPanasonicAcSwingVAuto;
    return true;
  }

  if (value == "highest" || value == "high" || value == "middle" || value == "low" || value == "lowest") {
    if (value == "highest") {
      swingVertical = kPanasonicAcSwingVHighest;
    } else if (value == "high") {
      swingVertical = kPanasonicAcSwingVHigh;
    } else if (value == "middle") {
      swingVertical = kPanasonicAcSwingVMiddle;
    } else if (value == "low") {
      swingVertical = kPanasonicAcSwingVLow;
    } else {
      swingVertical = kPanasonicAcSwingVLowest;
    }
    return true;
  }

  if (value.length() == 0) {
    return false;
  }

  for (size_t i = 0; i < value.length(); i++) {
    if (!isDigit(value[i])) {
      return false;
    }
  }

  int numericSwing = value.toInt();
  if (numericSwing < 1 || numericSwing > 5) {
    return false;
  }

  swingVertical = static_cast<uint8_t>(numericSwing);
  return true;
}

bool parseSwingHorizontal(const String& value, uint8_t& swingHorizontal) {
  if (value == "auto") {
    swingHorizontal = kPanasonicAcSwingHAuto;
    return true;
  }

  if (value == "full_left" || value == "left" || value == "middle" || value == "right" || value == "full_right") {
    if (value == "full_left") {
      swingHorizontal = kPanasonicAcSwingHFullLeft;
    } else if (value == "left") {
      swingHorizontal = kPanasonicAcSwingHLeft;
    } else if (value == "middle") {
      swingHorizontal = kPanasonicAcSwingHMiddle;
    } else if (value == "right") {
      swingHorizontal = kPanasonicAcSwingHRight;
    } else {
      swingHorizontal = kPanasonicAcSwingHFullRight;
    }
    return true;
  }

  if (value.length() == 0) {
    return false;
  }

  for (size_t i = 0; i < value.length(); i++) {
    if (!isDigit(value[i])) {
      return false;
    }
  }

  switch (value.toInt()) {
    case 1:
      swingHorizontal = kPanasonicAcSwingHFullLeft;
      return true;
    case 2:
      swingHorizontal = kPanasonicAcSwingHLeft;
      return true;
    case 3:
      swingHorizontal = kPanasonicAcSwingHMiddle;
      return true;
    case 4:
      swingHorizontal = kPanasonicAcSwingHRight;
      return true;
    case 5:
      swingHorizontal = kPanasonicAcSwingHFullRight;
      return true;
    default:
      return false;
  }
}

bool parseSwing(const String& value, uint8_t& swingVertical) {
  return parseSwingVertical(value, swingVertical);
}
