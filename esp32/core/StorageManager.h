#pragma once

#include "State.h"

void initStorageManager();
bool loadStoredState(AcState& storedAcState, bool& storedPaired);
void saveACState(const AcState& state);
void savePairingState(bool paired);
void saveSchedules(const AcSchedule schedules[], uint8_t count);
void clearSchedules();
bool loadSchedules(AcSchedule schedules[], uint8_t& count);
