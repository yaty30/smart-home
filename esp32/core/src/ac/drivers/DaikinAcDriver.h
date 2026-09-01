#pragma once

#include "IrAcBaseDriver.h"

// Daikin driver.
//
// Supported protocols (pass in AcDeviceConfig.protocol):
//   "daikin"     — DAIKIN (default, most common wall/ceiling units)
//   "daikin2"    — DAIKIN2 (some ceiling-cassette units)
//   "daikin64"   — DAIKIN64 (compact remote, limited state)
//   "daikin128"  — DAIKIN128
//   "daikin152"  — DAIKIN152
//   "daikin160"  — DAIKIN160
//   "daikin176"  — DAIKIN176
//   "daikin200"  — DAIKIN200
//   "daikin216"  — DAIKIN216 (BRC-style remotes)
//   "daikin312"  — DAIKIN312
//
// Not all protocols support every feature; supportsFeature() reflects the
// active protocol.  Check your remote's FCC/IC ID to confirm the variant.
class DaikinAcDriver : public IrAcBaseDriver {
public:
  explicit DaikinAcDriver(uint16_t irPin, const char* protocolName);
  bool supportsFeature(AcFeature feature) const override;

private:
  static decode_type_t resolveProtocol(const char* name);
};
