#include "MitsubishiHeavyAcDriver.h"

#include <IRremoteESP8266.h>

MitsubishiHeavyAcDriver::MitsubishiHeavyAcDriver(uint16_t irPin, const char* proto)
    : IrAcBaseDriver(irPin, resolveProtocol(proto), -1,
                     proto[0] ? proto : "mitsubishi_heavy_152") {}

bool MitsubishiHeavyAcDriver::supportsFeature(AcFeature feature) const {
  switch (feature) {
    case AcFeature::Temperature:
    case AcFeature::Mode:
    case AcFeature::Fan:
    case AcFeature::SwingVertical:
      return true;
    case AcFeature::SwingHorizontal:
      return protocol_ == decode_type_t::MITSUBISHI_HEAVY_152;
    case AcFeature::Quiet:
    case AcFeature::Powerful:
      return protocol_ == decode_type_t::MITSUBISHI_HEAVY_152;
    default:
      return false;
  }
}

decode_type_t MitsubishiHeavyAcDriver::resolveProtocol(const char* name) {
  if (strcmp(name, "mitsubishi_heavy_88") == 0)
    return decode_type_t::MITSUBISHI_HEAVY_88;
  return decode_type_t::MITSUBISHI_HEAVY_152;
}
