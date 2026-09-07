#include "TvManager.h"
#include "WakeOnLan.h"
#include <Arduino.h>
#include <Preferences.h>

TvManager::TvManager()
    : pairedCount(0),
      pairingInProgress(false),
      sessionLastRenewal(0) {
  for (uint8_t i = 0; i < MAX_PAIRED_TVS; i++) {
    pairedTvs[i].valid = false;
  }
  currentPairingDiscoveryId[0] = '\0';
  activeTvId[0] = '\0';
}

TvManager::~TvManager() {
}

void TvManager::startDiscovery() {
  discovery.startScan();
  Serial.println("[TvManager] Started TV discovery");
}

bool TvManager::isDiscovering() const {
  return discovery.isScanning();
}

uint8_t TvManager::getDiscoveredCount() const {
  return discovery.getDiscoveredCount();
}

const DiscoveredTv* TvManager::getDiscovered() const {
  return discovery.getDiscovered();
}

const DiscoveredTv* TvManager::findDiscoveredTv(const char* discoveryId) const {
  const DiscoveredTv* discovered = discovery.getDiscovered();
  uint8_t count = discovery.getDiscoveredCount();

  for (uint8_t i = 0; i < count; i++) {
    if (strcmp(discovered[i].id, discoveryId) == 0) {
      return &discovered[i];
    }
  }

  return nullptr;
}

bool TvManager::startPairing(const char* discoveryId) {
  if (pairingInProgress) {
    Serial.println("[TvManager] Pairing already in progress");
    return false;
  }

  if (isTvPaired(discoveryId)) {
    Serial.println("[TvManager] TV already paired");
    return false;
  }

  const DiscoveredTv* tv = findDiscoveredTv(discoveryId);
  if (!tv) {
    Serial.println("[TvManager] Discovery ID not found");
    return false;
  }

  if (tv->protocol == TvProtocol::WebOS) {
    strncpy(currentPairingDiscoveryId, discoveryId, sizeof(currentPairingDiscoveryId) - 1);
    currentPairingDiscoveryId[sizeof(currentPairingDiscoveryId) - 1] = '\0';
    pairingInProgress = true;

    lgTv.startPairing(tv->ip, tv->mac[0] != '\0' ? tv->mac : nullptr);
    Serial.print("[TvManager] Started pairing with ");
    Serial.println(tv->name);
    return true;
  }

  Serial.println("[TvManager] Unsupported TV protocol");
  return false;
}

LgPairingState TvManager::getPairingState() const {
  if (!pairingInProgress) {
    return LgPairingState::Idle;
  }
  return lgTv.getPairingState();
}

const char* TvManager::getPairingClientKey() const {
  return lgTv.getClientKey();
}

bool TvManager::submitPairingPin(const char* pin) {
  if (!pairingInProgress) {
    Serial.println("[TvManager] No pairing in progress for PIN");
    return false;
  }

  return lgTv.submitPin(pin);
}

