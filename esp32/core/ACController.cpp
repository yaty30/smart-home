#include "ACController.h"

#include "Config.h"
#include "State.h"
#include "src/ac/AcController.h"

#include <Arduino.h>

void initACController() {
  // StateManager has already called acController().configure() with the
  // persisted (or default) device config.  If for any reason it hasn't,
  // fall back to the original Panasonic DKE profile so the device boots
  // into a known-working state.
  if (!acController().isConfigured()) {
    AcDeviceConfig cfg;
    cfg.brand = AcBrand::Panasonic;
    strncpy(cfg.protocol, "panasonic_ac", sizeof(cfg.protocol) - 1);
    strncpy(cfg.model, "dke", sizeof(cfg.model) - 1);
    cfg.protocol[sizeof(cfg.protocol) - 1] = '\0';
    cfg.model[sizeof(cfg.model) - 1] = '\0';
    acController().configure(cfg);
  }

  // begin() is always called here — exactly once — after all subsystems
  // are ready.  configure() deliberately does not call begin() itself.
  acController().begin();
}

void queueACCommand(const AcState& state) {
  pendingState = state;
  pendingIRQueuedAt = millis();
  pendingIR = true;
}

void processQueuedIR() {
  if (!pendingIR) return;
  if (millis() - pendingIRQueuedAt < IR_SEND_DELAY_MS) return;

  AcState state = pendingState;
  pendingIR = false;
  acController().send(state);
}
