#pragma once

#include <Arduino.h>

// Wake-on-LAN helper
class WakeOnLan {
public:
  // Send Wake-on-LAN magic packet to MAC address
  // Returns true if packet was sent, false on error
  static bool send(const char* macAddress, const char* broadcastIp = "255.255.255.255");

private:
  static bool parseMacAddress(const char* macStr, uint8_t mac[6]);
  static void buildMagicPacket(const uint8_t mac[6], uint8_t packet[102]);
};
