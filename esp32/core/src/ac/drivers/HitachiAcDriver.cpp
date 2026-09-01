#include "HitachiAcDriver.h"

#include <IRremoteESP8266.h>

HitachiAcDriver::HitachiAcDriver(uint16_t irPin, const char* proto)
    : IrAcBaseDriver(irPin, resolveProtocol(proto), -1, proto[0] ? proto : "hitachi_ac") {}

bool HitachiAcDriver::supportsFeature(AcFeature feature) const {
  switch (feature) {
    case AcFeature::Temperature:
    case AcFeature::Mode:
    case AcFeature::Fan:
    case AcFeature::SwingVertical:
      return true;
    case AcFeature::SwingHorizontal:
      return protocol_ == decode_type_t::HITACHI_AC3 ||
             protocol_ == decode_type_t::HITACHI_AC344 ||
             protocol_ == decode_type_t::HITACHI_AC424;
    default:
      return false;
  }
}

decode_type_t HitachiAcDriver::resolveProtocol(const char* name) {
  if (strcmp(name, "hitachi_ac1")   == 0) return decode_type_t::HITACHI_AC1;
  if (strcmp(name, "hitachi_ac2")   == 0) return decode_type_t::HITACHI_AC2;
  if (strcmp(name, "hitachi_ac3")   == 0) return decode_type_t::HITACHI_AC3;
  if (strcmp(name, "hitachi_ac264") == 0) return decode_type_t::HITACHI_AC264;
  if (strcmp(name, "hitachi_ac296") == 0) return decode_type_t::HITACHI_AC296;
  if (strcmp(name, "hitachi_ac344") == 0) return decode_type_t::HITACHI_AC344;
  if (strcmp(name, "hitachi_ac424") == 0) return decode_type_t::HITACHI_AC424;
  return decode_type_t::HITACHI_AC;
}
