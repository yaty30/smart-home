#pragma once

#include "IrAcBaseDriver.h"

// Gree AC driver.
//
// Protocol: GREE.  Models (pass in AcDeviceConfig.model):
//   ""     — auto / no explicit model (default)
//   "yan"  — kGreeYan
//   "ya1"  — kGreeYAA / YA1 variant
//   "yb1"  — kGreeYB1
//   "bcd"  — kGreeBCD
class GreeAcDriver : public IrAcBaseDriver {
public:
  explicit GreeAcDriver(uint16_t irPin, const char* modelName);
  bool supportsFeature(AcFeature feature) const override;

private:
  static int16_t resolveModel(const char* name);
};
