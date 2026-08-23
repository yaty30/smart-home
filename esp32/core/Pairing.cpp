#include "Pairing.h"

#include "Config.h"
#include "Display.h"
#include "State.h"
#include "StateManager.h"

bool isAuthorizedToken(const String& token) {
  return token == PAIRING_TOKEN;
}

bool isAuthorizedBearer(const String& authorizationHeader) {
  String expected = "Bearer ";
  expected += PAIRING_TOKEN;

  return authorizationHeader == expected;
}

void completePairing() {
  applyPairingState(true);
  DisplayState nextDisplayState = displayState;
  nextDisplayState.qrVisible = false;
  applyDisplayState(nextDisplayState);
}

void resetPairing() {
  applyPairingState(false);
  DisplayState nextDisplayState = displayState;
  nextDisplayState.qrVisible = true;
  applyDisplayState(nextDisplayState);
}
