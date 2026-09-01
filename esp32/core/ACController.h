#pragma once

#include "State.h"

// Thin queue layer over AcController.
// The rest of the firmware calls these functions exactly as before.
void initACController();
void queueACCommand(const AcState& state);
void processQueuedIR();
