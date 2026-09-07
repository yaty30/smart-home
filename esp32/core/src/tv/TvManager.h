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

  // Session management
  bool startTvSession(const char* tvId);
  void renewTvSession(const char* tvId);
  void stopTvSession();
  bool hasActiveSession() const;
  bool isSessionActiveForTv(const char* tvId) const;
  bool isSessionReadyForTv(const char* tvId) const;
  const char* getActiveSessionTvId() const { return activeTvId; }
  LgConnectionState getConnectionState() const { return lgTv.getConnectionState(); }
  unsigned long getSessionTimeRemaining() const;

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

  // Session management
  char activeTvId[40];
  unsigned long sessionLastRenewal;
  static constexpr unsigned long SESSION_TIMEOUT_MS = 60000;  // 60 seconds

  const DiscoveredTv* findDiscoveredTv(const char* discoveryId) const;
  bool ensureTvReady(const PairedTv* tv);
  bool sendCommandToLgTv(const char* command);
  bool rediscoverAndUpdateIp(PairedTv* tv);
};
