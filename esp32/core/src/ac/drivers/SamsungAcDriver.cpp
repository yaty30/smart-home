#include "SamsungAcDriver.h"

#include <IRremoteESP8266.h>

SamsungAcDriver::SamsungAcDriver(uint16_t irPin)
    : IrAcBaseDriver(irPin, decode_type_t::SAMSUNG_AC, -1, "samsung_ac") {}

bool SamsungAcDriver::supportsFeature(AcFeature feature) const {
  switch (feature) {
    case AcFeature::Temperature:
    case AcFeature::Mode:
    case AcFeature::Fan:
    case AcFeature::SwingVertical:
    case AcFeature::SwingHorizontal:
    case AcFeature::Quiet:
      return true;
    case AcFeature::Powerful:
      return false;
    default:
      return false;
  }
}
