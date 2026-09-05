#pragma once

#include "TvTypes.h"

class SsdpDiscovery {
public:
  SsdpDiscovery();
  ~SsdpDiscovery();

  // Start discovery scan (non-blocking, runs for specified timeout)
  void startScan(uint32_t timeoutMs = 4000);

  // Check if scan is running
  bool isScanning() const { return scanning; }

  // Get discovered devices (deduplicated)
  uint8_t getDiscoveredCount() const { return discoveredCount; }
  const DiscoveredTv* getDiscovered() const { return discovered; }

  // Must be called regularly from main loop
  void handle();

  // Clear discovered list
  void clear();

private:
  bool scanning;
  unsigned long scanStartTime;
  unsigned long scanTimeout;

  DiscoveredTv discovered[MAX_DISCOVERED_TVS];
  uint8_t discoveredCount;

  void* udp;  // WiFiUDP* (forward declaration to avoid header dependency)

  void sendMSearch();
  void processSsdpResponses();
  void addDiscoveredTv(const DiscoveredTv& tv);
  bool parseSsdpResponse(const String& response, DiscoveredTv& tv);
  bool isDuplicate(const DiscoveredTv& tv) const;
};