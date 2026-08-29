#include "ACController.h"

#include <IRremoteESP8266.h>
#include <IRsend.h>
#include <ir_Panasonic.h>

#include "Config.h"

IRPanasonicAc ac(IR_PIN);

namespace {

void applyACState(const AcState& state) {
  // setModel() clears model-specific bytes, so apply it before the full state.
  ac.setModel(PANASONIC_AC_MODEL);
  ac.setPower(state.power);
  ac.setMode(state.mode);
  ac.setTemp(state.temperature);
  ac.setFan(state.fan);
  ac.setSwingVertical(state.swingVertical);
  ac.setSwingHorizontal(state.swingHorizontal);
  // This Panasonic profile's Quiet/Powerful bits are reversed for the target AC.
  ac.setQuiet(state.powerful);
  ac.setPowerful(state.quiet);
}

void logHorizontalEncodingCheck() {
  const uint8_t positions[] = {
      kPanasonicAcSwingHFullLeft,
      kPanasonicAcSwingHMiddle,
      kPanasonicAcSwingHFullRight,
  };
  uint8_t encodedBytes[3];

  for (uint8_t i = 0; i < 3; ++i) {
    ac.setModel(PANASONIC_AC_MODEL);
    ac.setSwingHorizontal(positions[i]);
    encodedBytes[i] = ac.getRaw()[17];
  }

  Serial.printf(
      "[AC] Horizontal encoding check: left=0x%02X, center=0x%02X, "
      "right=0x%02X, distinct=%s\n",
      encodedBytes[0], encodedBytes[1], encodedBytes[2],
      encodedBytes[0] != encodedBytes[1] &&
              encodedBytes[1] != encodedBytes[2] &&
              encodedBytes[0] != encodedBytes[2]
          ? "yes"
          : "no");
}

void logRawState(const uint8_t* raw) {
  Serial.print("[AC] Raw state:");
  for (uint8_t i = 0; i < kPanasonicAcStateLength; ++i) {
    Serial.printf(" %02X", raw[i]);
  }
  Serial.println();
}

}  // namespace

void initACController() {
  ac.begin();
  ac.setModel(PANASONIC_AC_MODEL);
  Serial.printf("[AC] Panasonic model profile: DKE/PKR (%d)\n",
                static_cast<int>(ac.getModel()));
  logHorizontalEncodingCheck();
}

void sendAC(const AcState& state) {
  applyACState(state);

  uint8_t* raw = ac.getRaw();
  Serial.printf(
      "[AC] Horizontal airflow: requested=%s (%u), applied=%u, raw[17]=0x%02X\n",
      swingHorizontalString(state.swingHorizontal), state.swingHorizontal,
      ac.getSwingHorizontal(), raw[17]);
  logRawState(raw);
  ac.send();

  Serial.print("Panasonic AC IR sent: power=");
  Serial.print(powerString(state.power));
  Serial.print(", temp=");
  Serial.print(state.temperature);
  Serial.print(", mode=");
  Serial.print(modeString(state.mode));
  Serial.print(", fan=");
  Serial.print(fanString(state.fan));
  Serial.print(", swingVertical=");
  Serial.print(swingVerticalString(state.swingVertical));
  Serial.print(", swingHorizontal=");
  Serial.print(swingHorizontalString(state.swingHorizontal));
  Serial.print(", quiet=");
  Serial.print(state.quiet ? "on" : "off");
  Serial.print(", powerful=");
  Serial.println(state.powerful ? "on" : "off");
}

void queueACCommand(const AcState& state) {
  pendingState = state;
  pendingIRQueuedAt = millis();
  pendingIR = true;
}

void processQueuedIR() {
  if (!pendingIR) {
    return;
  }

  if (millis() - pendingIRQueuedAt < IR_SEND_DELAY_MS) {
    return;
  }

  AcState state = pendingState;
  pendingIR = false;
  sendAC(state);
}
