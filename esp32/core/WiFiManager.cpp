#include "WiFiManager.h"

#include <WiFi.h>

#include <cstring>

#include "Config.h"

namespace {
constexpr unsigned long WIFI_CONNECT_TIMEOUT_MS = 20000;
constexpr unsigned long WIFI_RETRY_DELAY_MS = 3000;

const char* wifiStatusLabel(wl_status_t status) {
  switch (status) {
    case WL_IDLE_STATUS:
      return "idle";
    case WL_NO_SSID_AVAIL:
      return "ssid not available";
    case WL_SCAN_COMPLETED:
      return "scan completed";
    case WL_CONNECTED:
      return "connected";
    case WL_CONNECT_FAILED:
      return "connect failed";
    case WL_CONNECTION_LOST:
      return "connection lost";
    case WL_DISCONNECTED:
      return "disconnected";
    default:
      return "unknown";
  }
}

const char* encryptionLabel(wifi_auth_mode_t encryptionType) {
  switch (encryptionType) {
    case WIFI_AUTH_OPEN:
      return "open";
    case WIFI_AUTH_WEP:
      return "wep";
    case WIFI_AUTH_WPA_PSK:
      return "wpa";
    case WIFI_AUTH_WPA2_PSK:
      return "wpa2";
    case WIFI_AUTH_WPA_WPA2_PSK:
      return "wpa/wpa2";
    case WIFI_AUTH_WPA2_ENTERPRISE:
      return "wpa2 enterprise";
    case WIFI_AUTH_WPA3_PSK:
      return "wpa3";
    case WIFI_AUTH_WPA2_WPA3_PSK:
      return "wpa2/wpa3";
    default:
      return "unknown";
  }
}

bool findConfiguredNetwork(int32_t& channel, uint8_t bssid[6]) {
  Serial.printf("[WiFi] Scanning for SSID \"%s\"...\n", WIFI_SSID);
  int networkCount = WiFi.scanNetworks(false, true);
  if (networkCount < 0) {
    Serial.printf("[WiFi] Scan failed: %d\n", networkCount);
    return false;
  }

  bool found = false;
  int bestIndex = -1;
  int32_t bestRssi = -127;
  for (int i = 0; i < networkCount; ++i) {
    if (WiFi.SSID(i) != WIFI_SSID) {
      continue;
    }

    // ESP32-S3 supports 2.4 GHz only (channels 1-13); skip 5 GHz entries
    // that share the same SSID on dual-band routers.
    if (WiFi.channel(i) > 13) {
      Serial.printf("[WiFi] Skipping 5 GHz entry on channel %d, BSSID %s\n",
                    WiFi.channel(i), WiFi.BSSIDstr(i).c_str());
      continue;
    }

    found = true;
    if (WiFi.RSSI(i) > bestRssi) {
      bestIndex = i;
      bestRssi = WiFi.RSSI(i);
    }

    Serial.printf(
        "[WiFi] Found SSID on channel %d, RSSI %d dBm, encryption %s, BSSID %s\n",
        WiFi.channel(i),
        WiFi.RSSI(i),
        encryptionLabel(WiFi.encryptionType(i)),
        WiFi.BSSIDstr(i).c_str());
  }

  if (!found) {
    Serial.println("[WiFi] Configured SSID was not found. ESP32-S3 supports 2.4 GHz WiFi only.");
    WiFi.scanDelete();
    return false;
  }

  channel = WiFi.channel(bestIndex);
  memcpy(bssid, WiFi.BSSID(bestIndex), 6);
  Serial.printf("[WiFi] Connecting to strongest BSSID %s on channel %d\n",
                WiFi.BSSIDstr(bestIndex).c_str(),
                channel);

  WiFi.scanDelete();
  return true;
}

bool waitForConnection(const char* attemptLabel) {
  Serial.printf("[WiFi] Connecting (%s)", attemptLabel);
  unsigned long startedAt = millis();

  while (WiFi.status() != WL_CONNECTED &&
         millis() - startedAt < WIFI_CONNECT_TIMEOUT_MS) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WiFi] Connected. IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }

  wl_status_t status = WiFi.status();
  Serial.printf("[WiFi] Connect attempt failed: status=%d (%s)\n",
                status,
                wifiStatusLabel(status));
  return false;
}
}

bool isWiFiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

String ipToString(const IPAddress& ip) {
  return String(ip[0]) + "." + String(ip[1]) + "." + String(ip[2]) + "." + String(ip[3]);
}

String currentIPString() {
  if (!isWiFiConnected()) {
    return "0.0.0.0";
  }

  return ipToString(WiFi.localIP());
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.setSleep(false);

  WiFi.setAutoReconnect(true);

  while (WiFi.status() != WL_CONNECTED) {
    WiFi.disconnect(false, false);
    delay(250);

    int32_t channel = 0;
    uint8_t bssid[6] = {0};
    bool hasScannedNetwork = findConfiguredNetwork(channel, bssid);

    if (hasScannedNetwork) {
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD, channel, bssid);
      if (waitForConnection("scanned BSSID")) {
        return;
      }
    }

    WiFi.disconnect(false, false);
    delay(250);
    Serial.println("[WiFi] Retrying without BSSID pin");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    if (waitForConnection("SSID only")) {
      return;
    }

    Serial.printf("[WiFi] Retrying in %lu ms\n", WIFI_RETRY_DELAY_MS);
    delay(WIFI_RETRY_DELAY_MS);
  }
}
