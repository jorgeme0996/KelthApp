const MEXICO_CITY = "America/Mexico_City";
const WEEKDAY_TO_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === "24" ? "0" : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

// Returns the UTC instant corresponding to 00:00:00 local wall-clock time on
// the given Y-M-D in `timeZone`. Computed generically (not a hardcoded
// offset) so it stays correct if the zone's DST rules ever change.
function zonedStartOfDayToUtc(year: number, month: number, day: number, timeZone: string): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const partsAtGuess = getDatePartsInTimeZone(utcGuess, timeZone);
  const guessAsIfUtc = Date.UTC(
    partsAtGuess.year,
    partsAtGuess.month - 1,
    partsAtGuess.day,
    partsAtGuess.hour,
    partsAtGuess.minute,
    partsAtGuess.second,
  );
  const offsetMs = guessAsIfUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

// "Today" as observed in America/Mexico_City, regardless of the server's own
// timezone. dayIndex follows this codebase's 0-6 Mon-Sun convention.
export function getMexicoCityToday(reference: Date = new Date()): { dayIndex: number; startOfDay: Date; endOfDay: Date } {
  const parts = getDatePartsInTimeZone(reference, MEXICO_CITY);
  const startOfDay = zonedStartOfDayToUtc(parts.year, parts.month, parts.day, MEXICO_CITY);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const weekdayShort = new Intl.DateTimeFormat("en-US", { timeZone: MEXICO_CITY, weekday: "short" }).format(reference);
  const dayIndex = WEEKDAY_TO_INDEX[weekdayShort];

  return { dayIndex, startOfDay, endOfDay };
}