bool TvManager::completePairing(const char* tvName) {
  if (!pairingInProgress) {
    Serial.println("[TvManager] No pairing in progress");
    return false;
  }

  if (lgTv.getPairingState() != LgPairingState::Paired) {
    Serial.println("[TvManager] LG TV not paired yet");
    return false;
  }

  const DiscoveredTv* tv = findDiscoveredTv(currentPairingDiscoveryId);
  if (!tv) {
    Serial.println("[TvManager] Discovery data lost");
    pairingInProgress = false;
    return false;
  }

  if (pairedCount >= MAX_PAIRED_TVS) {
    Serial.println("[TvManager] Max paired TV limit reached");
    pairingInProgress = false;
    return false;
  }

  // Create paired TV record
  PairedTv& paired = pairedTvs[pairedCount];
  paired.valid = true;

  // Generate unique internal ID
  snprintf(paired.id, sizeof(paired.id), "tv-%lu", millis());

  strncpy(paired.discoveryId, tv->id, sizeof(paired.discoveryId) - 1);
  paired.discoveryId[sizeof(paired.discoveryId) - 1] = '\0';

  strncpy(paired.name, tvName, sizeof(paired.name) - 1);
  paired.name[sizeof(paired.name) - 1] = '\0';

  strncpy(paired.brand, tv->brand, sizeof(paired.brand) - 1);
  paired.brand[sizeof(paired.brand) - 1] = '\0';

  strncpy(paired.model, tv->model, sizeof(paired.model) - 1);
  paired.model[sizeof(paired.model) - 1] = '\0';

  strncpy(paired.ip, tv->ip, sizeof(paired.ip) - 1);
  paired.ip[sizeof(paired.ip) - 1] = '\0';

  // Use MAC from LgWebOsTv if available (it may have obtained it during pairing)
  const char* obtainedMac = lgTv.getMacAddress();
  if (obtainedMac && obtainedMac[0] != '\0') {
    strncpy(paired.mac, obtainedMac, sizeof(paired.mac) - 1);
  } else if (tv->mac[0] != '\0') {
    strncpy(paired.mac, tv->mac, sizeof(paired.mac) - 1);
  } else {
    paired.mac[0] = '\0';
  }
  paired.mac[sizeof(paired.mac) - 1] = '\0';

  paired.protocol = tv->protocol;

  strncpy(paired.clientKey, lgTv.getClientKey(), sizeof(paired.clientKey) - 1);
  paired.clientKey[sizeof(paired.clientKey) - 1] = '\0';

  pairedCount++;
  pairingInProgress = false;
  currentPairingDiscoveryId[0] = '\0';

  savePairedTvs();

  Serial.print("[TvManager] Paired TV ");
  Serial.print(paired.name);
  Serial.print(" (");
  Serial.print(paired.id);
  if (paired.mac[0] != '\0') {
    Serial.print(", MAC: ");
    Serial.print(paired.mac);
  }
  Serial.println(")");

  return true;
}

const PairedTv* TvManager::getPairedTv(const char* id) const {
  for (uint8_t i = 0; i < pairedCount; i++) {
    if (strcmp(pairedTvs[i].id, id) == 0 ||
        strcmp(pairedTvs[i].discoveryId, id) == 0) {
      return &pairedTvs[i];
    }
  }
  return nullptr;
}

const PairedTv* TvManager::getPairedTvByIndex(uint8_t index) const {
  if (index >= pairedCount) {
    return nullptr;
  }
  return &pairedTvs[index];
}

bool TvManager::isTvPaired(const char* id) const {
  return getPairedTv(id) != nullptr;
}

bool TvManager::unpairTv(const char* id) {
  for (uint8_t i = 0; i < pairedCount; i++) {
    if (strcmp(pairedTvs[i].id, id) != 0 &&
        strcmp(pairedTvs[i].discoveryId, id) != 0) {
      continue;
    }

    Serial.print("[TvManager] Unpairing TV ");
    Serial.print(pairedTvs[i].name);
    Serial.print(" (");
    Serial.print(pairedTvs[i].id);
    Serial.println(")");

    // Stop session if this is the active TV
    if (strcmp(activeTvId, pairedTvs[i].id) == 0) {
      stopTvSession();
    }

    for (uint8_t j = i; j + 1 < pairedCount; j++) {
      pairedTvs[j] = pairedTvs[j + 1];
    }

    pairedCount--;
    pairedTvs[pairedCount].valid = false;
    pairedTvs[pairedCount].id[0] = '\0';
    pairedTvs[pairedCount].discoveryId[0] = '\0';
    savePairedTvs();
    return true;
  }

  Serial.println("[TvManager] TV not found for unpair");
  return false;
}

bool TvManager::startTvSession(const char* tvId) {
  const PairedTv* tv = getPairedTv(tvId);
  if (!tv) {
    Serial.println("[TvManager] TV not found for session start");
    return false;
  }

  if (tv->protocol != TvProtocol::WebOS) {
    Serial.println("[TvManager] Unsupported protocol for session");
    return false;
  }

  // If already active for this TV, just renew
  if (strcmp(activeTvId, tv->id) == 0 && lgTv.isReady()) {
    renewTvSession(tvId);
    return true;
  }

  // Stop any existing session
  if (activeTvId[0] != '\0') {
    stopTvSession();
  }

  Serial.print("[TvManager] Starting session for TV ");
  Serial.println(tv->name);

  strncpy(activeTvId, tv->id, sizeof(activeTvId) - 1);
  activeTvId[sizeof(activeTvId) - 1] = '\0';
  sessionLastRenewal = millis();

  lgTv.startSession(tv->ip, tv->clientKey, tv->mac[0] != '\0' ? tv->mac : nullptr);

  return true;
}

