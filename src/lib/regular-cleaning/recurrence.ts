import type { RegularCleaningBookingInput, RegularCleaningOccurrence } from "./types";

export const RECURRING_OCCURRENCE_COUNT = 8;
export const WEEKDAYS = [
  { value: 1, label: "Monday", shortLabel: "Mon" },
  { value: 2, label: "Tuesday", shortLabel: "Tue" },
  { value: 3, label: "Wednesday", shortLabel: "Wed" },
  { value: 4, label: "Thursday", shortLabel: "Thu" },
  { value: 5, label: "Friday", shortLabel: "Fri" },
  { value: 6, label: "Saturday", shortLabel: "Sat" },
  { value: 7, label: "Sunday", shortLabel: "Sun" },
] as const;

export function buildRegularCleaningOccurrences(
  input: RegularCleaningBookingInput,
  occurrenceCount = RECURRING_OCCURRENCE_COUNT,
): RegularCleaningOccurrence[] {
  if (input.frequency === "once") {
    return [{ index: 1, bookingDate: input.bookingDate, bookingTime: input.bookingTime }];
  }

  if (input.frequency === "monthly") {
    return buildMonthlyOccurrences(input.bookingDate, input.bookingTime, occurrenceCount);
  }

  return buildWeeklyOccurrences(input, occurrenceCount);
}

export function isRecurringFrequency(frequency: RegularCleaningBookingInput["frequency"]) {
  return frequency !== "once";
}

export function normalizeRecurrenceWeekdays(
  weekdays: number[] = [],
  bookingDate: string,
) {
  const normalized = Array.from(new Set(weekdays.filter((weekday) => weekday >= 1 && weekday <= 7))).sort((a, b) => a - b);

  if (normalized.length > 0) {
    return normalized;
  }

  return [toBusinessWeekday(parseIsoDate(bookingDate))];
}

export function formatRecurrenceSummary(
  frequency: RegularCleaningBookingInput["frequency"],
  weekdays: number[],
) {
  if (frequency === "once") {
    return "Once-off booking";
  }

  if (frequency === "monthly") {
    return "Monthly on the selected date";
  }

  const dayLabels = normalizeRecurrenceWeekdays(weekdays, new Date().toISOString().slice(0, 10))
    .map((weekday) => WEEKDAYS.find((day) => day.value === weekday)?.shortLabel)
    .filter(Boolean)
    .join(", ");

  return `${frequency === "weekly" ? "Weekly" : "Bi-weekly"} on ${dayLabels}`;
}

function buildWeeklyOccurrences(input: RegularCleaningBookingInput, occurrenceCount: number) {
  const occurrences: RegularCleaningOccurrence[] = [];
  const start = parseIsoDate(input.bookingDate);
  const selectedWeekdays = normalizeRecurrenceWeekdays(input.recurrenceWeekdays, input.bookingDate);
  const intervalWeeks = input.frequency === "fortnightly" ? 2 : 1;
  let cursor = start;

  while (occurrences.length < occurrenceCount) {
    const daysSinceStart = diffDays(start, cursor);
    const weekIndex = Math.floor(daysSinceStart / 7);

    if (weekIndex % intervalWeeks === 0 && selectedWeekdays.includes(toBusinessWeekday(cursor))) {
      occurrences.push({
        index: occurrences.length + 1,
        bookingDate: toIsoDate(cursor),
        bookingTime: input.bookingTime,
      });
    }

    cursor = addDays(cursor, 1);
  }

  return occurrences;
}

function buildMonthlyOccurrences(bookingDate: string, bookingTime: string, occurrenceCount: number) {
  const occurrences: RegularCleaningOccurrence[] = [];
  const start = parseIsoDate(bookingDate);
  const dayOfMonth = start.getUTCDate();

  for (let index = 0; index < occurrenceCount; index += 1) {
    const date = addMonthsClamped(start, index, dayOfMonth);
    occurrences.push({
      index: index + 1,
      bookingDate: toIsoDate(date),
      bookingTime,
    });
  }

  return occurrences;
}

function parseIsoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toBusinessWeekday(date: Date) {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function diffDays(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function addMonthsClamped(start: Date, monthsToAdd: number, dayOfMonth: number) {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + monthsToAdd;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(dayOfMonth, lastDay)));
}
