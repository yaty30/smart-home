#include "StorageManager.h"

#include <Preferences.h>

namespace {
constexpr const char* STORAGE_NAMESPACE = "smart-home";

// Version history:
//   1 — original; mode/fan/swing use kPanasonicAc* constants
//   2 — brand-neutral AC_MODE_*/AC_FAN_*/AC_SWING_* constants;
//       adds brand/protocol/model keys for AcDeviceConfig
constexpr uint8_t STORAGE_VERSION = 2;

Preferences preferences;
bool storageReady = false;

// ─── v1 → v2 mode migration ──────────────────────────────────────────────────
// In v1 the mode byte held raw kPanasonicAc* values.  Map them to the new
// brand-neutral AC_MODE_* values so existing installations keep working.
constexpr uint8_t kV1PanasonicAcAuto = 0;
constexpr uint8_t kV1PanasonicAcCool = 4;
constexpr uint8_t kV1PanasonicAcHeat = 8;
constexpr uint8_t kV1PanasonicAcDry  = 12;
constexpr uint8_t kV1PanasonicAcFan  = 6;

uint8_t migrateV1Mode(uint8_t v1) {
  switch (v1) {
    case kV1PanasonicAcAuto: return AC_MODE_AUTO;
    case kV1PanasonicAcCool: return AC_MODE_COOL;
    case kV1PanasonicAcHeat: return AC_MODE_HEAT;
    case kV1PanasonicAcDry:  return AC_MODE_DRY;
    case kV1PanasonicAcFan:  return AC_MODE_FAN;
    default:                 return AC_MODE_COOL;  // safe default
  }
}

// In v1, fan was stored as raw kPanasonicAcFanAuto (0xA) for auto, or 0–4
// for discrete speeds (displayed as 1–5, stored as displayedSpeed - 1).
// Map to new brand-neutral AC_FAN_AUTO / AC_FAN_1..AC_FAN_5 (0, 1..5).
constexpr uint8_t kV1PanasonicAcFanAuto = 0xA;

uint8_t migrateV1Fan(uint8_t v1) {
  if (v1 == kV1PanasonicAcFanAuto) return AC_FAN_AUTO;
  // Discrete 0–4 → AC_FAN_1–AC_FAN_5 (1–5).
  uint8_t discrete = static_cast<uint8_t>(v1 + 1);
  if (discrete >= AC_FAN_1 && discrete <= AC_FAN_5) return discrete;
  return AC_FAN_AUTO;
}

// In v1, swingV kPanasonicAcSwingVAuto=15, positions 1–5 were literal 1–5.
constexpr uint8_t kV1PanasonicAcSwingVAuto = 15;
uint8_t migrateV1SwingV(uint8_t v1) {
  if (v1 == kV1PanasonicAcSwingVAuto) return AC_SWING_V_AUTO;
  if (v1 >= 1 && v1 <= 5) return v1;
  return AC_SWING_V_AUTO;
}

// In v1, swingH kPanasonicAcSwingHAuto=13; named positions had distinct values.
constexpr uint8_t kV1PanasonicAcSwingHAuto      = 13;
constexpr uint8_t kV1PanasonicAcSwingHFullLeft  = 9;
constexpr uint8_t kV1PanasonicAcSwingHLeft      = 10;
constexpr uint8_t kV1PanasonicAcSwingHMiddle    = 6;
constexpr uint8_t kV1PanasonicAcSwingHRight     = 11;
constexpr uint8_t kV1PanasonicAcSwingHFullRight = 12;

uint8_t migrateV1SwingH(uint8_t v1) {
  switch (v1) {
    case kV1PanasonicAcSwingHAuto:      return AC_SWING_H_AUTO;
    case kV1PanasonicAcSwingHFullLeft:  return AC_SWING_H_FULL_LEFT;
    case kV1PanasonicAcSwingHLeft:      return AC_SWING_H_LEFT;
    case kV1PanasonicAcSwingHMiddle:    return AC_SWING_H_MIDDLE;
    case kV1PanasonicAcSwingHRight:     return AC_SWING_H_RIGHT;
    case kV1PanasonicAcSwingHFullRight: return AC_SWING_H_FULL_RIGHT;
    default:                            return AC_SWING_H_AUTO;
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

bool isValidACState(const AcState& state) {
  int temperature;
  return parseTemperatureValue(state.temperature, temperature) &&
         modeString(state.mode) != "unknown" &&
         fanString(state.fan) != "unknown" &&
         swingVerticalString(state.swingVertical) != "unknown" &&
         swingHorizontalString(state.swingHorizontal) != "unknown" &&
         !(state.quiet && state.powerful);
}

uint8_t inferScheduleTypeFromTimes(const char* startTime, const char* endTime) {
  if (startTime[0] != '\0' && endTime[0] == '\0') return ScheduleTypeAutoOn;
  if (startTime[0] == '\0' && endTime[0] != '\0') return ScheduleTypeAutoOff;
  return ScheduleTypeScheduleTime;
}

uint8_t daysToMask(const bool days[7]) {
  uint8_t mask = 0;
  for (uint8_t i = 0; i < 7; i++) {
    if (days[i]) mask |= (1 << i);
  }
  return mask;
}

void maskToDays(uint8_t mask, bool days[7]) {
  for (uint8_t i = 0; i < 7; i++) {
    days[i] = (mask & (1 << i)) != 0;
  }
}

}  // namespace

void initStorageManager() {
  storageReady = preferences.begin(STORAGE_NAMESPACE, false);
  if (!storageReady) {
    Serial.println("Preferences storage could not be opened");
  }
}

bool loadStoredState(AcState& storedAcState, bool& storedPaired) {
  if (!storageReady) return false;

  uint8_t version = preferences.getUChar("version", 0);
  if (version == 0) return false;

  if (version == 1) {
    // v1: mode/fan/swing held raw Panasonic IR constants; migrate to neutral.
    AcState candidate = {
      preferences.getBool("ac_power", storedAcState.power),
      preferences.getInt("ac_temp", storedAcState.temperature),
      migrateV1Mode(preferences.getUChar("ac_mode", kV1PanasonicAcCool)),
      migrateV1Fan(preferences.getUChar("ac_fan", 0)),
      migrateV1SwingV(preferences.getUChar("ac_swing_v", kV1PanasonicAcSwingVAuto)),
      migrateV1SwingH(preferences.getUChar("ac_swing_h", kV1PanasonicAcSwingHAuto)),
      preferences.getBool("ac_quiet", storedAcState.quiet),
      preferences.getBool("ac_powerful", storedAcState.powerful)
    };
    if (!isValidACState(candidate)) {
      Serial.println("Stored v1 AC state is invalid; using defaults");
      return false;
    }
    storedAcState = candidate;
    storedPaired = preferences.getBool("paired", storedPaired);
    Serial.println("[Storage] Migrated AC state from v1 to v2");
    return true;
  }

  // v2+: values are already brand-neutral.
  AcState candidate = {
    preferences.getBool("ac_power", storedAcState.power),
    preferences.getInt("ac_temp", storedAcState.temperature),
    preferences.getUChar("ac_mode", storedAcState.mode),
    preferences.getUChar("ac_fan", storedAcState.fan),
    preferences.getUChar("ac_swing_v", storedAcState.swingVertical),
    preferences.getUChar("ac_swing_h", storedAcState.swingHorizontal),
    preferences.getBool("ac_quiet", storedAcState.quiet),
    preferences.getBool("ac_powerful", storedAcState.powerful)
  };

  if (!isValidACState(candidate)) {
    Serial.println("Stored AC state is invalid; using defaults");
    return false;
  }

  storedAcState = candidate;
  storedPaired = preferences.getBool("paired", storedPaired);
  return true;
}

void saveACState(const AcState& state) {
  if (!storageReady) return;
  preferences.putUChar("version", STORAGE_VERSION);
  preferences.putBool("ac_power", state.power);
  preferences.putInt("ac_temp", state.temperature);
  preferences.putUChar("ac_mode", state.mode);
  preferences.putUChar("ac_fan", state.fan);
  preferences.putUChar("ac_swing_v", state.swingVertical);
  preferences.putUChar("ac_swing_h", state.swingHorizontal);
  preferences.putBool("ac_quiet", state.quiet);
  preferences.putBool("ac_powerful", state.powerful);
}

bool loadACDeviceConfig(AcDeviceConfig& config) {
  if (!storageReady) return false;
  if (!preferences.isKey("ac_brand")) return false;

  config.brand = static_cast<AcBrand>(
      preferences.getUChar("ac_brand", static_cast<uint8_t>(AcBrand::Panasonic)));

  String proto = preferences.getString("ac_protocol", "panasonic_ac");
  strncpy(config.protocol, proto.c_str(), sizeof(config.protocol) - 1);
  config.protocol[sizeof(config.protocol) - 1] = '\0';

  String model = preferences.getString("ac_model", "dke");
  strncpy(config.model, model.c_str(), sizeof(config.model) - 1);
  config.model[sizeof(config.model) - 1] = '\0';

  return true;
}

void saveACDeviceConfig(const AcDeviceConfig& config) {
  if (!storageReady) return;
  preferences.putUChar("version", STORAGE_VERSION);
  preferences.putUChar("ac_brand", static_cast<uint8_t>(config.brand));
  preferences.putString("ac_protocol", config.protocol);
  preferences.putString("ac_model", config.model);
}

void savePairingState(bool paired) {
  if (!storageReady) return;
  preferences.putUChar("version", STORAGE_VERSION);
  preferences.putBool("paired", paired);
}

String scheduleKey(uint8_t index, const char* field) {
  return "sc" + String(index) + "_" + String(field);
}

void saveScheduleAt(uint8_t index, const AcSchedule& schedule) {
  preferences.putBool(scheduleKey(index, "valid").c_str(), schedule.valid);
  preferences.putString(scheduleKey(index, "id").c_str(), schedule.id);
  preferences.putBool(scheduleKey(index, "enabled").c_str(), schedule.enabled);
  preferences.putUChar(scheduleKey(index, "type").c_str(), schedule.type);
  preferences.putString(scheduleKey(index, "start").c_str(), schedule.startTime);
  preferences.putString(scheduleKey(index, "end").c_str(), schedule.endTime);
  preferences.putUChar(scheduleKey(index, "days").c_str(), daysToMask(schedule.days));
  preferences.putBool(scheduleKey(index, "repeat").c_str(), schedule.repeatEnabled);
  preferences.putString(scheduleKey(index, "repeat_f").c_str(), schedule.repeatFrequency);
  preferences.putUChar(scheduleKey(index, "mode").c_str(), schedule.mode);
  preferences.putInt(scheduleKey(index, "temp").c_str(), schedule.temperature);
  preferences.putUChar(scheduleKey(index, "fan").c_str(), schedule.fan);
  preferences.putBool(scheduleKey(index, "quiet").c_str(), schedule.quiet);
  preferences.putBool(scheduleKey(index, "powerful").c_str(), schedule.powerful);
  preferences.putUChar(scheduleKey(index, "swing_v").c_str(), schedule.swingVertical);
  preferences.putUChar(scheduleKey(index, "swing_h").c_str(), schedule.swingHorizontal);
}

void loadScheduleAt(uint8_t index, AcSchedule& schedule) {
  schedule.valid = preferences.getBool(scheduleKey(index, "valid").c_str(), true);

  String id = preferences.getString(scheduleKey(index, "id").c_str(),
                                    "schedule-" + String(index + 1));
  strncpy(schedule.id, id.c_str(), sizeof(schedule.id) - 1);
  schedule.id[sizeof(schedule.id) - 1] = '\0';

  schedule.enabled = preferences.getBool(scheduleKey(index, "enabled").c_str(), false);
  String start = preferences.getString(scheduleKey(index, "start").c_str(), "22:30");
  String end   = preferences.getString(scheduleKey(index, "end").c_str(), "");
  strncpy(schedule.startTime, start.c_str(), 5);
  schedule.startTime[5] = '\0';
  strncpy(schedule.endTime, end.c_str(), 5);
  schedule.endTime[5] = '\0';
  schedule.type = preferences.getUChar(
      scheduleKey(index, "type").c_str(),
      inferScheduleTypeFromTimes(schedule.startTime, schedule.endTime));

  maskToDays(preferences.getUChar(scheduleKey(index, "days").c_str(), 0x7F),
             schedule.days);
  schedule.repeatEnabled = preferences.getBool(
      scheduleKey(index, "repeat").c_str(), false);
  String repeatFrequency = preferences.getString(
      scheduleKey(index, "repeat_f").c_str(), "one-time");
  strncpy(schedule.repeatFrequency, repeatFrequency.c_str(), 11);
  schedule.repeatFrequency[11] = '\0';

  // Schedules store brand-neutral mode/fan/swing from v2 onwards.
  // Legacy v1 schedules stored Panasonic raw values; migrate them here.
  uint8_t storedMode = preferences.getUChar(scheduleKey(index, "mode").c_str(),
                                             AC_MODE_COOL);
  uint8_t storedFan  = preferences.getUChar(scheduleKey(index, "fan").c_str(),
                                             AC_FAN_AUTO);
  uint8_t storedSwV  = preferences.getUChar(scheduleKey(index, "swing_v").c_str(),
                                             AC_SWING_V_AUTO);
  uint8_t storedSwH  = preferences.getUChar(scheduleKey(index, "swing_h").c_str(),
                                             AC_SWING_H_AUTO);

  uint8_t version = preferences.getUChar("version", 0);
  if (version == 1) {
    schedule.mode          = migrateV1Mode(storedMode);
    schedule.fan           = migrateV1Fan(storedFan);
    schedule.swingVertical = migrateV1SwingV(storedSwV);
    schedule.swingHorizontal = migrateV1SwingH(storedSwH);
  } else {
    schedule.mode          = storedMode;
    schedule.fan           = storedFan;
    schedule.swingVertical = storedSwV;
    schedule.swingHorizontal = storedSwH;
  }

  schedule.temperature = preferences.getInt(scheduleKey(index, "temp").c_str(), 24);
  schedule.quiet    = preferences.getBool(scheduleKey(index, "quiet").c_str(), false);
  schedule.powerful = preferences.getBool(scheduleKey(index, "powerful").c_str(), false);
  if (schedule.quiet && schedule.powerful) {
    schedule.quiet = false;
  }
}

bool loadLegacySchedule(AcSchedule& schedule) {
  if (!preferences.getBool("sched_valid", false)) return false;

  schedule.valid = true;
  strncpy(schedule.id, "schedule-1", sizeof(schedule.id) - 1);
  schedule.id[sizeof(schedule.id) - 1] = '\0';
  schedule.enabled = preferences.getBool("sched_enabled", false);

  String start = preferences.getString("sched_start", "22:30");
  String end   = preferences.getString("sched_end", "");
  strncpy(schedule.startTime, start.c_str(), 5);
  schedule.startTime[5] = '\0';
  strncpy(schedule.endTime, end.c_str(), 5);
  schedule.endTime[5] = '\0';
  schedule.type = preferences.isKey("sched_type")
      ? preferences.getUChar("sched_type", ScheduleTypeScheduleTime)
      : inferScheduleTypeFromTimes(schedule.startTime, schedule.endTime);

  maskToDays(preferences.getUChar("sched_days", 0x7F), schedule.days);
  schedule.repeatEnabled = preferences.getBool("sched_repeat", false);
  String repeatFrequency = preferences.getString("sched_repeat_f", "one-time");
  strncpy(schedule.repeatFrequency, repeatFrequency.c_str(), 11);
  schedule.repeatFrequency[11] = '\0';

  // Always migrate legacy schedules from v1 Panasonic constants.
  schedule.mode = migrateV1Mode(
      preferences.getUChar("sched_mode", kV1PanasonicAcCool));
  schedule.temperature = preferences.getInt("sched_temp", 24);
  schedule.fan = migrateV1Fan(preferences.getUChar("sched_fan", 0));
  schedule.quiet    = preferences.getBool("sched_quiet", false);
  schedule.powerful = preferences.getBool("sched_powerful", false);
  if (schedule.quiet && schedule.powerful) schedule.quiet = false;
  schedule.swingVertical   = migrateV1SwingV(
      preferences.getUChar("sched_swing_v", kV1PanasonicAcSwingVAuto));
  schedule.swingHorizontal = migrateV1SwingH(
      preferences.getUChar("sched_swing_h", kV1PanasonicAcSwingHAuto));
  return true;
}

void saveSchedules(const AcSchedule schedules[], uint8_t count) {
  if (!storageReady) return;
  preferences.putUChar("version", STORAGE_VERSION);
  uint8_t nextCount = min(count, MAX_AC_SCHEDULES);
  preferences.putUChar("sc_count", nextCount);
  preferences.putBool("sched_valid", false);
  for (uint8_t i = 0; i < nextCount; i++) {
    saveScheduleAt(i, schedules[i]);
  }
}

void clearSchedules() {
  if (!storageReady) return;
  preferences.putUChar("sc_count", 0);
  preferences.putBool("sched_valid", false);
}

bool loadSchedules(AcSchedule schedules[], uint8_t& count) {
  if (!storageReady) return false;

  count = 0;
  if (preferences.isKey("sc_count")) {
    uint8_t storedCount = min(preferences.getUChar("sc_count", 0), MAX_AC_SCHEDULES);
    for (uint8_t i = 0; i < storedCount; i++) {
      loadScheduleAt(i, schedules[count]);
      if (schedules[count].valid) count++;
    }
    return count > 0;
  }

  if (!loadLegacySchedule(schedules[0])) return false;
  count = 1;
  return true;
}
