#include "StateManager.h"

#include "ACController.h"
#include "StorageManager.h"
#include "WebSocketServer.h"

void initStateManager() {
  initStorageManager();

  AcState storedAcState = acState;
  bool storedPaired = isPaired;
  if (loadStoredState(storedAcState, storedPaired)) {
    acState = storedAcState;
    isPaired = storedPaired;
    Serial.println("Restored state from Preferences");
  }

  if (loadSchedules(acSchedules, acScheduleCount)) {
    Serial.printf("Restored %u schedule(s) from Preferences\n", acScheduleCount);
  }

  pairingMode = !isPaired;

  pendingState = acState;
  pendingIR = false;
}

void applyACState(const AcState& nextState) {
  acState = nextState;
  saveACState(acState);
  queueACCommand(acState);
  broadcastState();
}

void applyPairingState(bool paired) {
  isPaired = paired;
  savePairingState(isPaired);
}
