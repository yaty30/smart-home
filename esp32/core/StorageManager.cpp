#include "StorageManager.h"

#include <Preferences.h>

namespace {
constexpr const char* STORAGE_NAMESPACE = "smart-home";
constexpr uint8_t STORAGE_VERSION = 1;

Preferences preferences;
bool storageReady = false;

bool isValidACState(const AcState& state) {
  int temperature;
  return parseTemperatureValue(state.temperature, temperature) &&
         modeString(state.mode) != "unknown" &&
         fanString(state.fan) != "unknown" &&
         swingVerticalString(state.swingVertical) != "unknown" &&
         swingHorizontalString(state.swingHorizontal) != "unknown" &&
         !(state.quiet && state.powerful);
}
}

void initStorageManager() {
  storageReady = preferences.begin(STORAGE_NAMESPACE, false);
  if (!storageReady) {
    Serial.println("Preferences storage could not be opened");
  }
}

bool loadStoredState(AcState& storedAcState, DisplayState& storedDisplayState, bool& storedPaired) {
  if (!storageReady || preferences.getUChar("version", 0) != STORAGE_VERSION) {
    return false;
  }

  AcState candidate = {
    preferences.getBool("ac_power", storedAcState.power),
    preferences.getInt("ac_temp", storedAcState.temperature),
    preferences.getUChar("ac_mode", storedAcState.mode),
    preferences.getUChar("ac_fan", storedAcState.fan),
    preferences.getUChar("ac_swing_v", storedAcState.swingVertical),
    preferences.getUChar("ac_swing_h", storedAcState.swingHorizontal),
    preferences.getBool("ac_quiet", storedAcState.quiet),
    preferences.getBool("ac_powerful", storedAcState.powerful)
  };

  if (!isValidACState(candidate)) {
    Serial.println("Stored AC state is invalid; using defaults");
    return false;
  }

  storedAcState = candidate;
  storedDisplayState.screenOn = preferences.getBool("screen_on", storedDisplayState.screenOn);
  storedDisplayState.qrVisible = preferences.getBool("qr_visible", storedDisplayState.qrVisible);
  storedPaired = preferences.getBool("paired", storedPaired);
  return true;
}

void saveACState(const AcState& state) {
  if (!storageReady) {
    return;
  }

  preferences.putUChar("version", STORAGE_VERSION);
  preferences.putBool("ac_power", state.power);
  preferences.putInt("ac_temp", state.temperature);
  preferences.putUChar("ac_mode", state.mode);
  preferences.putUChar("ac_fan", state.fan);
  preferences.putUChar("ac_swing_v", state.swingVertical);
  preferences.putUChar("ac_swing_h", state.swingHorizontal);
  preferences.putBool("ac_quiet", state.quiet);
  preferences.putBool("ac_powerful", state.powerful);
}

void saveDisplayState(const DisplayState& state) {
  if (!storageReady) {
    return;
  }

  preferences.putUChar("version", STORAGE_VERSION);
  preferences.putBool("screen_on", state.screenOn);
  preferences.putBool("qr_visible", state.qrVisible);
}

void savePairingState(bool paired) {
  if (!storageReady) {
    return;
  }

  preferences.putUChar("version", STORAGE_VERSION);
  preferences.putBool("paired", paired);
}

void saveSchedule(const AcSchedule& schedule) {
  if (!storageReady) {
    return;
  }

  preferences.putUChar("version", STORAGE_VERSION);
  preferences.putBool("sched_valid", schedule.valid);
  preferences.putBool("sched_enabled", schedule.enabled);
  preferences.putString("sched_start", schedule.startTime);
  preferences.putString("sched_end", schedule.endTime);
  preferences.putUChar("sched_mode", schedule.mode);
  preferences.putInt("sched_temp", schedule.temperature);
  preferences.putBool("sched_quiet", schedule.quiet);
  preferences.putBool("sched_powerful", schedule.powerful);
  preferences.putUChar("sched_swing_v", schedule.swingVertical);
  preferences.putUChar("sched_swing_h", schedule.swingHorizontal);
}

void clearSchedule() {
  if (!storageReady) {
    return;
  }

  preferences.putBool("sched_valid", false);
}

bool loadSchedule(AcSchedule& schedule) {
  if (!storageReady) {
    return false;
  }

  if (!preferences.getBool("sched_valid", false)) {
    return false;
  }

  schedule.valid   = true;
  schedule.enabled = preferences.getBool("sched_enabled", false);

  String start = preferences.getString("sched_start", "22:30");
  String end   = preferences.getString("sched_end",   "");
  strncpy(schedule.startTime, start.c_str(), 5);
  schedule.startTime[5] = '\0';
  strncpy(schedule.endTime, end.c_str(), 5);
  schedule.endTime[5] = '\0';

  schedule.mode           = preferences.getUChar("sched_mode", kPanasonicAcCool);
  schedule.temperature    = preferences.getInt("sched_temp", 24);
  schedule.quiet          = preferences.getBool("sched_quiet", false);
  schedule.powerful       = preferences.getBool("sched_powerful", false);
  if (schedule.quiet && schedule.powerful) {
    schedule.quiet = false;
  }
  schedule.swingVertical  = preferences.getUChar("sched_swing_v", kPanasonicAcSwingVAuto);
  schedule.swingHorizontal = preferences.getUChar("sched_swing_h", kPanasonicAcSwingHAuto);
  return true;
}
