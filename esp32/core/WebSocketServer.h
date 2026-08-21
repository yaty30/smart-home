#pragma once

#include <Arduino.h>

void initWebSocketServer();
void handleWebSocketServer();
void broadcastState();
String webSocketUrl();
