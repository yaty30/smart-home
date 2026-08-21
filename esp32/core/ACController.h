#pragma once

#include "State.h"

void initACController();
void queueACCommand(const AcState& state);
void processQueuedIR();
void applyACState(const AcState& nextState);
