#include "AcController.h"

#include "drivers/PanasonicAcDriver.h"
#include "drivers/DaikinAcDriver.h"
#include "drivers/MitsubishiElectricAcDriver.h"
#include "drivers/MitsubishiHeavyAcDriver.h"
#include "drivers/HitachiAcDriver.h"
#include "drivers/GreeAcDriver.h"
#include "drivers/MideaAcDriver.h"
#include "drivers/SamsungAcDriver.h"
#include "drivers/LgAcDriver.h"
#include "drivers/ToshibaAcDriver.h"
#include "../Config.h"

#include <Arduino.h>

// Default on-device config: existing Panasonic DKE installation.
static const AcDeviceConfig kDefaultConfig = {
  AcBrand::Panasonic,
  "panasonic_ac",
  "dke"
};

AcController::AcController()
    : activeDriver_(nullptr), config_(kDefaultConfig) {}

AcController::~AcController() {
  delete activeDriver_;
}

void AcController::configure(const AcDeviceConfig& config) {
  delete activeDriver_;
  activeDriver_ = nullptr;
  config_ = config;
  activeDriver_ = createDriver(config);
  // begin() is called separately by initACController() so the driver
  // initialises exactly once, after all other subsystems are ready.
}

void AcController::begin() {
  if (activeDriver_) {
    activeDriver_->begin();
  }
}

bool AcController::send(const AcState& state) {
  if (!activeDriver_) {
    Serial.println("[AcController] No driver configured");
    return false;
  }
  return activeDriver_->send(state);
}

bool AcController::supportsFeature(AcFeature feature) const {
  if (!activeDriver_) return false;
  return activeDriver_->supportsFeature(feature);
}

bool AcController::isConfigured() const {
  return activeDriver_ != nullptr;
}

const AcDeviceConfig& AcController::getConfig() const {
  return config_;
}

const char* AcController::protocolName() const {
  if (!activeDriver_) return "none";
  return activeDriver_->protocolName();
}

AcDriver* AcController::createDriver(const AcDeviceConfig& config) const {
  switch (config.brand) {
    case AcBrand::Panasonic:
      return new PanasonicAcDriver(IR_PIN, config.model);
    case AcBrand::Daikin:
      return new DaikinAcDriver(IR_PIN, config.protocol);
    case AcBrand::MitsubishiElectric:
      return new MitsubishiElectricAcDriver(IR_PIN, config.protocol);
    case AcBrand::MitsubishiHeavy:
      return new MitsubishiHeavyAcDriver(IR_PIN, config.protocol);
    case AcBrand::Hitachi:
      return new HitachiAcDriver(IR_PIN, config.protocol);
    case AcBrand::Gree:
      return new GreeAcDriver(IR_PIN, config.model);
    case AcBrand::Midea:
      return new MideaAcDriver(IR_PIN);
    case AcBrand::Samsung:
      return new SamsungAcDriver(IR_PIN);
    case AcBrand::LG:
      return new LgAcDriver(IR_PIN, config.protocol);
    case AcBrand::Toshiba:
      return new ToshibaAcDriver(IR_PIN);
    default:
      Serial.println("[AcController] Unknown brand; falling back to Panasonic DKE");
      return new PanasonicAcDriver(IR_PIN, "dke");
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

AcController& acController() {
  static AcController instance;
  return instance;
}