void TvManager::renewTvSession(const char* tvId) {
  if (strcmp(activeTvId, tvId) != 0) {
    Serial.println("[TvManager] Cannot renew: not the active TV");
    return;
  }

  sessionLastRenewal = millis();
  Serial.println("[TvManager] Session renewed");
}

void TvManager::stopTvSession() {
  if (activeTvId[0] == '\0') {
    return;
  }

  Serial.print("[TvManager] Stopping session for TV ");
  Serial.println(activeTvId);

  lgTv.stopSession();
  activeTvId[0] = '\0';
  sessionLastRenewal = 0;
}

bool TvManager::hasActiveSession() const {
  return activeTvId[0] != '\0';
}

bool TvManager::isSessionActiveForTv(const char* tvId) const {
  const PairedTv* tv = getPairedTv(tvId);
  return tv && strcmp(activeTvId, tv->id) == 0;
}

bool TvManager::isSessionReadyForTv(const char* tvId) const {
  return isSessionActiveForTv(tvId) && lgTv.isReady();
}

unsigned long TvManager::getSessionTimeRemaining() const {
  if (!hasActiveSession()) {
    return 0;
  }

  unsigned long elapsed = millis() - sessionLastRenewal;
  if (elapsed >= SESSION_TIMEOUT_MS) {
    return 0;
  }

  return SESSION_TIMEOUT_MS - elapsed;
}

bool TvManager::sendTvCommand(const char* tvId, const char* command) {
  const PairedTv* tv = getPairedTv(tvId);
  if (!tv) {
    Serial.println("[TvManager] TV not found");
    return false;
  }

  if (tv->protocol != TvProtocol::WebOS) {
    Serial.println("[TvManager] Unsupported protocol");
    return false;
  }

  // Handle power_on via Wake-on-LAN
  if (strcmp(command, "power_on") == 0) {
    if (tv->mac[0] == '\0') {
      Serial.println("[TvManager] Cannot power on: no MAC address stored");
      return false;
    }

    if (strcmp(activeTvId, tv->id) != 0) {
      if (activeTvId[0] != '\0') {
        stopTvSession();
      }

      strncpy(activeTvId, tv->id, sizeof(activeTvId) - 1);
      activeTvId[sizeof(activeTvId) - 1] = '\0';
      lgTv.startSession(tv->ip, tv->clientKey, tv->mac);
    }
    sessionLastRenewal = millis();

    bool sent = WakeOnLan::send(tv->mac);
    if (sent) {
      Serial.println("[TvManager] Wake-on-LAN packet sent");
      lgTv.startWakeSequence();
    } else {
      Serial.println("[TvManager] Failed to send Wake-on-LAN packet");
    }
    return sent;
  }

  // Ensure session is active for this TV
  if (strcmp(activeTvId, tv->id) != 0) {
    Serial.println("[TvManager] No active session for this TV");
    return false;
  }

  // All other commands require Ready state
  if (!lgTv.isReady()) {
    Serial.println("[TvManager] TV not ready for commands");
    return false;
  }

  // Renew session on command
  sessionLastRenewal = millis();

  return sendCommandToLgTv(command);
}

