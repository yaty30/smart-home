#pragma once

#include "IrAcBaseDriver.h"

// Mitsubishi Electric driver.
//
// Supported protocols (pass in AcDeviceConfig.protocol):
//   "mitsubishi_ac"  — MITSUBISHI_AC (default, MSZ/MUZ split systems)
//   "mitsubishi136"  — MITSUBISHI136 (36-bit remote)
//   "mitsubishi112"  — MITSUBISHI112 (112-bit frame)
class MitsubishiElectricAcDriver : public IrAcBaseDriver {
public:
  explicit MitsubishiElectricAcDriver(uint16_t irPin, const char* protocolName);
  bool supportsFeature(AcFeature feature) const override;

private:
  static decode_type_t resolveProtocol(const char* name);
};
