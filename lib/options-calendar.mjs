const newYorkClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', hourCycle: 'h23', minute: '2-digit', weekday: 'short',
});

// This is only a routine weekday window, not a confirmed listed option expiry.
export function nextRoutineFxOptionWindow(now = Date.now()) {
  const instant = new Date(now);
  if (!Number.isFinite(instant.getTime())) return null;
  const parts = Object.fromEntries(newYorkClock.formatToParts(instant).map(({ type, value }) => [type, value]));
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const currentDay = date.getUTCDay();
  const afterFix = Number(parts.hour) >= 10;
  if (currentDay === 0 || currentDay === 6 || afterFix) date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 1);
  return {
    date: date.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat('es-US', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(date),
    timeZone: 'America/New_York',
    hour: '10:00',
    confirmed: false,
  };
}
