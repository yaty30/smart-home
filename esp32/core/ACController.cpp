#include "ACController.h"

#include <IRremoteESP8266.h>
#include <IRsend.h>
#include <ir_Panasonic.h>

#include "Config.h"
#include "Display.h"

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
  ac.send();

  Serial.print("Panasonic AC IR sent: power=");
  Serial.print(powerString(state.power));
  Serial.print(", temp=");
  Serial.print(state.temperature);
  Serial.print(", mode=");
  Serial.print(modeString(state.mode));
  Serial.print(", fan=");
  Serial.println(fanString(state.fan));
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

void applyACState(const AcState& nextState) {
  acState = nextState;
  updateStatusScreen();
  queueACCommand(acState);
}
