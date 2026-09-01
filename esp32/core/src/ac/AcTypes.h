#pragma once

#include <stdint.h>

// ─── Brand ───────────────────────────────────────────────────────────────────

enum class AcBrand : uint8_t {
  Panasonic,
  Daikin,
  MitsubishiElectric,
  MitsubishiHeavy,
  Hitachi,
  Gree,
  Midea,
  Samsung,
  LG,
  Toshiba,
  Unknown = 0xFF,
};

// ─── Brand-neutral mode values (stored in NVS v2+) ───────────────────────────

constexpr uint8_t AC_MODE_AUTO = 0;
constexpr uint8_t AC_MODE_COOL = 1;
constexpr uint8_t AC_MODE_HEAT = 2;
constexpr uint8_t AC_MODE_DRY  = 3;
constexpr uint8_t AC_MODE_FAN  = 4;

// ─── Brand-neutral fan values ─────────────────────────────────────────────────
// 0 = auto; 1–5 = discrete speeds (driver maps to protocol-specific values).

constexpr uint8_t AC_FAN_AUTO = 0;
constexpr uint8_t AC_FAN_1    = 1;
constexpr uint8_t AC_FAN_2    = 2;
constexpr uint8_t AC_FAN_3    = 3;
constexpr uint8_t AC_FAN_4    = 4;
constexpr uint8_t AC_FAN_5    = 5;

// ─── Brand-neutral vertical swing values ─────────────────────────────────────

constexpr uint8_t AC_SWING_V_AUTO    = 0;
constexpr uint8_t AC_SWING_V_HIGHEST = 1;
constexpr uint8_t AC_SWING_V_HIGH    = 2;
constexpr uint8_t AC_SWING_V_MIDDLE  = 3;
constexpr uint8_t AC_SWING_V_LOW     = 4;
constexpr uint8_t AC_SWING_V_LOWEST  = 5;

// ─── Brand-neutral horizontal swing values ────────────────────────────────────

constexpr uint8_t AC_SWING_H_AUTO       = 0;
constexpr uint8_t AC_SWING_H_FULL_LEFT  = 1;
constexpr uint8_t AC_SWING_H_LEFT       = 2;
constexpr uint8_t AC_SWING_H_MIDDLE     = 3;
constexpr uint8_t AC_SWING_H_RIGHT      = 4;
constexpr uint8_t AC_SWING_H_FULL_RIGHT = 5;

// ─── Feature capability flags ─────────────────────────────────────────────────

enum class AcFeature : uint8_t {
  Temperature,
  Mode,
  Fan,
  SwingVertical,
  SwingHorizontal,
  Quiet,
  Powerful,
  Econo,
  Sleep,
  Light,
  Clean,
  Filter,
};

// ─── Device identity ─────────────────────────────────────────────────────────
// Stored in NVS; allows per-device protocol/model selection.

struct AcDeviceConfig {
  AcBrand brand;
  char    protocol[24];  // e.g. "panasonic_ac", "daikin216"
  char    model[16];     // e.g. "dke", "jke", "" for no model variant
};
