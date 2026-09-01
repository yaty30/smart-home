#pragma once

#include "IrAcBaseDriver.h"

// Hitachi AC driver.
//
// Supported protocols (pass in AcDeviceConfig.protocol):
//   "hitachi_ac"     — HITACHI_AC (default, RAR-series remote)
//   "hitachi_ac1"    — HITACHI_AC1
//   "hitachi_ac2"    — HITACHI_AC2
//   "hitachi_ac3"    — HITACHI_AC3
//   "hitachi_ac264"  — HITACHI_AC264 (264-bit frame)
//   "hitachi_ac296"  — HITACHI_AC296 (296-bit frame)
//   "hitachi_ac344"  — HITACHI_AC344 (344-bit frame)
//   "hitachi_ac424"  — HITACHI_AC424 (424-bit frame)
class HitachiAcDriver : public IrAcBaseDriver {
public:
  explicit HitachiAcDriver(uint16_t irPin, const char* protocolName);
  bool supportsFeature(AcFeature feature) const override;

private:
  static decode_type_t resolveProtocol(const char* name);
};
