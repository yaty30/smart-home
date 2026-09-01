#pragma once

#include "IrAcBaseDriver.h"

// Toshiba AC driver.  Protocol: TOSHIBA_AC.
// Covers most Toshiba wall-split (RAS-series) units.
class ToshibaAcDriver : public IrAcBaseDriver {
public:
  explicit ToshibaAcDriver(uint16_t irPin);
  bool supportsFeature(AcFeature feature) const override;
};
