#include "WakeOnLan.h"
#include <WiFi.h>
#include <WiFiUdp.h>

constexpr uint16_t WOL_PORT = 9;

bool WakeOnLan::send(const char* macAddress, const char* broadcastIp) {
  if (!WiFi.isConnected()) {
    Serial.println("[WOL] WiFi not connected");
    return false;
  }

  if (!macAddress || strlen(macAddress) == 0) {
    Serial.println("[WOL] No MAC address provided");
    return false;
  }

  uint8_t mac[6];
  if (!parseMacAddress(macAddress, mac)) {
    Serial.println("[WOL] Invalid MAC address format");
    return false;
  }

  uint8_t packet[102];
  buildMagicPacket(mac, packet);

  WiFiUDP udp;
  if (!udp.begin(0)) {
    Serial.println("[WOL] Failed to create UDP socket");
    return false;
  }

  if (!udp.beginPacket(broadcastIp, WOL_PORT)) {
    Serial.println("[WOL] Failed to begin UDP packet");
    udp.stop();
    return false;
  }

  udp.write(packet, sizeof(packet));

  if (!udp.endPacket()) {
    Serial.println("[WOL] Failed to send magic packet");
    udp.stop();
    return false;
  }

  udp.stop();

  Serial.print("[WOL] Magic packet sent to ");
  Serial.print(macAddress);
  Serial.print(" via ");
  Serial.println(broadcastIp);

  return true;
}

bool WakeOnLan::parseMacAddress(const char* macStr, uint8_t mac[6]) {
  if (!macStr) return false;

  // Parse MAC address in format: AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF
  int values[6];
  int count = sscanf(macStr, "%x:%x:%x:%x:%x:%x",
                     &values[0], &values[1], &values[2],
                     &values[3], &values[4], &values[5]);

  if (count != 6) {
    count = sscanf(macStr, "%x-%x-%x-%x-%x-%x",
                   &values[0], &values[1], &values[2],
                   &values[3], &values[4], &values[5]);
  }

  if (count != 6) {
    return false;
  }

  for (int i = 0; i < 6; i++) {
    if (values[i] < 0 || values[i] > 255) {
      return false;
    }
    mac[i] = static_cast<uint8_t>(values[i]);
  }

  return true;
}

void WakeOnLan::buildMagicPacket(const uint8_t mac[6], uint8_t packet[102]) {
  // Magic packet: 6 bytes of 0xFF followed by MAC repeated 16 times
  for (int i = 0; i < 6; i++) {
    packet[i] = 0xFF;
  }

  for (int i = 0; i < 16; i++) {
    for (int j = 0; j < 6; j++) {
      packet[6 + i * 6 + j] = mac[j];
    }
  }
}
