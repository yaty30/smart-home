#pragma once

#include "../AcDriver.h"
#include "../../../State.h"
#include <IRremoteESP8266.h>
#include <IRsend.h>
#include <ir_Panasonic.h>

// Panasonic AC driver.
//
// Uses IRPanasonicAc directly to preserve byte-level control, including the
// Quiet/Powerful bit swap required by the specific target unit (DKE profile).
//
// Supported protocol: PANASONIC_AC
// Supported models:   kPanasonicDke (default), kPanasonicJke, kPanasonicCkp,
//                     kPanasonicRkr — pass the model name in AcDeviceConfig.model
class PanasonicAcDriver : public AcDriver {
public:
  // modelName: "dke", "jke", "ckp", "rkr" — empty or unknown defaults to "dke".
  explicit PanasonicAcDriver(uint16_t irPin, const char* modelName);

  void begin() override;
  bool send(const AcState& state) override;
  bool supportsFeature(AcFeature feature) const override;
  const char* protocolName() const override;

private:
  IRPanasonicAc ac_;
  panasonic_ac_remote_model_t model_;
  char protoName_[24];

  panasonic_ac_remote_model_t resolveModel(const char* name) const;

  // Translate generic AC_MODE_* to kPanasonicAcXxx.
  uint8_t toNativeMode(uint8_t genericMode) const;
  // Translate generic AC_FAN_* to kPanasonicAcFanXxx.
  uint8_t toNativeFan(uint8_t genericFan) const;
  // Translate generic AC_SWING_V_* to kPanasonicAcSwingVXxx.
  uint8_t toNativeSwingV(uint8_t genericSwingV) const;
  // Translate generic AC_SWING_H_* to kPanasonicAcSwingHXxx.
  uint8_t toNativeSwingH(uint8_t genericSwingH) const;
};
