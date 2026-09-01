#pragma once

#include "State.h"
#include "ac/AcTypes.h"

void initStorageManager();

// AC runtime state (mode/fan/swing use generic AC_* constants from v2+).
bool loadStoredState(AcState& storedAcState, bool& storedPaired);
void saveACState(const AcState& state);

// Device identity — which brand/protocol/model is connected.
bool loadACDeviceConfig(AcDeviceConfig& config);
void saveACDeviceConfig(const AcDeviceConfig& config);

void savePairingState(bool paired);
void saveSchedules(const AcSchedule schedules[], uint8_t count);
void clearSchedules();
bool loadSchedules(AcSchedule schedules[], uint8_t& count);
