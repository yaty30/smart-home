#pragma once

#include "State.h"

void initStorageManager();
bool loadStoredState(AcState& storedAcState, bool& storedPaired);
void saveACState(const AcState& state);
void savePairingState(bool paired);
bool loadWiFiCredentials(String& ssid, String& password);
void saveWiFiCredentials(const String& ssid, const String& password);
void saveSchedule(const AcSchedule& schedule);
void clearSchedule();
bool loadSchedule(AcSchedule& schedule);
