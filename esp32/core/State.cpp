#include "State.h"

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

String swingString(uint8_t swingVertical) {
  if (swingVertical == kPanasonicAcSwingVAuto) {
    return "auto";
  }

  return String(swingVertical);
}

String acStateJson() {
  String body = "{";
  body += "\"power\":" + boolString(acState.power) + ",";
  body += "\"temperature\":" + String(acState.temperature) + ",";
  body += "\"mode\":\"" + modeString(acState.mode) + "\",";
  body += "\"fan\":\"" + fanString(acState.fan) + "\",";
  body += "\"swing\":\"" + swingString(acState.swingVertical) + "\"";
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

bool parseSwing(const String& value, uint8_t& swingVertical) {
  if (value == "auto") {
    swingVertical = kPanasonicAcSwingVAuto;
    return true;
  }

  return false;
}
