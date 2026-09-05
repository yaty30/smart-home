#include "ACController.h"
#include "HttpServer.h"
#include "Pairing.h"
#include "ScheduleManager.h"
#include "StateManager.h"
#include "StorageManager.h"
#include "WebSocketServer.h"
#include "WiFiManager.h"
#include "src/tv/TvManager.h"

TvManager tvManager;

void setup() {
  Serial.begin(115200);
  delay(200);

  initStateManager();
  initPairing();
  initACController();

  connectWiFi();

  initHttpServer();
  initWebSocketServer();
  initScheduleManager();

  // Initialize TV manager
  setTvManager(&tvManager);
  tvManager.loadPairedTvs();
  Serial.println("[Setup] TV manager initialized");
}

void loop() {
  handleHttpClient();
  handleWebSocketServer();
  handlePairingButton();
  processQueuedIR();
  handleScheduleExecution();
  tvManager.handle();
  delay(1);
}
