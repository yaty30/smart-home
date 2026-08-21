#include "Eyes.h"

#include <Adafruit_ST7735.h>
#include <esp_system.h>
#include <math.h>

#include "Config.h"

extern Adafruit_ST7735 tft;

constexpr int16_t EYE_RADIUS = 10;
constexpr int16_t EYE_SPACING = 42;
constexpr int16_t MAX_LOOK_X = 12;
constexpr int16_t MAX_LOOK_Y = 6;
constexpr int16_t EYE_REGION_PADDING = 3;
constexpr uint16_t FRAME_INTERVAL_MS = 33;
constexpr uint8_t DOUBLE_BLINK_PERCENT = 18;
constexpr uint16_t BACKGROUND_COLOR = ST77XX_BLACK;
constexpr uint16_t EYE_COLOR = ST77XX_WHITE;
constexpr int16_t LEFT_EYE_X =
    (SCREEN_WIDTH / 2) - (EYE_SPACING / 2);
constexpr int16_t RIGHT_EYE_X =
    (SCREEN_WIDTH / 2) + (EYE_SPACING / 2);
constexpr int16_t EYE_Y =
    SCREEN_HEIGHT / 2;
constexpr int16_t EYE_REGION_RADIUS_X =
    EYE_RADIUS + MAX_LOOK_X + EYE_REGION_PADDING;
constexpr int16_t EYE_REGION_RADIUS_Y =
    EYE_RADIUS + MAX_LOOK_Y + EYE_REGION_PADDING;
constexpr int16_t LEFT_EYE_REGION_X =
    LEFT_EYE_X - EYE_REGION_RADIUS_X;
constexpr int16_t RIGHT_EYE_REGION_X =
    RIGHT_EYE_X - EYE_REGION_RADIUS_X;
constexpr int16_t EYE_REGION_Y =
    EYE_Y - EYE_REGION_RADIUS_Y;
constexpr int16_t EYE_REGION_W =
    EYE_REGION_RADIUS_X * 2;
constexpr int16_t EYE_REGION_H =
    EYE_REGION_RADIUS_Y * 2;

enum GazePhase {
  GAZE_IDLE,
  GAZE_MOVING_OUT,
  GAZE_HOLDING,
  GAZE_RETURNING
};

struct EyeFrame {
  int16_t offsetX;
  int16_t offsetY;
  int16_t halfHeight;
};

GazePhase gazePhase = GAZE_IDLE;
float currentOffsetX = 0.0f;
float currentOffsetY = 0.0f;
float moveStartX = 0.0f;
float moveStartY = 0.0f;
float moveTargetX = 0.0f;
float moveTargetY = 0.0f;
unsigned long moveStartedAt = 0;
unsigned long moveDurationMs = 0;
unsigned long holdDurationMs = 0;
unsigned long holdUntil = 0;
unsigned long nextGazeAt = 0;

bool blinking = false;
uint8_t queuedBlinks = 0;
bool nextBlinkIsFast = false;
uint8_t blinkSpeedPercent = 100;
unsigned long blinkStartedAt = 0;
unsigned long blinkDurationMs = 0;
unsigned long nextBlinkAt = 0;
unsigned long lastFrameAt = 0;
EyeFrame lastDrawnFrame = { 0, 0, 0 };
bool hasDrawnFrame = false;

float clampUnit(float value) {
  if (value < 0.0f) {
    return 0.0f;
  }

  if (value > 1.0f) {
    return 1.0f;
  }

  return value;
}

float smoothStep(float value) {
  float t = clampUnit(value);
  return t * t * (3.0f - (2.0f * t));
}

float lerpFloat(float from, float to, float amount) {
  return from + ((to - from) * amount);
}

unsigned long nextStillDelay() {
  if (random(0, 100) < 22) {
    return random(4500, 8501);
  }

  return random(1400, 4301);
}

void startMove(float targetX, float targetY, unsigned long durationMs, GazePhase nextPhase) {
  moveStartX = currentOffsetX;
  moveStartY = currentOffsetY;
  moveTargetX = targetX;
  moveTargetY = targetY;
  moveDurationMs = durationMs;
  moveStartedAt = millis();
  gazePhase = nextPhase;
}

