/** "4:05", "1:02:03" countdown text for a number of seconds (clamped at 0). */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Spoken form for screen readers: "4 minutes 5 seconds". */
export function countdownForScreenReader(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const part = (n: number, unit: string) => (n ? `${n} ${unit}${n === 1 ? '' : 's'}` : '');
  return (
    [part(h, 'hour'), part(m, 'minute'), part(sec, 'second')].filter(Boolean).join(' ') ||
    '0 seconds'
  );
}

const DIVISIONS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [7, 'day'],
  [4.34524, 'week'],
  [12, 'month'],
  [Number.POSITIVE_INFINITY, 'year'],
];

/** "3 minutes ago", "in 2 hours" using Intl.RelativeTimeFormat. */
export function formatRelativeTime(
  date: Date | number,
  now: Date | number = Date.now(),
  locale = 'en-US',
): string {
  let duration = (Number(date) - Number(now)) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [amount, unit] of DIVISIONS) {
    if (Math.abs(duration) < amount) return rtf.format(Math.round(duration), unit);
    duration /= amount;
  }
  return rtf.format(Math.round(duration), 'year');
}
