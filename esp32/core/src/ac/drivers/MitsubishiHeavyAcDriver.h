#pragma once

#include "IrAcBaseDriver.h"

// Mitsubishi Heavy Industries driver.
//
// Supported protocols (pass in AcDeviceConfig.protocol):
//   "mitsubishi_heavy_88"   — MITSUBISHI_HEAVY_88 (SRKxx-ZE/ZEA remote)
//   "mitsubishi_heavy_152"  — MITSUBISHI_HEAVY_152 (default, SRKxx-ZM remote)
class MitsubishiHeavyAcDriver : public IrAcBaseDriver {
public:
  explicit MitsubishiHeavyAcDriver(uint16_t irPin, const char* protocolName);
  bool supportsFeature(AcFeature feature) const override;

private:
  static decode_type_t resolveProtocol(const char* name);
};
