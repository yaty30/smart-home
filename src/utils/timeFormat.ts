export const formatTimePart = (value: number) => String(value).padStart(2, '0');

export const formatTime12h = (time: string) => {
  const [hoursPart = '0', minutesPart = '0'] = time.split(':');
  const hours = Number(hoursPart);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(hour12).padStart(2, '0')}:${minutesPart.padStart(2, '0')} ${suffix}`;
};

export const timeStringFromDate = (date: Date) =>
  `${formatTimePart(date.getHours())}:${formatTimePart(date.getMinutes())}`;

export const dateFromTimeString = (time: string) => {
  const [hours = '0', minutes = '0'] = time.split(':');
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date;
};

export const addMinutesToTimeString = (time: string, minutesToAdd: number) => {
  const [hours = '0', minutes = '0'] = time.split(':');
  const totalMinutes =
    (Number(hours) * 60 + Number(minutes) + minutesToAdd + 24 * 60) % (24 * 60);

  return `${formatTimePart(Math.floor(totalMinutes / 60))}:${formatTimePart(
    totalMinutes % 60,
  )}`;
};
