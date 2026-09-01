#pragma once

#include "TvTypes.h"
#include "SsdpDiscovery.h"
#include "LgWebOsTv.h"

// Central manager for TV discovery, pairing, and control
class TvManager {
public:
  TvManager();
  ~TvManager();

  // Discovery
  void startDiscovery();
  bool isDiscovering() const;
  uint8_t getDiscoveredCount() const;
  const DiscoveredTv* getDiscovered() const;

  // Pairing
  bool startPairing(const char* discoveryId);
  LgPairingState getPairingState() const;
  const char* getPairingClientKey() const;
  bool submitPairingPin(const char* pin);
  bool completePairing(const char* tvName);

  // Get paired TVs
  uint8_t getPairedCount() const { return pairedCount; }
  const PairedTv* getPairedTv(const char* id) const;
  const PairedTv* getPairedTvByIndex(uint8_t index) const;
  bool isTvPaired(const char* id) const;
  bool unpairTv(const char* id);

  // Send commands to paired TV
  bool sendTvCommand(const char* tvId, const char* command);

  // Must be called regularly from main loop
  void handle();

  // Load/save paired TVs
  void loadPairedTvs();
  void savePairedTvs();

private:
  SsdpDiscovery discovery;
  LgWebOsTv lgTv;

  PairedTv pairedTvs[MAX_PAIRED_TVS];
  uint8_t pairedCount;

  char currentPairingDiscoveryId[64];
  bool pairingInProgress;

  const DiscoveredTv* findDiscoveredTv(const char* discoveryId) const;
  bool connectToTv(const PairedTv* tv);
  bool rediscoverAndUpdateIp(PairedTv* tv);
};
