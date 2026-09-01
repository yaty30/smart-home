#include "MitsubishiElectricAcDriver.h"

#include <IRremoteESP8266.h>

MitsubishiElectricAcDriver::MitsubishiElectricAcDriver(uint16_t irPin, const char* proto)
    : IrAcBaseDriver(irPin, resolveProtocol(proto), -1,
                     proto[0] ? proto : "mitsubishi_ac") {}

bool MitsubishiElectricAcDriver::supportsFeature(AcFeature feature) const {
  switch (feature) {
    case AcFeature::Temperature:
    case AcFeature::Mode:
    case AcFeature::Fan:
    case AcFeature::SwingVertical:
      return true;
    case AcFeature::SwingHorizontal:
      return protocol_ == decode_type_t::MITSUBISHI_AC;
    case AcFeature::Quiet:
      return protocol_ == decode_type_t::MITSUBISHI_AC;
    default:
      return false;
  }
}

decode_type_t MitsubishiElectricAcDriver::resolveProtocol(const char* name) {
  if (strcmp(name, "mitsubishi136") == 0) return decode_type_t::MITSUBISHI136;
  if (strcmp(name, "mitsubishi112") == 0) return decode_type_t::MITSUBISHI112;
  return decode_type_t::MITSUBISHI_AC;
}
