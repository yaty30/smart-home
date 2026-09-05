#include "SsdpDiscovery.h"
#include <WiFi.h>
#include <WiFiUdp.h>

constexpr const char* SSDP_MULTICAST_ADDR = "239.255.255.250";
constexpr uint16_t SSDP_PORT = 1900;
constexpr uint16_t LOCAL_PORT = 0;  // Random port

SsdpDiscovery::SsdpDiscovery()
    : scanning(false),
      scanStartTime(0),
      scanTimeout(0),
      discoveredCount(0),
      udp(nullptr) {
  for (uint8_t i = 0; i < MAX_DISCOVERED_TVS; i++) {
    discovered[i].valid = false;
  }
}

SsdpDiscovery::~SsdpDiscovery() {
  if (udp) {
    WiFiUDP* u = static_cast<WiFiUDP*>(udp);
    u->stop();
    delete u;
    udp = nullptr;
  }
}

void SsdpDiscovery::startScan(uint32_t timeoutMs) {
  if (scanning) {
    return;
  }

  if (!WiFi.isConnected()) {
    Serial.println("[SSDP] Cannot start scan: WiFi not connected");
    return;
  }

  clear();

  if (!udp) {
    udp = new WiFiUDP();
  }

  WiFiUDP* u = static_cast<WiFiUDP*>(udp);
  if (!u->begin(LOCAL_PORT)) {
    Serial.println("[SSDP] Failed to bind UDP socket");
    return;
  }

  scanning = true;
  scanStartTime = millis();
  scanTimeout = timeoutMs;

  Serial.println("[SSDP] Starting TV discovery scan");
  sendMSearch();
}

void SsdpDiscovery::sendMSearch() {
  if (!udp) return;

  WiFiUDP* u = static_cast<WiFiUDP*>(udp);

  // Send M-SEARCH for UPnP root devices
  String msearch = "M-SEARCH * HTTP/1.1\r\n";
  msearch += "HOST: 239.255.255.250:1900\r\n";
  msearch += "MAN: \"ssdp:discover\"\r\n";
  msearch += "MX: 3\r\n";
  msearch += "ST: upnp:rootdevice\r\n";
  msearch += "\r\n";

  u->beginPacket(SSDP_MULTICAST_ADDR, SSDP_PORT);
  u->write(reinterpret_cast<const uint8_t*>(msearch.c_str()), msearch.length());
  u->endPacket();

  Serial.println("[SSDP] Sent M-SEARCH request");
}

void SsdpDiscovery::handle() {
  if (!scanning) return;

  unsigned long now = millis();
  if (now - scanStartTime > scanTimeout) {
    scanning = false;
    if (udp) {
      WiFiUDP* u = static_cast<WiFiUDP*>(udp);
      u->stop();
    }
    Serial.print("[SSDP] Scan complete. Found ");
    Serial.print(discoveredCount);
    Serial.println(" device(s)");
    return;
  }

  processSsdpResponses();
}

void SsdpDiscovery::processSsdpResponses() {
  if (!udp) return;

  WiFiUDP* u = static_cast<WiFiUDP*>(udp);
  int packetSize = u->parsePacket();

  while (packetSize > 0) {
    char buffer[1024];
    int len = u->read(buffer, sizeof(buffer) - 1);
    if (len > 0) {
      buffer[len] = '\0';
      String response(buffer);

      DiscoveredTv tv;
      if (parseSsdpResponse(response, tv)) {
        addDiscoveredTv(tv);
      }
    }

    packetSize = u->parsePacket();
  }
}

