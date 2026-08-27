#include "ACController.h"
#include "Display.h"
#include "HttpServer.h"
#include "Pairing.h"
#include "ScheduleManager.h"
#include "StateManager.h"
#include "StorageManager.h"
#include "WebSocketServer.h"
#include "WiFiManager.h"

void setup() {
  Serial.begin(115200);
  delay(200);

  initStateManager();
  initPairing();
  initACController();
  initDisplay();
  showDisplayMessage("Starting...");

  connectWiFi();

  initHttpServer();
  initWebSocketServer();
  initScheduleManager();
}

void loop() {
  handleHttpClient();
  handleWebSocketServer();
  handlePairingButton();
  updateDisplayForWiFi();
  processQueuedIR();
  handleScheduleExecution();
  delay(1);
}