void chooseNextLook(unsigned long now) {
  int choice = random(0, 100);
  int8_t targetX = 0;
  int8_t targetY = 0;

  if (choice < 5) {
    nextGazeAt = now + random(1200, 3601);
    return;
  }

  if (choice < 60) {
    targetX = random(-3, 4);
    targetY = random(-2, 3);
    if (targetX == 0 && targetY == 0) {
      targetX = random(0, 2) == 0 ? -1 : 1;
    }
    startMove(targetX, targetY, random(180, 361), GAZE_MOVING_OUT);
    holdDurationMs = random(450, 1101);
    return;
  }

  if (choice < 90) {
    targetX = random(0, 2) == 0 ? -random(4, 8) : random(4, 8);
    targetY = random(-4, 5);
    if (random(0, 100) < 35) {
      targetY = 0;
    }
    startMove(targetX, targetY, random(220, 451), GAZE_MOVING_OUT);
    holdDurationMs = random(400, 1201);
    return;
  }

  targetX = random(0, 2) == 0 ? -random(8, 13) : random(8, 13);
  targetY = random(-MAX_LOOK_Y, MAX_LOOK_Y + 1);
  if (random(0, 100) < 25) {
    targetY = 0;
  }
  startMove(targetX, targetY, random(260, 521), GAZE_MOVING_OUT);
  holdDurationMs = random(400, 1201);
}

void updateGaze(unsigned long now) {
  if (gazePhase == GAZE_IDLE) {
    if (now >= nextGazeAt) {
      chooseNextLook(now);
    }
    return;
  }

  if (gazePhase == GAZE_HOLDING) {
    if (now >= holdUntil) {
      startMove(0.0f, 0.0f, random(220, 480), GAZE_RETURNING);
    }
    return;
  }

  float progress = moveDurationMs == 0
      ? 1.0f
      : static_cast<float>(now - moveStartedAt) / static_cast<float>(moveDurationMs);
  float eased = smoothStep(progress);
  currentOffsetX = lerpFloat(moveStartX, moveTargetX, eased);
  currentOffsetY = lerpFloat(moveStartY, moveTargetY, eased);

  if (progress < 1.0f) {
    return;
  }

  currentOffsetX = moveTargetX;
  currentOffsetY = moveTargetY;

  if (gazePhase == GAZE_MOVING_OUT) {
    gazePhase = GAZE_HOLDING;
    holdUntil = now + holdDurationMs;
  } else {
    gazePhase = GAZE_IDLE;
    nextGazeAt = now + nextStillDelay();
  }
}

unsigned long scaledBlinkSegment(uint8_t segmentMs) {
  unsigned long scaled = static_cast<unsigned long>(segmentMs) * blinkSpeedPercent / 100;
  return scaled == 0 ? 1 : scaled;
}

unsigned long blinkTotalDuration() {
  static const uint8_t segmentDurations[] = { 35, 30, 25, 30, 35, 40, 45 };
  unsigned long total = 0;
  for (uint8_t i = 0; i < sizeof(segmentDurations); i++) {
    total += scaledBlinkSegment(segmentDurations[i]);
  }
  return total;
}

unsigned long nextBlinkDelay() {
  if (random(0, 100) < 12) {
    return random(6000, 9001);
  }

  return random(2000, 6001);
}

void beginBlink(unsigned long now, bool fast) {
  blinking = true;
  blinkSpeedPercent = fast ? 86 : 100;
  blinkStartedAt = now;
  blinkDurationMs = blinkTotalDuration();
}

void updateBlink(unsigned long now) {
  if (!blinking) {
    if (queuedBlinks > 0 && now >= nextBlinkAt) {
      beginBlink(now, nextBlinkIsFast);
      nextBlinkIsFast = false;
      return;
    }

    if (queuedBlinks == 0 && now >= nextBlinkAt) {
      queuedBlinks = random(0, 100) < DOUBLE_BLINK_PERCENT ? 2 : 1;
      beginBlink(now, false);
    }
    return;
  }

  if (now - blinkStartedAt < blinkDurationMs) {
    return;
  }

  blinking = false;
  if (queuedBlinks > 0) {
    queuedBlinks--;
  }

  if (queuedBlinks > 0) {
    nextBlinkAt = now + random(80, 150);
    nextBlinkIsFast = true;
  } else {
    nextBlinkAt = now + nextBlinkDelay();
    nextBlinkIsFast = false;
  }
}

