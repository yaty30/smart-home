#include "Display.h"
#include "Eyes.h"

void setup() {
  Serial.begin(115200);
  delay(200);

  initDisplay();
  initEyes();
}

void loop() {
  updateEyes();
  delay(1);
}
