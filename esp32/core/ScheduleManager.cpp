#include "ScheduleManager.h"

#include <time.h>
#include <WiFi.h>

#include "ACController.h"
#include "State.h"
#include "WiFiManager.h"

// UTC offset in seconds — adjust in Config.h if needed
#ifndef SCHEDULE_GMT_OFFSET_SEC
#define SCHEDULE_GMT_OFFSET_SEC 0
#endif

#ifndef SCHEDULE_DAYLIGHT_OFFSET_SEC
#define SCHEDULE_DAYLIGHT_OFFSET_SEC 0
#endif

static const char* NTP_SERVER = "pool.ntp.org";

static bool ntpSynced = false;
static int lastScheduleMinute = -1;

static int timeToMinutes(const char* timeStr) {
  int h = (timeStr[0] - '0') * 10 + (timeStr[1] - '0');
  int m = (timeStr[3] - '0') * 10 + (timeStr[4] - '0');
  return h * 60 + m;
}

void initScheduleManager() {
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

bool isNtpTimeAvailable() {
  return ntpSynced;
}

void handleScheduleExecution() {
  if (!ntpSynced || !acSchedule.valid || !acSchedule.enabled) {
    return;
  }

  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 0)) {
    return;
  }

  int currentMinute = timeinfo.tm_hour * 60 + timeinfo.tm_min;

  if (currentMinute == lastScheduleMinute) {
    return;
  }
  lastScheduleMinute = currentMinute;

  int startMin = timeToMinutes(acSchedule.startTime);
  int endMin   = timeToMinutes(acSchedule.endTime);

  if (currentMinute == startMin) {
    AcState nextState = acState;
    nextState.power          = true;
    nextState.mode           = acSchedule.mode;
    nextState.temperature    = acSchedule.temperature;
    nextState.swingVertical  = acSchedule.swingVertical;
    nextState.swingHorizontal = acSchedule.swingHorizontal;
    nextState.quiet          = false;
    nextState.powerful       = false;
    applyACState(nextState);
    Serial.println("[Schedule] AC turned ON by schedule");
    return;
  }

  if (currentMinute == endMin) {
    AcState nextState = acState;
    nextState.power = false;
    applyACState(nextState);
    Serial.println("[Schedule] AC turned OFF by schedule");
  }
}
