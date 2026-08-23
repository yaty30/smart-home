#pragma once

#include <Arduino.h>

void initDisplay();
void renderDisplayState();
void showDisplayMessage(const char* line1, const char* line2 = nullptr);
void renderStatusScreenFull();
void renderStatusScreen();
void updateStatusScreen();
void displayQRCodeForIP();
void showStatusScreen();
void updateDisplayForWiFi();
void clearDisplay();
void noteWiFiConnectedForDisplay();
