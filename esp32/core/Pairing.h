#pragma once

#include <Arduino.h>

bool isAuthorizedToken(const String& token);
bool isAuthorizedBearer(const String& authorizationHeader);
void completePairing();
void resetPairing();
