#include "Pairing.h"

#include "Config.h"
#include "Display.h"
#include "State.h"
#include "StateManager.h"
#include "WebSocketServer.h"

namespace {
bool bootButtonWasPressed = false;
bool bootButtonHoldHandled = false;
unsigned long bootButtonPressedAt = 0;
}

bool isAuthorizedToken(const String& token) {
  return token == PAIRING_TOKEN;
}

bool isAuthorizedBearer(const String& authorizationHeader) {
  String expected = "Bearer ";
  expected += PAIRING_TOKEN;

  return authorizationHeader == expected;
}

void initPairing() {
  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);
}

void enterPairingMode() {
  if (pairingMode) {
    return;
  }

  pairingMode = true;
  Serial.println("Pairing mode enabled");
  renderDisplayState();
  broadcastState();
}

void handlePairingButton() {
  bool pressed = digitalRead(BOOT_BUTTON_PIN) == LOW;

  if (!pressed) {
    bootButtonWasPressed = false;
    bootButtonHoldHandled = false;
    return;
  }

  if (!bootButtonWasPressed) {
    bootButtonWasPressed = true;
    bootButtonPressedAt = millis();
    return;
  }

  if (!bootButtonHoldHandled && isPaired && millis() - bootButtonPressedAt >= PAIRING_BUTTON_HOLD_MS) {
    bootButtonHoldHandled = true;
    enterPairingMode();
  }
}

void completePairing() {
  applyPairingState(true);
  pairingMode = false;
  DisplayState nextDisplayState = displayState;
  nextDisplayState.qrVisible = false;
  applyDisplayState(nextDisplayState);
  Serial.println("Pairing complete");
}

void resetPairing() {
  applyPairingState(false);
  pairingMode = true;
  renderDisplayState();
  broadcastState();
}
