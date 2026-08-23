#include "StateManager.h"

#include "ACController.h"
#include "Display.h"
#include "StorageManager.h"
#include "WebSocketServer.h"

void initStateManager() {
  initStorageManager();

  AcState storedAcState = acState;
  DisplayState storedDisplayState = displayState;
  bool storedPaired = isPaired;
  if (loadStoredState(storedAcState, storedDisplayState, storedPaired)) {
    acState = storedAcState;
    displayState = storedDisplayState;
    isPaired = storedPaired;
    Serial.println("Restored state from Preferences");
  }

  pairingMode = !isPaired;

  pendingState = acState;
  pendingIR = false;
}

void applyACState(const AcState& nextState) {
  acState = nextState;
  saveACState(acState);
  updateStatusScreen();
  queueACCommand(acState);
  broadcastState();
}

void applyDisplayState(const DisplayState& nextState) {
  displayState = nextState;
  saveDisplayState(displayState);
  renderDisplayState();
  broadcastState();
}

void applyPairingState(bool paired) {
  isPaired = paired;
  savePairingState(isPaired);
}
