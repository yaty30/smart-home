#pragma once

#include "IrAcBaseDriver.h"

// LG AC driver.
//
// Supported protocols (pass in AcDeviceConfig.protocol):
//   "lg"   — LG (default, AKB-series remotes)
//   "lg2"  — LG2 (newer dual-inverter / ARTCOOL series)
class LgAcDriver : public IrAcBaseDriver {
public:
  explicit LgAcDriver(uint16_t irPin, const char* protocolName);
  bool supportsFeature(AcFeature feature) const override;

private:
  static decode_type_t resolveProtocol(const char* name);
};
