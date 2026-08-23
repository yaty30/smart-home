#pragma once

#include <Arduino.h>

bool isAuthorizedToken(const String& token);
bool isAuthorizedBearer(const String& authorizationHeader);
void initPairing();
void handlePairingButton();
void enterPairingMode();
void completePairing();
void resetPairing();
