#pragma once

#include "State.h"

void initStorageManager();
bool loadStoredState(AcState& storedAcState, DisplayState& storedDisplayState, bool& storedPaired);
void saveACState(const AcState& state);
void saveDisplayState(const DisplayState& state);
void savePairingState(bool paired);
