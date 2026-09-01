#include "ToshibaAcDriver.h"

#include <IRremoteESP8266.h>

ToshibaAcDriver::ToshibaAcDriver(uint16_t irPin)
    : IrAcBaseDriver(irPin, decode_type_t::TOSHIBA_AC, -1, "toshiba_ac") {}

bool ToshibaAcDriver::supportsFeature(AcFeature feature) const {
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
