#include "Pairing.h"

#include "Config.h"
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

String controllerIdFromIP(const String& ip) {
  String controllerId = "ctrl-";
  controllerId += ip;
  controllerId.replace(".", "-");
  return controllerId;
}

void initPairing() {
  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);
  Serial.printf("Hold BOOT for %lu ms while running to reset pairing\n",
                PAIRING_BUTTON_HOLD_MS);
}

void enterPairingMode() {
  if (pairingMode) {
    return;
  }

  pairingMode = true;
  Serial.println("Pairing mode enabled");
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
    Serial.println("BOOT long-hold detected; resetting pairing");
    resetPairing();
  }
}

void completePairing() {
  applyPairingState(true);
  pairingMode = false;
  Serial.println("Pairing complete");
}

void resetPairing() {
  applyPairingState(false);
  pairingMode = true;
  Serial.println("Pairing reset");
}
