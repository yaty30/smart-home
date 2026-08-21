#pragma once

#include <Arduino.h>
#include <IPAddress.h>

bool isWiFiConnected();
String ipToString(const IPAddress& ip);
String currentIPString();
void connectWiFi();
