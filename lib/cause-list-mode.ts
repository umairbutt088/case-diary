import { APP_TIMEZONE } from "@/lib/notifications";

/** Matches nightly cause-list reminder send hour (8 PM Asia/Karachi). */
export const CAUSE_LIST_TOMORROW_MODE_HOUR = 20;

export type CauseListDayKind = "today" | "tomorrow";

export type CauseListDayMode = {
  mode: CauseListDayKind;
  /** Hearing date to filter (`next_hearing_date`), YYYY-MM-DD in Asia/Karachi. */
  hearingDate: string;
  /** Calendar "today" in Asia/Karachi. */
  calendarToday: string;
  screenTitle: string;
  segmentLabel: string;
  sectionTitle: string;
  emptyHeading: string;
  emptySubtext: string;
  shareTitle: string;
  noHearingsMessage: string;
  homeWidgetTitle: string;
  homeWidgetSubtitle: string;
};

function getDateInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getHourInTimezone(date: Date, timeZone: string): number {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).format(date);
  return Number.parseInt(formatted, 10);
}

function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function buildMode(
  mode: CauseListDayKind,
  hearingDate: string,
  calendarToday: string,
): CauseListDayMode {
  if (mode === "tomorrow") {
    return {
      mode,
      hearingDate,
      calendarToday,
      screenTitle: "Tomorrow Cases",
      segmentLabel: "Tomorrow",
      sectionTitle: "Hearings tomorrow",
      emptyHeading: "Nothing for tomorrow",
      emptySubtext: "Cases with a hearing tomorrow will appear here.",
      shareTitle: "Tomorrow Hearings",
      noHearingsMessage: "There are no hearings tomorrow.",
      homeWidgetTitle: "Tomorrow cases",
      homeWidgetSubtitle: "Open tomorrow's hearings",
    };
  }

  return {
    mode,
    hearingDate,
    calendarToday,
    screenTitle: "Today Cases",
    segmentLabel: "Today",
    sectionTitle: "Hearings today",
    emptyHeading: "Nothing for today",
    emptySubtext: "Cases with a hearing today will appear here.",
    shareTitle: "Today Hearings",
    noHearingsMessage: "There are no hearings today.",
    homeWidgetTitle: "Today cases",
    homeWidgetSubtitle: "Open today's hearings",
  };
}

/**
 * Before 8 PM Karachi → today's hearings ("Today Cases").
 * From 8 PM until midnight → tomorrow's hearings ("Tomorrow Cases").
 * After midnight → back to today.
 */
export function getCauseListDayMode(now: Date = new Date()): CauseListDayMode {
  const calendarToday = getDateInTimezone(now, APP_TIMEZONE);
  const hour = getHourInTimezone(now, APP_TIMEZONE);

  if (hour >= CAUSE_LIST_TOMORROW_MODE_HOUR) {
    return buildMode("tomorrow", addCalendarDays(calendarToday, 1), calendarToday);
  }

  return buildMode("today", calendarToday, calendarToday);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Clock-based mode, optionally overridden by a notification target date
 * (so a forced/early reminder still opens tomorrow's list).
 */
export function resolveCauseListDayMode(options?: {
  date?: string | null;
  now?: Date;
}): CauseListDayMode {
  const base = getCauseListDayMode(options?.now);
  const date = options?.date?.slice(0, 10) ?? null;

  if (date && isIsoDate(date)) {
    if (date > base.calendarToday) {
      return buildMode("tomorrow", date, base.calendarToday);
    }
    return buildMode("today", date, base.calendarToday);
  }

  return base;
}