bool TvManager::sendCommandToLgTv(const char* command) {
  bool result = false;

  if (strcmp(command, "power_off") == 0) {
    result = lgTv.sendPowerOff();
  } else if (strcmp(command, "volume_up") == 0) {
    result = lgTv.sendVolumeUp();
  } else if (strcmp(command, "volume_down") == 0) {
    result = lgTv.sendVolumeDown();
  } else if (strcmp(command, "mute") == 0) {
    result = lgTv.sendMute();
  } else if (strcmp(command, "channel_up") == 0) {
    result = lgTv.sendChannelUp();
  } else if (strcmp(command, "channel_down") == 0) {
    result = lgTv.sendChannelDown();
  } else if (strcmp(command, "up") == 0) {
    result = lgTv.sendUp();
  } else if (strcmp(command, "down") == 0) {
    result = lgTv.sendDown();
  } else if (strcmp(command, "left") == 0) {
    result = lgTv.sendLeft();
  } else if (strcmp(command, "right") == 0) {
    result = lgTv.sendRight();
  } else if (strcmp(command, "ok") == 0 || strcmp(command, "enter") == 0) {
    result = lgTv.sendOk();
  } else if (strcmp(command, "back") == 0 || strcmp(command, "exit") == 0) {
    result = lgTv.sendBack();
  } else if (strcmp(command, "home") == 0) {
    result = lgTv.sendHome();
  } else if (strcmp(command, "apps") == 0) {
    result = lgTv.sendHome();
  } else if (strcmp(command, "menu") == 0) {
    result = lgTv.sendMenu();
  } else if (strcmp(command, "input") == 0) {
    result = lgTv.sendInput();
  } else if (strcmp(command, "play") == 0) {
    result = lgTv.sendPlay();
  } else if (strcmp(command, "pause") == 0) {
    result = lgTv.sendPause();
  } else if (strcmp(command, "stop") == 0) {
    result = lgTv.sendStop();
  } else if (strcmp(command, "rewind") == 0 || strcmp(command, "previous") == 0) {
    result = lgTv.sendRewind();
  } else if (strcmp(command, "fast_forward") == 0 || strcmp(command, "next") == 0) {
    result = lgTv.sendFastForward();
  } else {
    Serial.print("[TvManager] Unknown command: ");
    Serial.println(command);
    return false;
  }

  if (!result) {
    Serial.print("[TvManager] Command failed: ");
    Serial.println(command);
  }

  return result;
}

void TvManager::handle() {
  discovery.handle();
  lgTv.handle();

  // Check session timeout
  if (hasActiveSession() && getSessionTimeRemaining() == 0) {
    Serial.println("[TvManager] Session expired due to inactivity");
    stopTvSession();
  }
}

void TvManager::loadPairedTvs() {
  Preferences prefs;
  if (!prefs.begin("smart-home", true)) {
    Serial.println("[TvManager] Cannot open preferences for reading");
    return;
  }

  uint8_t count = prefs.getUChar("tv_count", 0);
  pairedCount = 0;

  for (uint8_t i = 0; i < count && i < MAX_PAIRED_TVS; i++) {
    String prefix = "tv" + String(i) + "_";

    if (!prefs.getBool((prefix + "valid").c_str(), false)) {
      continue;
    }

    PairedTv& tv = pairedTvs[pairedCount];
    tv.valid = true;

    String id = prefs.getString((prefix + "id").c_str(), "");
    strncpy(tv.id, id.c_str(), sizeof(tv.id) - 1);
    tv.id[sizeof(tv.id) - 1] = '\0';

    String discoveryId = prefs.getString((prefix + "disc_id").c_str(), "");
    strncpy(tv.discoveryId, discoveryId.c_str(), sizeof(tv.discoveryId) - 1);
    tv.discoveryId[sizeof(tv.discoveryId) - 1] = '\0';

    String name = prefs.getString((prefix + "name").c_str(), "");
    strncpy(tv.name, name.c_str(), sizeof(tv.name) - 1);
    tv.name[sizeof(tv.name) - 1] = '\0';

    String brand = prefs.getString((prefix + "brand").c_str(), "");
    strncpy(tv.brand, brand.c_str(), sizeof(tv.brand) - 1);
    tv.brand[sizeof(tv.brand) - 1] = '\0';

    String model = prefs.getString((prefix + "model").c_str(), "");
    strncpy(tv.model, model.c_str(), sizeof(tv.model) - 1);
    tv.model[sizeof(tv.model) - 1] = '\0';

    String ip = prefs.getString((prefix + "ip").c_str(), "");
    strncpy(tv.ip, ip.c_str(), sizeof(tv.ip) - 1);
    tv.ip[sizeof(tv.ip) - 1] = '\0';

    String mac = prefs.getString((prefix + "mac").c_str(), "");
    strncpy(tv.mac, mac.c_str(), sizeof(tv.mac) - 1);
    tv.mac[sizeof(tv.mac) - 1] = '\0';

    tv.protocol = static_cast<TvProtocol>(prefs.getUChar((prefix + "proto").c_str(), 0xFF));

    String clientKey = prefs.getString((prefix + "key").c_str(), "");
    strncpy(tv.clientKey, clientKey.c_str(), sizeof(tv.clientKey) - 1);
    tv.clientKey[sizeof(tv.clientKey) - 1] = '\0';

    pairedCount++;
  }

  prefs.end();

  Serial.print("[TvManager] Loaded ");
  Serial.print(pairedCount);
  Serial.println(" paired TV(s)");
}

