const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

const isTruthy = (value: string | undefined) => {
  return value !== undefined && TRUE_VALUES.has(value.trim().toLowerCase());
};

export const isDebugMode =
  isTruthy(process.env.EXPO_PUBLIC_DEBUG_MODE) ||
  isTruthy(process.env.DEBUG_MODE);
