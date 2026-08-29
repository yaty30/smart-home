#include "StorageManager.h"

#include <Preferences.h>

namespace {
constexpr const char* STORAGE_NAMESPACE = "smart-home";
constexpr uint8_t STORAGE_VERSION = 1;

Preferences preferences;
bool storageReady = false;

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
  if (startTime[0] != '\0' && endTime[0] == '\0') {
    return ScheduleTypeAutoOn;
  }
  if (startTime[0] == '\0' && endTime[0] != '\0') {
    return ScheduleTypeAutoOff;
  }
  return ScheduleTypeScheduleTime;
}

uint8_t daysToMask(const bool days[7]) {
  uint8_t mask = 0;
  for (uint8_t i = 0; i < 7; i++) {
    if (days[i]) {
      mask |= (1 << i);
    }
  }
  return mask;
}

void maskToDays(uint8_t mask, bool days[7]) {
  for (uint8_t i = 0; i < 7; i++) {
    days[i] = (mask & (1 << i)) != 0;
  }
}
}

void initStorageManager() {
  storageReady = preferences.begin(STORAGE_NAMESPACE, false);
  if (!storageReady) {
    Serial.println("Preferences storage could not be opened");
  }
}

bool loadStoredState(AcState& storedAcState, bool& storedPaired) {
  if (!storageReady || preferences.getUChar("version", 0) != STORAGE_VERSION) {
    return false;
  }

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
  if (!storageReady) {
    return;
  }

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

void savePairingState(bool paired) {
  if (!storageReady) {
    return;
  }

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

  String id = preferences.getString(scheduleKey(index, "id").c_str(), "schedule-" + String(index + 1));
  strncpy(schedule.id, id.c_str(), sizeof(schedule.id) - 1);
  schedule.id[sizeof(schedule.id) - 1] = '\0';

  schedule.enabled = preferences.getBool(scheduleKey(index, "enabled").c_str(), false);
  String start = preferences.getString(scheduleKey(index, "start").c_str(), "22:30");
  String end = preferences.getString(scheduleKey(index, "end").c_str(), "");
  strncpy(schedule.startTime, start.c_str(), 5);
  schedule.startTime[5] = '\0';
  strncpy(schedule.endTime, end.c_str(), 5);
  schedule.endTime[5] = '\0';
  schedule.type = preferences.getUChar(
    scheduleKey(index, "type").c_str(),
    inferScheduleTypeFromTimes(schedule.startTime, schedule.endTime)
  );

  maskToDays(preferences.getUChar(scheduleKey(index, "days").c_str(), 0x7F), schedule.days);
  schedule.repeatEnabled = preferences.getBool(scheduleKey(index, "repeat").c_str(), false);
  String repeatFrequency = preferences.getString(scheduleKey(index, "repeat_f").c_str(), "one-time");
  strncpy(schedule.repeatFrequency, repeatFrequency.c_str(), 11);
  schedule.repeatFrequency[11] = '\0';

  schedule.mode = preferences.getUChar(scheduleKey(index, "mode").c_str(), kPanasonicAcCool);
  schedule.temperature = preferences.getInt(scheduleKey(index, "temp").c_str(), 24);
  schedule.fan = preferences.getUChar(scheduleKey(index, "fan").c_str(), kPanasonicAcFanAuto);
  schedule.quiet = preferences.getBool(scheduleKey(index, "quiet").c_str(), false);
  schedule.powerful = preferences.getBool(scheduleKey(index, "powerful").c_str(), false);
  if (schedule.quiet && schedule.powerful) {
    schedule.quiet = false;
  }
  schedule.swingVertical = preferences.getUChar(scheduleKey(index, "swing_v").c_str(), kPanasonicAcSwingVAuto);
  schedule.swingHorizontal = preferences.getUChar(scheduleKey(index, "swing_h").c_str(), kPanasonicAcSwingHAuto);
}

bool loadLegacySchedule(AcSchedule& schedule) {
  if (!preferences.getBool("sched_valid", false)) {
    return false;
  }

  schedule.valid = true;
  strncpy(schedule.id, "schedule-1", sizeof(schedule.id) - 1);
  schedule.id[sizeof(schedule.id) - 1] = '\0';
  schedule.enabled = preferences.getBool("sched_enabled", false);

  String start = preferences.getString("sched_start", "22:30");
  String end = preferences.getString("sched_end", "");
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

  schedule.mode = preferences.getUChar("sched_mode", kPanasonicAcCool);
  schedule.temperature = preferences.getInt("sched_temp", 24);
  schedule.fan = preferences.getUChar("sched_fan", kPanasonicAcFanAuto);
  schedule.quiet = preferences.getBool("sched_quiet", false);
  schedule.powerful = preferences.getBool("sched_powerful", false);
  if (schedule.quiet && schedule.powerful) {
    schedule.quiet = false;
  }
  schedule.swingVertical = preferences.getUChar("sched_swing_v", kPanasonicAcSwingVAuto);
  schedule.swingHorizontal = preferences.getUChar("sched_swing_h", kPanasonicAcSwingHAuto);
  return true;
}

void saveSchedules(const AcSchedule schedules[], uint8_t count) {
  if (!storageReady) {
    return;
  }

  preferences.putUChar("version", STORAGE_VERSION);
  uint8_t nextCount = min(count, MAX_AC_SCHEDULES);
  preferences.putUChar("sc_count", nextCount);
  preferences.putBool("sched_valid", false);

  for (uint8_t i = 0; i < nextCount; i++) {
    saveScheduleAt(i, schedules[i]);
  }
}

void clearSchedules() {
  if (!storageReady) {
    return;
  }

  preferences.putUChar("sc_count", 0);
  preferences.putBool("sched_valid", false);
}

bool loadSchedules(AcSchedule schedules[], uint8_t& count) {
  if (!storageReady) {
    return false;
  }

  count = 0;
  if (preferences.isKey("sc_count")) {
    uint8_t storedCount = min(preferences.getUChar("sc_count", 0), MAX_AC_SCHEDULES);
    for (uint8_t i = 0; i < storedCount; i++) {
      loadScheduleAt(i, schedules[count]);
      if (schedules[count].valid) {
        count++;
      }
    }
    return count > 0;
  }

  if (!loadLegacySchedule(schedules[0])) {
    return false;
  }

  count = 1;
  return true;
}
