#pragma once

#include <Arduino.h>
#include <IPAddress.h>

bool isWiFiConnected();
bool isSetupMode();
String ipToString(const IPAddress& ip);
String currentIPString();
String currentWiFiSSID();
String controllerId();
String controllerShortId();
String setupAPSSID();
void connectWiFi();
bool connectProvisionedWiFi(const String& ssid, const String& password, String& assignedIP);
void handleWiFiManager();
