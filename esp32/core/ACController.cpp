#include "ACController.h"

#include <IRremoteESP8266.h>
#include <IRsend.h>
#include <ir_Panasonic.h>

#include "Config.h"

IRPanasonicAc ac(IR_PIN);

void initACController() {
  ac.begin();
  ac.setModel(kPanasonicJke);
}

void sendAC(const AcState& state) {
  ac.setPower(state.power);
  ac.setMode(state.mode);
  ac.setTemp(state.temperature);
  ac.setFan(state.fan);
  ac.setSwingVertical(state.swingVertical);
  ac.setSwingHorizontal(state.swingHorizontal);
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
  Serial.println(swingHorizontalString(state.swingHorizontal));
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
