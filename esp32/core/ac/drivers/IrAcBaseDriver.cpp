#include "IrAcBaseDriver.h"

#include <Arduino.h>

IrAcBaseDriver::IrAcBaseDriver(uint16_t irPin, decode_type_t protocol,
                               int16_t model, const char* protoNameStr)
    : ac_(irPin), protocol_(protocol), model_(model) {
  strncpy(protoName_, protoNameStr, sizeof(protoName_) - 1);
  protoName_[sizeof(protoName_) - 1] = '\0';

  // Initialise lastState_ to a known baseline so the first send is always
  // a full-state transmission rather than a delta from garbage memory.
  lastState_.protocol = protocol;
  lastState_.model    = model;
  lastState_.power    = false;
  lastState_.mode     = stdAc::opmode_t::kCool;
  lastState_.celsius  = true;
  lastState_.degrees  = 24.0f;
  lastState_.fanspeed = stdAc::fanspeed_t::kAuto;
  lastState_.swingv   = stdAc::swingv_t::kAuto;
  lastState_.swingh   = stdAc::swingh_t::kAuto;
  lastState_.quiet    = false;
  lastState_.turbo    = false;
  lastState_.econo    = false;
  lastState_.light    = false;
  lastState_.filter   = false;
  lastState_.clean    = false;
  lastState_.sleep    = -1;
  lastState_.beep     = false;
  lastState_.clock    = -1;
}

void IrAcBaseDriver::begin() {
  // IRac does not need an explicit begin(); the IR LED GPIO is configured
  // on the first send.  Log readiness here for diagnostics.
  Serial.printf("[%s] driver ready\n", protoName_);
}

bool IrAcBaseDriver::send(const AcState& state) {
  stdAc::state_t s = toStdState(state);

  if (!ac_.sendAc(s, &lastState_)) {
    Serial.printf("[%s] sendAc failed\n", protoName_);
    return false;
  }

  lastState_ = s;

  Serial.printf(
      "[%s] Sent: pwr=%s temp=%d mode=%d fan=%d swV=%d swH=%d "
      "quiet=%d turbo=%d\n",
      protoName_, state.power ? "on" : "off", state.temperature,
      state.mode, state.fan, state.swingVertical, state.swingHorizontal,
      state.quiet, state.powerful);
  return true;
}

const char* IrAcBaseDriver::protocolName() const {
  return protoName_;
}

stdAc::state_t IrAcBaseDriver::toStdState(const AcState& state) const {
  stdAc::state_t s = lastState_;
  s.protocol = protocol_;
  s.model    = model_;
  s.power    = state.power;
  s.mode     = toOpMode(state.mode);
  s.degrees  = static_cast<float>(state.temperature);
  s.celsius  = true;
  s.fanspeed = toFanSpeed(state.fan);
  s.swingv   = toSwingV(state.swingVertical);
  s.swingh   = toSwingH(state.swingHorizontal);
  s.quiet    = state.quiet;
  s.turbo    = state.powerful;
  return s;
}

stdAc::opmode_t IrAcBaseDriver::toOpMode(uint8_t m) {
  switch (m) {
    case AC_MODE_AUTO: return stdAc::opmode_t::kAuto;
    case AC_MODE_COOL: return stdAc::opmode_t::kCool;
    case AC_MODE_HEAT: return stdAc::opmode_t::kHeat;
    case AC_MODE_DRY:  return stdAc::opmode_t::kDry;
    case AC_MODE_FAN:  return stdAc::opmode_t::kFan;
    default:           return stdAc::opmode_t::kCool;
  }
}

stdAc::fanspeed_t IrAcBaseDriver::toFanSpeed(uint8_t f) {
  switch (f) {
    case AC_FAN_AUTO: return stdAc::fanspeed_t::kAuto;
    case AC_FAN_1:    return stdAc::fanspeed_t::kMin;
    case AC_FAN_2:    return stdAc::fanspeed_t::kLow;
    case AC_FAN_3:    return stdAc::fanspeed_t::kMedium;
    case AC_FAN_4:    return stdAc::fanspeed_t::kHigh;
    case AC_FAN_5:    return stdAc::fanspeed_t::kMax;
    default:          return stdAc::fanspeed_t::kAuto;
  }
}

stdAc::swingv_t IrAcBaseDriver::toSwingV(uint8_t sv) {
  switch (sv) {
    case AC_SWING_V_AUTO:    return stdAc::swingv_t::kAuto;
    case AC_SWING_V_HIGHEST: return stdAc::swingv_t::kHighest;
    case AC_SWING_V_HIGH:    return stdAc::swingv_t::kHigh;
    case AC_SWING_V_MIDDLE:  return stdAc::swingv_t::kMiddle;
    case AC_SWING_V_LOW:     return stdAc::swingv_t::kLow;
    case AC_SWING_V_LOWEST:  return stdAc::swingv_t::kLowest;
    default:                 return stdAc::swingv_t::kAuto;
  }
}

stdAc::swingh_t IrAcBaseDriver::toSwingH(uint8_t sh) {
  switch (sh) {
    case AC_SWING_H_AUTO:       return stdAc::swingh_t::kAuto;
    case AC_SWING_H_FULL_LEFT:  return stdAc::swingh_t::kLeftMax;
    case AC_SWING_H_LEFT:       return stdAc::swingh_t::kLeft;
    case AC_SWING_H_MIDDLE:     return stdAc::swingh_t::kMiddle;
    case AC_SWING_H_RIGHT:      return stdAc::swingh_t::kRight;
    case AC_SWING_H_FULL_RIGHT: return stdAc::swingh_t::kRightMax;
    default:                    return stdAc::swingh_t::kAuto;
  }
}
