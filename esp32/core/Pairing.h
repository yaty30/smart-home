#pragma once

#include <Arduino.h>

bool isAuthorizedToken(const String& token);
bool isAuthorizedBearer(const String& authorizationHeader);
String controllerIdFromIP(const String& ip);
void initPairing();
void handlePairingButton();
void enterPairingMode();
void completePairing();
void resetPairing();
