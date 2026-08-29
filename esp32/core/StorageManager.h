#pragma once

#include "State.h"

void initStorageManager();
bool loadStoredState(AcState& storedAcState, bool& storedPaired);
void saveACState(const AcState& state);
void savePairingState(bool paired);
void saveSchedule(const AcSchedule& schedule);
void clearSchedule();
bool loadSchedule(AcSchedule& schedule);
