#include "DaikinAcDriver.h"

#include <IRremoteESP8266.h>

DaikinAcDriver::DaikinAcDriver(uint16_t irPin, const char* proto)
    : IrAcBaseDriver(irPin, resolveProtocol(proto), -1, proto[0] ? proto : "daikin") {}

bool DaikinAcDriver::supportsFeature(AcFeature feature) const {
  switch (feature) {
    case AcFeature::Temperature:
    case AcFeature::Mode:
    case AcFeature::Fan:
    case AcFeature::SwingVertical:
      return true;
    case AcFeature::SwingHorizontal:
      // DAIKIN216 and DAIKIN2 support horizontal swing.
      return protocol_ == decode_type_t::DAIKIN216 ||
             protocol_ == decode_type_t::DAIKIN2;
    case AcFeature::Quiet:
      return protocol_ == decode_type_t::DAIKIN ||
             protocol_ == decode_type_t::DAIKIN2 ||
             protocol_ == decode_type_t::DAIKIN216;
    case AcFeature::Powerful:
      return protocol_ == decode_type_t::DAIKIN ||
             protocol_ == decode_type_t::DAIKIN2;
    case AcFeature::Econo:
      return protocol_ == decode_type_t::DAIKIN ||
             protocol_ == decode_type_t::DAIKIN2;
    default:
      return false;
  }
}

decode_type_t DaikinAcDriver::resolveProtocol(const char* name) {
  if (strcmp(name, "daikin2")   == 0) return decode_type_t::DAIKIN2;
  if (strcmp(name, "daikin64")  == 0) return decode_type_t::DAIKIN64;
  if (strcmp(name, "daikin128") == 0) return decode_type_t::DAIKIN128;
  if (strcmp(name, "daikin152") == 0) return decode_type_t::DAIKIN152;
  if (strcmp(name, "daikin160") == 0) return decode_type_t::DAIKIN160;
  if (strcmp(name, "daikin176") == 0) return decode_type_t::DAIKIN176;
  if (strcmp(name, "daikin200") == 0) return decode_type_t::DAIKIN200;
  if (strcmp(name, "daikin216") == 0) return decode_type_t::DAIKIN216;
  if (strcmp(name, "daikin312") == 0) return decode_type_t::DAIKIN312;
  return decode_type_t::DAIKIN;
}
