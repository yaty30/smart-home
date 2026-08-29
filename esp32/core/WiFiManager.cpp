#include "WiFiManager.h"

#include <WiFi.h>

#include "Config.h"
#include "StorageManager.h"

namespace {
constexpr unsigned long WIFI_CONNECT_TIMEOUT_MS = 20000;
constexpr unsigned long SETUP_AP_STOP_DELAY_MS = 2000;

bool setupMode = false;
bool setupApStopScheduled = false;
unsigned long setupApStopAt = 0;
String cachedControllerId;
String cachedControllerShortId;

String macHex() {
  uint64_t mac = ESP.getEfuseMac();
  char buffer[13];
  snprintf(
    buffer,
    sizeof(buffer),
    "%02X%02X%02X%02X%02X%02X",
    static_cast<uint8_t>((mac >> 40) & 0xFF),
    static_cast<uint8_t>((mac >> 32) & 0xFF),
    static_cast<uint8_t>((mac >> 24) & 0xFF),
    static_cast<uint8_t>((mac >> 16) & 0xFF),
    static_cast<uint8_t>((mac >> 8) & 0xFF),
    static_cast<uint8_t>(mac & 0xFF)
  );
  return String(buffer);
}

bool waitForWiFiConnection(unsigned long timeoutMs) {
  unsigned long startedAt = millis();
  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < timeoutMs) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  return WiFi.status() == WL_CONNECTED;
}

void ensureControllerIds() {
  if (cachedControllerId.length() > 0) {
    return;
  }

  String mac = macHex();
  cachedControllerId = "esp32-" + mac;
  cachedControllerShortId = mac.substring(mac.length() - 6);
}

void startSetupAP() {
  ensureControllerIds();

  setupMode = true;
  setupApStopScheduled = false;
  WiFi.mode(WIFI_AP_STA);

  String ssid = setupAPSSID();
  bool started = WiFi.softAP(ssid.c_str(), SETUP_AP_PASSWORD);
  Serial.print("Setup AP ");
  Serial.print(started ? "started: " : "failed: ");
  Serial.println(ssid);
  Serial.print("Setup AP IP: ");
  Serial.println(WiFi.softAPIP());
}

void scheduleSetupAPStop() {
  setupApStopScheduled = true;
  setupApStopAt = millis() + SETUP_AP_STOP_DELAY_MS;
}
}

bool isWiFiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

bool isSetupMode() {
  return setupMode;
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

String currentWiFiSSID() {
  if (!isWiFiConnected()) {
    return "";
  }

  return WiFi.SSID();
}

String controllerId() {
  ensureControllerIds();
  return cachedControllerId;
}

String controllerShortId() {
  ensureControllerIds();
  return cachedControllerShortId;
}

String setupAPSSID() {
  return String(SETUP_AP_PREFIX) + controllerShortId();
}

void connectWiFi() {
  String ssid;
  String password;
  if (!loadWiFiCredentials(ssid, password)) {
    Serial.println("No saved WiFi credentials; entering setup mode");
    startSetupAP();
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());

  if (waitForWiFiConnection(WIFI_CONNECT_TIMEOUT_MS)) {
    setupMode = false;
    Serial.print("WiFi connected. IP: ");
    Serial.println(WiFi.localIP());
    return;
  }

  Serial.println("Saved WiFi credentials did not connect; entering setup mode");
  WiFi.disconnect(false);
  startSetupAP();
}

bool connectProvisionedWiFi(const String& ssid, const String& password, String& assignedIP) {
  if (ssid.length() == 0) {
    return false;
  }

  setupMode = true;
  setupApStopScheduled = false;
  WiFi.mode(WIFI_AP_STA);
  if (WiFi.softAPSSID().length() == 0) {
    WiFi.softAP(setupAPSSID().c_str(), SETUP_AP_PASSWORD);
  }

  WiFi.disconnect(false);
  delay(100);
  WiFi.begin(ssid.c_str(), password.c_str());

  if (!waitForWiFiConnection(WIFI_CONNECT_TIMEOUT_MS)) {
    Serial.println("Provisioned WiFi connection failed; setup AP remains available");
    WiFi.disconnect(false);
    startSetupAP();
    return false;
  }

  assignedIP = currentIPString();
  saveWiFiCredentials(ssid, password);
  setupMode = false;
  scheduleSetupAPStop();

  Serial.print("Provisioned WiFi connected. IP: ");
  Serial.println(WiFi.localIP());
  return true;
}

void handleWiFiManager() {
  if (!setupApStopScheduled || millis() < setupApStopAt) {
    return;
  }

  setupApStopScheduled = false;
  WiFi.softAPdisconnect(true);
  if (isWiFiConnected()) {
    WiFi.mode(WIFI_STA);
  }
  Serial.println("Setup AP stopped");
}
