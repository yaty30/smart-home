#include "StateManager.h"

#include "ACController.h"
#include "StorageManager.h"
#include "WebSocketServer.h"
#include "ac/AcController.h"

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

  // Load and apply persisted device config so the correct driver is ready
  // before initACController() calls begin().  Falls back to Panasonic DKE
  // (the existing installation default) if no config has been stored yet.
  AcDeviceConfig deviceConfig;
  deviceConfig.brand = AcBrand::Panasonic;
  strncpy(deviceConfig.protocol, "panasonic_ac", sizeof(deviceConfig.protocol) - 1);
  strncpy(deviceConfig.model, "dke", sizeof(deviceConfig.model) - 1);
  deviceConfig.protocol[sizeof(deviceConfig.protocol) - 1] = '\0';
  deviceConfig.model[sizeof(deviceConfig.model) - 1] = '\0';

  if (loadACDeviceConfig(deviceConfig)) {
    Serial.printf("Restored AC device config: brand=%u proto=%s model=%s\n",
                  static_cast<unsigned>(deviceConfig.brand),
                  deviceConfig.protocol, deviceConfig.model);
  }
  acController().configure(deviceConfig);

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
