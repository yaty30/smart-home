export const MIN_TEMPERATURE = 16;
export const MAX_TEMPERATURE = 28;
export const HEAT_MIN_TEMPERATURE = 22;
export const HEAT_MAX_TEMPERATURE = 30;
export const GAUGE_START_ANGLE = 240;
export const GAUGE_SWEEP_ANGLE = 240;

export const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export const normalizeTemperature = (
  temperature: number,
  minTemperature = MIN_TEMPERATURE,
  maxTemperature = MAX_TEMPERATURE,
) => {
  return clamp(temperature, minTemperature, maxTemperature);
};

export const temperatureToAngle = (
  temperature: number,
  minTemperature = MIN_TEMPERATURE,
  maxTemperature = MAX_TEMPERATURE,
) => {
  const normalizedTemperature = normalizeTemperature(
    temperature,
    minTemperature,
    maxTemperature,
  );
  const progress =
    (normalizedTemperature - minTemperature) /
    (maxTemperature - minTemperature);

  return GAUGE_START_ANGLE + progress * GAUGE_SWEEP_ANGLE;
};

export const angleToTemperature = (
  angle: number,
  minTemperature = MIN_TEMPERATURE,
  maxTemperature = MAX_TEMPERATURE,
) => {
  const normalizedAngle = clamp(
    angle - GAUGE_START_ANGLE,
    0,
    GAUGE_SWEEP_ANGLE,
  );
  const progress = normalizedAngle / GAUGE_SWEEP_ANGLE;

  return Math.round(
    minTemperature + progress * (maxTemperature - minTemperature),
  );
};

export const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

export const describeArc = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) => {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(' ');
};

export const pointToGaugeAngle = (
  locationX: number,
  locationY: number,
  center: number,
) => {
  const radians = Math.atan2(locationY - center, locationX - center);
  const degrees = (radians * 180) / Math.PI + 90;
  const positiveDegrees = degrees < 0 ? degrees + 360 : degrees;
  const arcEnd = GAUGE_START_ANGLE + GAUGE_SWEEP_ANGLE;

  if (positiveDegrees > 120 && positiveDegrees < GAUGE_START_ANGLE) {
    return positiveDegrees < 180 ? arcEnd : GAUGE_START_ANGLE;
  }

  const continuousAngle =
    positiveDegrees <= 120 ? positiveDegrees + 360 : positiveDegrees;

  return clamp(continuousAngle, GAUGE_START_ANGLE, arcEnd);
};
