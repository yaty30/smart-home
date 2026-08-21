#include "Pairing.h"

#include "Config.h"
#include "Display.h"
#include "State.h"

bool isAuthorizedToken(const String& token) {
  return token == PAIRING_TOKEN;
}

bool isAuthorizedBearer(const String& authorizationHeader) {
  String expected = "Bearer ";
  expected += PAIRING_TOKEN;

  return authorizationHeader == expected;
}

void completePairing() {
  isPaired = true;
  renderStatusScreen();
}

void resetPairing() {
  isPaired = false;
  displayQRCodeForIP();
}
