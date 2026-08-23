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
         swingHorizontalString(state.swingHorizontal) != "unknown";
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
    preferences.getUChar("ac_swing_h", storedAcState.swingHorizontal)
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
