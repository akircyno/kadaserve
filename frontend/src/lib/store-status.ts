export type StoreOverrideStatus = "auto" | "open" | "busy" | "closed";
export type StoreEffectiveStatus = "open" | "busy" | "closed";

export type StoreStatusPayload = {
  overrideStatus: StoreOverrideStatus;
  effectiveStatus: StoreEffectiveStatus;
  isScheduledOpen: boolean;
  label: string;
  checkoutBlockedMessage: string | null;
  hoursLabel: string;
  updatedAt: string | null;
  setupRequired?: boolean;
};

export const STORE_STATUS_SETTING_KEY = "store_status_override";
export const STORE_HOURS_LABEL = "Monday to Saturday, 5:00 PM to 12:00 AM";

const manilaWeekdayIndexes: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 0,
};

function getManilaClock(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  return {
    day: manilaWeekdayIndexes[weekday] ?? 0,
    minutes: hour * 60 + minute,
  };
}

export function normalizeStoreOverride(
  value: string | null | undefined
): StoreOverrideStatus {
  return value === "open" || value === "busy" || value === "closed"
    ? value
    : "auto";
}

export function isStoreScheduledOpen(date = new Date()) {
  const clock = getManilaClock(date);
  const openMinutes = 17 * 60;
  const closeMinutes = 24 * 60;

  return clock.day >= 1 && clock.day <= 6 && clock.minutes >= openMinutes && clock.minutes < closeMinutes;
}

export function resolveStoreStatus(
  overrideStatus: StoreOverrideStatus,
  date = new Date(),
  updatedAt: string | null = null,
  setupRequired = false
): StoreStatusPayload {
  const isScheduledOpen = isStoreScheduledOpen(date);
  const effectiveStatus: StoreEffectiveStatus =
    overrideStatus === "busy"
      ? "busy"
      : overrideStatus === "closed"
      ? "closed"
      : overrideStatus === "open"
      ? "open"
      : isScheduledOpen
      ? "open"
      : "closed";

  const label =
    effectiveStatus === "open"
      ? "Accepting"
      : effectiveStatus === "busy"
      ? "Busy"
      : "Closed";

  const checkoutBlockedMessage =
    effectiveStatus === "busy"
      ? "Kada Cafe PH is busy right now. Please try again shortly."
      : effectiveStatus === "closed"
      ? `Kada Cafe PH is closed. Store hours are ${STORE_HOURS_LABEL}.`
      : null;

  return {
    overrideStatus,
    effectiveStatus,
    isScheduledOpen,
    label,
    checkoutBlockedMessage,
    hoursLabel: STORE_HOURS_LABEL,
    updatedAt,
    setupRequired,
  };
}
