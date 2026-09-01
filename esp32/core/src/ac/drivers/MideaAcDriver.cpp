#include "MideaAcDriver.h"

#include <IRremoteESP8266.h>

MideaAcDriver::MideaAcDriver(uint16_t irPin)
    : IrAcBaseDriver(irPin, decode_type_t::MIDEA, -1, "midea") {}

bool MideaAcDriver::supportsFeature(AcFeature feature) const {
  switch (feature) {
    case AcFeature::Temperature:
    case AcFeature::Mode:
    case AcFeature::Fan:
      return true;
    case AcFeature::SwingVertical:
    case AcFeature::SwingHorizontal:
    case AcFeature::Quiet:
    case AcFeature::Powerful:
      return false;
    default:
      return false;
  }
}
