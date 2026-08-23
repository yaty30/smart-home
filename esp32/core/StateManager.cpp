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

  // A hardware reset is also a recovery path: always expose the pairing QR
  // until the QR pairing flow explicitly completes.
  pairingMode = true;

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
