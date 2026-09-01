#pragma once

#include "IrAcBaseDriver.h"

// Midea AC driver.  Protocol: MIDEA.
// No model variants in IRremoteESP8266; the single MIDEA protocol covers
// the majority of Midea, Carrier, Pioneer, and relabelled units.
class MideaAcDriver : public IrAcBaseDriver {
public:
  explicit MideaAcDriver(uint16_t irPin);
  bool supportsFeature(AcFeature feature) const override;
};
