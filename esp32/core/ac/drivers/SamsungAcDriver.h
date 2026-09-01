#pragma once

#include "IrAcBaseDriver.h"

// Samsung AC driver.  Protocol: SAMSUNG_AC.
// Covers most Samsung wall-split systems (AR-series).
// Note: Samsung AR-09TXHQABT and similar models use the same protocol
// but with slightly different byte mappings; test on-device.
class SamsungAcDriver : public IrAcBaseDriver {
public:
  explicit SamsungAcDriver(uint16_t irPin);
  bool supportsFeature(AcFeature feature) const override;
};
