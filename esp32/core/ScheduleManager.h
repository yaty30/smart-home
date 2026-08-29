#pragma once

#include <Arduino.h>

void initScheduleManager();
void handleScheduleExecution();
bool isNtpTimeAvailable();
void resetScheduleExecutionCursor();