int16_t currentEyeHalfHeight(unsigned long now) {
  if (!blinking || blinkDurationMs == 0) {
    return EYE_RADIUS;
  }

  static const uint8_t segmentDurations[] = { 35, 30, 25, 30, 35, 40, 45 };
  static const int8_t keyHeights[] = { 10, 7, 4, 1, 4, 8, 11, 10 };
  unsigned long elapsed = now - blinkStartedAt;
  unsigned long segmentStart = 0;

  for (uint8_t i = 0; i < sizeof(segmentDurations); i++) {
    unsigned long segmentDuration = scaledBlinkSegment(segmentDurations[i]);
    if (elapsed <= segmentStart + segmentDuration) {
      float progress = static_cast<float>(elapsed - segmentStart) /
          static_cast<float>(segmentDuration);
      float eased = smoothStep(progress);
      float height = lerpFloat(keyHeights[i], keyHeights[i + 1], eased);
      int16_t halfHeight = static_cast<int16_t>(height + 0.5f);
      return halfHeight < 1 ? 1 : halfHeight;
    }

    segmentStart += segmentDuration;
  }

  return EYE_RADIUS;
}

void fillEllipse(int16_t cx, int16_t cy, int16_t rx, int16_t ry, uint16_t color) {
  if (ry <= 1) {
    tft.drawFastHLine(cx - rx, cy, (rx * 2) + 1, color);
    tft.drawFastHLine(cx - rx, cy + 1, (rx * 2) + 1, color);
    return;
  }

  for (int16_t y = -ry; y <= ry; y++) {
    float ratio = static_cast<float>(y) / static_cast<float>(ry);
    int16_t halfWidth = static_cast<int16_t>(
        rx * sqrt(1.0f - (ratio * ratio)) + 0.5f);
    tft.drawFastHLine(cx - halfWidth, cy + y, (halfWidth * 2) + 1, color);
  }
}

void clearEyeRegions() {
  tft.fillRect(LEFT_EYE_REGION_X, EYE_REGION_Y, EYE_REGION_W, EYE_REGION_H, BACKGROUND_COLOR);
  tft.fillRect(RIGHT_EYE_REGION_X, EYE_REGION_Y, EYE_REGION_W, EYE_REGION_H, BACKGROUND_COLOR);
}

void drawEyes(const EyeFrame& frame) {
  clearEyeRegions();
  fillEllipse(LEFT_EYE_X + frame.offsetX, EYE_Y + frame.offsetY, EYE_RADIUS, frame.halfHeight, EYE_COLOR);
  fillEllipse(RIGHT_EYE_X + frame.offsetX, EYE_Y + frame.offsetY, EYE_RADIUS, frame.halfHeight, EYE_COLOR);
  lastDrawnFrame = frame;
  hasDrawnFrame = true;
}

bool frameChanged(const EyeFrame& frame) {
  return !hasDrawnFrame
      || frame.offsetX != lastDrawnFrame.offsetX
      || frame.offsetY != lastDrawnFrame.offsetY
      || frame.halfHeight != lastDrawnFrame.halfHeight;
}

EyeFrame currentFrame(unsigned long now) {
  EyeFrame frame;
  frame.offsetX = static_cast<int16_t>(currentOffsetX + (currentOffsetX >= 0 ? 0.5f : -0.5f));
  frame.offsetY = static_cast<int16_t>(currentOffsetY + (currentOffsetY >= 0 ? 0.5f : -0.5f));
  frame.halfHeight = currentEyeHalfHeight(now);
  return frame;
}

void initEyes() {
  randomSeed(esp_random());
  currentOffsetX = 0.0f;
  currentOffsetY = 0.0f;
  gazePhase = GAZE_IDLE;
  blinking = false;
  queuedBlinks = 0;
  nextBlinkIsFast = false;
  blinkSpeedPercent = 100;
  hasDrawnFrame = false;

  unsigned long now = millis();
  nextGazeAt = now + nextStillDelay();
  nextBlinkAt = now + random(1200, 3600);
  lastFrameAt = 0;

  tft.fillScreen(BACKGROUND_COLOR);
  drawEyes(currentFrame(now));
}

void updateEyes() {
  unsigned long now = millis();

  updateBlink(now);
  updateGaze(now);

  if (now - lastFrameAt < FRAME_INTERVAL_MS) {
    return;
  }

  lastFrameAt = now;
  EyeFrame frame = currentFrame(now);
  if (frameChanged(frame)) {
    drawEyes(frame);
  }
}
