#include "GreeAcDriver.h"

#include <IRremoteESP8266.h>

// Gree model integer values (from IRremoteESP8266 gree_ac_remote_model_t):
//   1 = YAN (kGreeYan)  — older YAN remote
//   2 = YBOFB           — YBOFB remote
//   3 = YAA             — YAA/YA1 variant
// These are passed directly as the model integer to IRac so they remain
// stable regardless of how the library names the enum constants.
static constexpr int16_t kGreeModelYan   = 1;
static constexpr int16_t kGreeModelYbofb = 2;
static constexpr int16_t kGreeModelYaa   = 3;

GreeAcDriver::GreeAcDriver(uint16_t irPin, const char* modelName)
    : IrAcBaseDriver(irPin, decode_type_t::GREE, resolveModel(modelName),
                     modelName[0] ? modelName : "gree") {}

bool GreeAcDriver::supportsFeature(AcFeature feature) const {
  switch (feature) {
    case AcFeature::Temperature:
    case AcFeature::Mode:
    case AcFeature::Fan:
    case AcFeature::SwingVertical:
      return true;
    case AcFeature::SwingHorizontal:
      return false;
    case AcFeature::Quiet:
    case AcFeature::Powerful:
      // Quiet/Turbo are available on YAN and YAA remotes.
      return model_ == kGreeModelYan || model_ == kGreeModelYaa;
    case AcFeature::Sleep:
      return true;
    default:
      return false;
  }
}

int16_t GreeAcDriver::resolveModel(const char* name) {
  if (strcmp(name, "yan")  == 0) return kGreeModelYan;
  if (strcmp(name, "ya1")  == 0) return kGreeModelYaa;
  if (strcmp(name, "yb1")  == 0 ||
      strcmp(name, "ybofb") == 0) return kGreeModelYbofb;
  // "bcd" and unknown values: let IRac use protocol defaults.
  return -1;
}
