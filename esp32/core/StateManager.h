#pragma once

#include "State.h"

void initStateManager();
void applyACState(const AcState& nextState);
void applyPairingState(bool paired);
