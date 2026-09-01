#pragma once

#include <Arduino.h>

// ─── TV Transport Protocol ───────────────────────────────────────────────────

enum class TvProtocol : uint8_t {
  WebOS,        // LG webOS
  Unknown = 0xFF
};

// ─── Discovered TV ───────────────────────────────────────────────────────────
// Represents a TV found via SSDP/discovery, before pairing

constexpr size_t MAX_DISCOVERED_TVS = 8;

struct DiscoveredTv {
  char id[64];              // Stable identifier (UDN/UUID/MAC)
  char name[64];            // Friendly name
  char brand[32];           // "LG", "Samsung", etc.
  char model[64];           // Model string if available
  char ip[16];              // IPv4 address
  char mac[18];             // MAC address (AA:BB:CC:DD:EE:FF) if available
  TvProtocol protocol;
  bool valid;
};

// ─── Paired TV Configuration ─────────────────────────────────────────────────
// Stored in NVS after successful pairing

constexpr size_t MAX_PAIRED_TVS = 4;

struct PairedTv {
  char id[40];              // Internal ID for app reference
  char discoveryId[64];     // Stable discovery ID (to re-identify after IP change)
  char name[64];
  char brand[32];
  char model[64];
  char ip[16];
  char mac[18];
  TvProtocol protocol;
  char clientKey[512];      // LG webOS client key or other auth token
  bool valid;
};
