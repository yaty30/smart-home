#include "PanasonicAcDriver.h"

#include <Arduino.h>

PanasonicAcDriver::PanasonicAcDriver(uint16_t irPin, const char* modelName)
    : ac_(irPin), model_(resolveModel(modelName)) {
  snprintf(protoName_, sizeof(protoName_), "panasonic_ac_%s",
           modelName[0] ? modelName : "dke");
}

void PanasonicAcDriver::begin() {
  ac_.begin();
  // setModel() must be called before any state is applied; it clears
  // model-specific bytes.  Doing it here ensures the IR object starts clean.
  ac_.setModel(model_);
  Serial.printf("[PanasonicAcDriver] Model %s (%d)\n",
                protoName_, static_cast<int>(model_));
}

bool PanasonicAcDriver::send(const AcState& state) {
  // setModel() clears model-specific bytes — apply it before the full state.
  ac_.setModel(model_);
  ac_.setPower(state.power);
  ac_.setMode(toNativeMode(state.mode));
  ac_.setTemp(state.temperature);
  ac_.setFan(toNativeFan(state.fan));
  ac_.setSwingVertical(toNativeSwingV(state.swingVertical));
  ac_.setSwingHorizontal(toNativeSwingH(state.swingHorizontal));
  // NOTE: Quiet/Powerful bits are deliberately swapped for the target unit.
  // The physical remote for this specific AC profile encodes them reversed.
  ac_.setQuiet(state.powerful);
  ac_.setPowerful(state.quiet);

  const uint8_t* raw = ac_.getRaw();
  Serial.printf(
      "[PanasonicAcDriver] H-swing: req=%u applied=%u raw[17]=0x%02X\n",
      state.swingHorizontal, ac_.getSwingHorizontal(), raw[17]);
  Serial.print("[PanasonicAcDriver] Raw:");
  for (uint8_t i = 0; i < kPanasonicAcStateLength; ++i) {
    Serial.printf(" %02X", raw[i]);
  }
  Serial.println();

  ac_.send();

  Serial.printf(
      "[PanasonicAcDriver] Sent: pwr=%s temp=%d mode=%d fan=%u "
      "swV=%u swH=%u quiet=%d powerful=%d\n",
      state.power ? "on" : "off", state.temperature, state.mode,
      state.fan, state.swingVertical, state.swingHorizontal,
      state.quiet, state.powerful);
  return true;
}

bool PanasonicAcDriver::supportsFeature(AcFeature feature) const {
  switch (feature) {
    case AcFeature::Temperature:
    case AcFeature::Mode:
    case AcFeature::Fan:
    case AcFeature::SwingVertical:
    case AcFeature::Quiet:
    case AcFeature::Powerful:
      return true;
    case AcFeature::SwingHorizontal:
      // JKE does not encode horizontal swing; DKE/PKR/RKR do.
      return model_ != kPanasonicJke;
    default:
      return false;
  }
}

const char* PanasonicAcDriver::protocolName() const {
  return protoName_;
}

// ─── Private helpers ─────────────────────────────────────────────────────────

panasonic_ac_remote_model_t PanasonicAcDriver::resolveModel(const char* name) const {
  if (strcmp(name, "jke") == 0) return kPanasonicJke;
  if (strcmp(name, "ckp") == 0) return kPanasonicCkp;
  if (strcmp(name, "rkr") == 0) return kPanasonicRkr;
  // Default: DKE supports all five manual horizontal positions.
  return kPanasonicDke;
}

uint8_t PanasonicAcDriver::toNativeMode(uint8_t m) const {
  switch (m) {
    case AC_MODE_AUTO: return kPanasonicAcAuto;
    case AC_MODE_COOL: return kPanasonicAcCool;
    case AC_MODE_HEAT: return kPanasonicAcHeat;
    case AC_MODE_DRY:  return kPanasonicAcDry;
    case AC_MODE_FAN:  return kPanasonicAcFan;
    default:           return kPanasonicAcCool;
  }
}

uint8_t PanasonicAcDriver::toNativeFan(uint8_t f) const {
  switch (f) {
    case AC_FAN_AUTO: return kPanasonicAcFanAuto;
    case AC_FAN_1:    return kPanasonicAcFanMin;
    case AC_FAN_2:    return kPanasonicAcFanMin + 1;
    case AC_FAN_3:    return kPanasonicAcFanMin + 2;
    case AC_FAN_4:    return kPanasonicAcFanMin + 3;
    case AC_FAN_5:    return kPanasonicAcFanMax;
    default:          return kPanasonicAcFanAuto;
  }
}

uint8_t PanasonicAcDriver::toNativeSwingV(uint8_t sv) const {
  switch (sv) {
    case AC_SWING_V_AUTO:    return kPanasonicAcSwingVAuto;
    case AC_SWING_V_HIGHEST: return kPanasonicAcSwingVHighest;
    case AC_SWING_V_HIGH:    return kPanasonicAcSwingVHigh;
    case AC_SWING_V_MIDDLE:  return kPanasonicAcSwingVMiddle;
    case AC_SWING_V_LOW:     return kPanasonicAcSwingVLow;
    case AC_SWING_V_LOWEST:  return kPanasonicAcSwingVLowest;
    default:                 return kPanasonicAcSwingVAuto;
  }
}

uint8_t PanasonicAcDriver::toNativeSwingH(uint8_t sh) const {
  switch (sh) {
    case AC_SWING_H_AUTO:       return kPanasonicAcSwingHAuto;
    case AC_SWING_H_FULL_LEFT:  return kPanasonicAcSwingHFullLeft;
    case AC_SWING_H_LEFT:       return kPanasonicAcSwingHLeft;
    case AC_SWING_H_MIDDLE:     return kPanasonicAcSwingHMiddle;
    case AC_SWING_H_RIGHT:      return kPanasonicAcSwingHRight;
    case AC_SWING_H_FULL_RIGHT: return kPanasonicAcSwingHFullRight;
    default:                    return kPanasonicAcSwingHAuto;
  }
}