bool SsdpDiscovery::parseSsdpResponse(const String& response, DiscoveredTv& tv) {
  tv.valid = false;
  tv.protocol = TvProtocol::Unknown;
  tv.id[0] = '\0';
  tv.name[0] = '\0';
  tv.brand[0] = '\0';
  tv.model[0] = '\0';
  tv.ip[0] = '\0';
  tv.mac[0] = '\0';

  // Look for LG webOS indicators
  bool isLgWebOS = response.indexOf("webos") >= 0 ||
                   response.indexOf("WebOS") >= 0 ||
                   response.indexOf("LG") >= 0;

  if (!isLgWebOS) {
    return false;
  }

  // Extract UDN (unique device name) as stable ID
  int udnPos = response.indexOf("uuid:");
  if (udnPos >= 0) {
    int udnEnd = response.indexOf('\r', udnPos);
    if (udnEnd < 0) udnEnd = response.indexOf('\n', udnPos);
    if (udnEnd > udnPos) {
      String udn = response.substring(udnPos + 5, udnEnd);
      udn.trim();
      strncpy(tv.id, udn.c_str(), sizeof(tv.id) - 1);
      tv.id[sizeof(tv.id) - 1] = '\0';
    }
  }

  // Extract LOCATION to get IP address
  int locPos = response.indexOf("LOCATION:");
  if (locPos < 0) locPos = response.indexOf("Location:");
  if (locPos >= 0) {
    int locEnd = response.indexOf('\r', locPos);
    if (locEnd < 0) locEnd = response.indexOf('\n', locPos);
    if (locEnd > locPos) {
      String location = response.substring(locPos + 9, locEnd);
      location.trim();

      // Parse IP from URL (http://IP:PORT/...)
      int httpPos = location.indexOf("://");
      if (httpPos >= 0) {
        int ipStart = httpPos + 3;
        int ipEnd = location.indexOf(':', ipStart);
        if (ipEnd < 0) ipEnd = location.indexOf('/', ipStart);
        if (ipEnd > ipStart) {
          String ip = location.substring(ipStart, ipEnd);
          strncpy(tv.ip, ip.c_str(), sizeof(tv.ip) - 1);
          tv.ip[sizeof(tv.ip) - 1] = '\0';
        }
      }
    }
  }

  // If no proper ID found, fallback to IP-based ID
  if (tv.id[0] == '\0' && tv.ip[0] != '\0') {
    snprintf(tv.id, sizeof(tv.id), "ip-%s", tv.ip);
  }

  if (tv.id[0] == '\0') {
    return false;
  }

  if (isLgWebOS) {
    strncpy(tv.brand, "LG", sizeof(tv.brand) - 1);
    tv.brand[sizeof(tv.brand) - 1] = '\0';
    strncpy(tv.name, "LG webOS TV", sizeof(tv.name) - 1);
    tv.name[sizeof(tv.name) - 1] = '\0';
    tv.protocol = TvProtocol::WebOS;
  }

  tv.valid = true;
  return true;
}

void SsdpDiscovery::addDiscoveredTv(const DiscoveredTv& tv) {
  if (isDuplicate(tv)) {
    return;
  }

  if (discoveredCount >= MAX_DISCOVERED_TVS) {
    Serial.println("[SSDP] Max discovered TV limit reached");
    return;
  }

  discovered[discoveredCount] = tv;
  discoveredCount++;

  Serial.print("[SSDP] Discovered: ");
  Serial.print(tv.brand);
  Serial.print(" ");
  Serial.print(tv.name);
  Serial.print(" (");
  Serial.print(tv.ip);
  Serial.println(")");
}

bool SsdpDiscovery::isDuplicate(const DiscoveredTv& tv) const {
  for (uint8_t i = 0; i < discoveredCount; i++) {
    if (strcmp(discovered[i].id, tv.id) == 0) {
      return true;
    }

    if (tv.ip[0] != '\0' && discovered[i].ip[0] != '\0' &&
        strcmp(discovered[i].ip, tv.ip) == 0) {
      return true;
    }

    if (tv.mac[0] != '\0' && discovered[i].mac[0] != '\0' &&
        strcmp(discovered[i].mac, tv.mac) == 0) {
      return true;
    }
  }
  return false;
}

void SsdpDiscovery::clear() {
  discoveredCount = 0;
  for (uint8_t i = 0; i < MAX_DISCOVERED_TVS; i++) {
    discovered[i].valid = false;
  }
}
