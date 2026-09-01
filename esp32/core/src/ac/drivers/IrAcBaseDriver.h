#pragma once

// Shared base for all non-Panasonic drivers that use IRac + stdAc::state_t.
// Brand-specific subclasses set the protocol and override supportsFeature().

#include "../AcDriver.h"
#include "../AcTypes.h"
#include "../../../State.h"

#include <IRremoteESP8266.h>
#include <IRac.h>
#include <IRutils.h>

class IrAcBaseDriver : public AcDriver {
public:
  IrAcBaseDriver(uint16_t irPin, decode_type_t protocol,
                 int16_t model, const char* protoNameStr);

  void begin() override;
  bool send(const AcState& state) override;
  const char* protocolName() const override;

protected:
  IRac      ac_;
  decode_type_t protocol_;
  int16_t   model_;
  char      protoName_[32];
  stdAc::state_t lastState_;

  // Convert generic AcState to the stdAc::state_t needed by IRac.
  stdAc::state_t toStdState(const AcState& state) const;

  static stdAc::opmode_t   toOpMode(uint8_t genericMode);
  static stdAc::fanspeed_t toFanSpeed(uint8_t genericFan);
  static stdAc::swingv_t   toSwingV(uint8_t genericSwingV);
  static stdAc::swingh_t   toSwingH(uint8_t genericSwingH);
};
