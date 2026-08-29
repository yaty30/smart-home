#include "ScheduleManager.h"

#include <time.h>
#include <WiFi.h>

#include "Config.h"
#include "State.h"
#include "StateManager.h"
#include "WiFiManager.h"

// UTC offset in seconds — adjust in Config.h if needed
#ifndef SCHEDULE_GMT_OFFSET_SEC
#define SCHEDULE_GMT_OFFSET_SEC 0
#endif

#ifndef SCHEDULE_DAYLIGHT_OFFSET_SEC
#define SCHEDULE_DAYLIGHT_OFFSET_SEC 0
#endif

static const char* NTP_SERVER = "pool.ntp.org";
static const unsigned long NTP_SYNC_RETRY_MS = 60000;

static bool ntpSynced = false;
static int lastScheduleMinute = -1;
static unsigned long lastNtpSyncAttempt = 0;

static int timeToMinutes(const char* timeStr) {
  int h = (timeStr[0] - '0') * 10 + (timeStr[1] - '0');
  int m = (timeStr[3] - '0') * 10 + (timeStr[4] - '0');
  return h * 60 + m;
}

static void syncNtpTime() {
  lastNtpSyncAttempt = millis();

  if (!isWiFiConnected()) {
    Serial.println("[Schedule] WiFi not connected — skipping NTP sync");
    return;
  }

  configTime(SCHEDULE_GMT_OFFSET_SEC, SCHEDULE_DAYLIGHT_OFFSET_SEC, NTP_SERVER);

  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 5000)) {
    ntpSynced = true;
    Serial.printf("[Schedule] NTP synced — current time %02d:%02d\n",
                  timeinfo.tm_hour, timeinfo.tm_min);
  } else {
    Serial.println("[Schedule] NTP sync failed");
  }
}

void initScheduleManager() {
  syncNtpTime();
}

bool isNtpTimeAvailable() {
  return ntpSynced;
}

void resetScheduleExecutionCursor() {
  lastScheduleMinute = -1;
}

void handleScheduleExecution() {
  if (!ntpSynced) {
    if (millis() - lastNtpSyncAttempt >= NTP_SYNC_RETRY_MS) {
      syncNtpTime();
    }
    return;
  }

  if (acScheduleCount == 0) {
    return;
  }

  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 0)) {
    return;
  }

  int currentMinute = timeinfo.tm_hour * 60 + timeinfo.tm_min;
  int scheduleDayIndex = (timeinfo.tm_wday + 6) % 7; // tm_wday is Sun-Sat.

  if (currentMinute == lastScheduleMinute) {
    return;
  }
  lastScheduleMinute = currentMinute;

  for (uint8_t i = 0; i < acScheduleCount; i++) {
    const AcSchedule& schedule = acSchedules[i];
    if (!schedule.valid || !schedule.enabled || !schedule.days[scheduleDayIndex]) {
      continue;
    }

    int startMin = schedule.startTime[0] == '\0' ? -1 : timeToMinutes(schedule.startTime);
    int endMin = schedule.endTime[0] == '\0' ? -1 : timeToMinutes(schedule.endTime);

    if (schedule.type != ScheduleTypeAutoOff &&
        startMin >= 0 &&
        currentMinute == startMin) {
      AcState nextState = acState;
      nextState.power          = true;
      nextState.mode           = schedule.mode;
      nextState.temperature    = schedule.temperature;
      nextState.fan            = schedule.fan;
      nextState.quiet          = schedule.quiet;
      nextState.powerful       = schedule.powerful;
      nextState.swingVertical  = schedule.swingVertical;
      nextState.swingHorizontal = schedule.swingHorizontal;
      applyACState(nextState);
      Serial.printf("[Schedule] AC turned ON by schedule %s\n", schedule.id);
      continue;
    }

    if (schedule.type != ScheduleTypeAutoOn &&
        endMin >= 0 &&
        currentMinute == endMin) {
      AcState nextState = acState;
      nextState.power = false;
      applyACState(nextState);
      Serial.printf("[Schedule] AC turned OFF by schedule %s\n", schedule.id);
    }
  }
}
