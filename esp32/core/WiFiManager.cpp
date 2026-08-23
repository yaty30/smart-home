#include "WiFiManager.h"

#include <WiFi.h>

#include "Config.h"
#include "Display.h"

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
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to WiFi");
  showDisplayMessage("Connecting", "WiFi...");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("WiFi connected. IP: ");
  Serial.println(WiFi.localIP());

  noteWiFiConnectedForDisplay();
  renderDisplayState();
}
