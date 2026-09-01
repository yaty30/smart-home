#include "LgAcDriver.h"

#include <IRremoteESP8266.h>

LgAcDriver::LgAcDriver(uint16_t irPin, const char* proto)
    : IrAcBaseDriver(irPin, resolveProtocol(proto), -1,
                     proto[0] ? proto : "lg") {}

bool LgAcDriver::supportsFeature(AcFeature feature) const {
  switch (feature) {
    case AcFeature::Temperature:
    case AcFeature::Mode:
    case AcFeature::Fan:
    case AcFeature::SwingVertical:
      return true;
    case AcFeature::SwingHorizontal:
    case AcFeature::Quiet:
    case AcFeature::Powerful:
      return false;
    default:
      return false;
  }
}

decode_type_t LgAcDriver::resolveProtocol(const char* name) {
  if (strcmp(name, "lg2") == 0) return decode_type_t::LG2;
  return decode_type_t::LG;
}
