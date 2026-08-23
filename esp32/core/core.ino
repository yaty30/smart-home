#include "ACController.h"
#include "Display.h"
#include "HttpServer.h"
#include "StateManager.h"
#include "WebSocketServer.h"
#include "WiFiManager.h"

void setup() {
  Serial.begin(115200);
  delay(200);

  initStateManager();
  initACController();
  initDisplay();
  showDisplayMessage("Starting...");

  connectWiFi();

  initHttpServer();
  initWebSocketServer();
}

void loop() {
  handleHttpClient();
  handleWebSocketServer();
  updateDisplayForWiFi();
  processQueuedIR();
  delay(1);
}