void TvManager::savePairedTvs() {
  Preferences prefs;
  if (!prefs.begin("smart-home", false)) {
    Serial.println("[TvManager] Cannot open preferences for writing");
    return;
  }

  prefs.putUChar("tv_count", pairedCount);

  for (uint8_t i = 0; i < pairedCount; i++) {
    const PairedTv& tv = pairedTvs[i];
    String prefix = "tv" + String(i) + "_";

    prefs.putBool((prefix + "valid").c_str(), tv.valid);
    prefs.putString((prefix + "id").c_str(), tv.id);
    prefs.putString((prefix + "disc_id").c_str(), tv.discoveryId);
    prefs.putString((prefix + "name").c_str(), tv.name);
    prefs.putString((prefix + "brand").c_str(), tv.brand);
    prefs.putString((prefix + "model").c_str(), tv.model);
    prefs.putString((prefix + "ip").c_str(), tv.ip);
    prefs.putString((prefix + "mac").c_str(), tv.mac);
    prefs.putUChar((prefix + "proto").c_str(), static_cast<uint8_t>(tv.protocol));
    prefs.putString((prefix + "key").c_str(), tv.clientKey);
  }

  prefs.end();

  Serial.println("[TvManager] Saved paired TVs");
}

bool TvManager::rediscoverAndUpdateIp(PairedTv* tv) {
  if (!tv) return false;

  Serial.println("[TvManager] Starting targeted rediscovery");

  // Perform a quick discovery scan (non-blocking setup)
  discovery.clear();
  discovery.startScan(3000);  // 3 second timeout

  // Note: This is still blocking but much shorter than before
  // A future improvement would be to make this fully async
  unsigned long startTime = millis();
  while (discovery.isScanning() && (millis() - startTime < 4000)) {
    discovery.handle();
    delay(100);
  }

  // Look for our TV using stable identifier
  const DiscoveredTv* discovered = discovery.getDiscovered();
  uint8_t count = discovery.getDiscoveredCount();

  for (uint8_t i = 0; i < count; i++) {
    // Match by discovery ID (UUID/UDN)
    if (strcmp(discovered[i].id, tv->discoveryId) == 0) {
      Serial.print("[TvManager] TV rediscovered at new IP: ");
      Serial.println(discovered[i].ip);

      strncpy(tv->ip, discovered[i].ip, sizeof(tv->ip) - 1);
      tv->ip[sizeof(tv->ip) - 1] = '\0';

      savePairedTvs();
      return true;
    }

    // Fallback: match by MAC if available
    if (tv->mac[0] != '\0' && discovered[i].mac[0] != '\0') {
      if (strcmp(discovered[i].mac, tv->mac) == 0) {
        Serial.print("[TvManager] TV rediscovered by MAC at: ");
        Serial.println(discovered[i].ip);

        strncpy(tv->ip, discovered[i].ip, sizeof(tv->ip) - 1);
        tv->ip[sizeof(tv->ip) - 1] = '\0';

        savePairedTvs();
        return true;
      }
    }
  }

  Serial.println("[TvManager] TV not found during rediscovery");
  return false;
}
