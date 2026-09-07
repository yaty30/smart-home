#include "TvManager.h"
#include "WakeOnLan.h"
#include <Arduino.h>
#include <Preferences.h>

TvManager::TvManager()
    : pairedCount(0),
      pairingInProgress(false) {
  for (uint8_t i = 0; i < MAX_PAIRED_TVS; i++) {
    pairedTvs[i].valid = false;
  }
  currentPairingDiscoveryId[0] = '\0';
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

    lgTv.startPairing(tv->ip);
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

  if (!lgTv.isPaired()) {
    Serial.println("[TvManager] LG TV not paired");
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

  strncpy(paired.mac, tv->mac, sizeof(paired.mac) - 1);
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

  // Handle power on via Wake-on-LAN
  if (strcmp(command, "power_on") == 0) {
    if (tv->mac[0] == '\0') {
      Serial.println("[TvManager] Cannot power on: no MAC address");
      return false;
    }

    bool sent = WakeOnLan::send(tv->mac);
    if (sent) {
      Serial.println("[TvManager] Wake-on-LAN packet sent");
      // Note: Cannot verify TV actually woke up from here
      // App should poll TV availability after sending power_on
    }
    return sent;
  }

  // All other commands require webOS connection
  // Ensure connection (will attempt IP recovery if needed)
  if (!connectToTv(tv)) {
    Serial.println("[TvManager] Cannot connect to TV");
    return false;
  }

  // Map command strings to LG webOS calls
  if (strcmp(command, "power_off") == 0) {
    return lgTv.sendPowerOff();
  } else if (strcmp(command, "volume_up") == 0) {
    return lgTv.sendVolumeUp();
  } else if (strcmp(command, "volume_down") == 0) {
    return lgTv.sendVolumeDown();
  } else if (strcmp(command, "mute") == 0) {
    return lgTv.sendMute();
  } else if (strcmp(command, "channel_up") == 0) {
    return lgTv.sendChannelUp();
  } else if (strcmp(command, "channel_down") == 0) {
    return lgTv.sendChannelDown();
  } else if (strcmp(command, "up") == 0) {
    return lgTv.sendUp();
  } else if (strcmp(command, "down") == 0) {
    return lgTv.sendDown();
  } else if (strcmp(command, "left") == 0) {
    return lgTv.sendLeft();
  } else if (strcmp(command, "right") == 0) {
    return lgTv.sendRight();
  } else if (strcmp(command, "ok") == 0 || strcmp(command, "enter") == 0) {
    return lgTv.sendOk();
  } else if (strcmp(command, "back") == 0) {
    return lgTv.sendBack();
  } else if (strcmp(command, "home") == 0) {
    return lgTv.sendHome();
  } else if (strcmp(command, "menu") == 0) {
    return lgTv.sendMenu();
  } else if (strcmp(command, "input") == 0) {
    return lgTv.sendInput();
  } else if (strcmp(command, "play") == 0) {
    return lgTv.sendPlay();
  } else if (strcmp(command, "pause") == 0) {
    return lgTv.sendPause();
  } else if (strcmp(command, "stop") == 0) {
    return lgTv.sendStop();
  }

  Serial.print("[TvManager] Unknown command: ");
  Serial.println(command);
  return false;
}

void TvManager::handle() {
  discovery.handle();
  lgTv.handle();
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

bool TvManager::connectToTv(const PairedTv* tv) {
  if (!tv) return false;

  // Try connecting with cached IP
  if (lgTv.connect(tv->ip, tv->clientKey)) {
    unsigned long start = millis();
    while (!lgTv.isPaired() && (millis() - start < 5000)) {
      lgTv.handle();
      delay(10);
    }

    if (lgTv.isPaired()) {
      return true;
    }
  }

  // Connection failed - attempt IP recovery
  Serial.println("[TvManager] Connection failed, attempting IP recovery");

  // Find mutable TV entry
  PairedTv* mutableTv = nullptr;
  for (uint8_t i = 0; i < pairedCount; i++) {
    if (strcmp(pairedTvs[i].id, tv->id) == 0) {
      mutableTv = &pairedTvs[i];
      break;
    }
  }

  if (!mutableTv) {
    Serial.println("[TvManager] TV entry not found for update");
    return false;
  }

  // Attempt rediscovery
  if (rediscoverAndUpdateIp(mutableTv)) {
    // Try connecting with new IP
    if (!lgTv.connect(mutableTv->ip, mutableTv->clientKey)) {
      return false;
    }

    unsigned long start = millis();
    while (!lgTv.isPaired() && (millis() - start < 5000)) {
      lgTv.handle();
      delay(10);
    }

    return lgTv.isPaired();
  }

  return false;
}

bool TvManager::rediscoverAndUpdateIp(PairedTv* tv) {
  if (!tv) return false;

  Serial.println("[TvManager] Starting targeted rediscovery");

  // Perform a quick discovery scan
  discovery.clear();
  discovery.startScan(3000);  // 3 second timeout for quick recovery

  // Wait for scan to complete
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
      // Found it! Update IP
      Serial.print("[TvManager] TV rediscovered at new IP: ");
      Serial.println(discovered[i].ip);

      strncpy(tv->ip, discovered[i].ip, sizeof(tv->ip) - 1);
      tv->ip[sizeof(tv->ip) - 1] = '\0';

      // Persist updated IP
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
