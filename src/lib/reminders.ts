export type ReminderKind = "meeting" | "report" | "other";

export type Reminder = {
  id: string;
  kind: ReminderKind;
  title: string;
  eventTime: number;
  leadMinutes: number;
  fireAt: number;
  createdAt: number;
};

export const REMINDER_KIND_LABEL: Record<ReminderKind, string> = {
  meeting: "Meeting",
  report: "Report",
  other: "Other",
};

export const LEAD_OPTIONS_MINUTES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

export const MAX_PENDING = 10;

const STORAGE_KEY = "quantessa.reminders.v1";

let swRegistration: ServiceWorkerRegistration | null = null;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();
let fallbackNotifier: ((reminder: Reminder) => void) | null = null;

export function setFallbackNotifier(fn: ((reminder: Reminder) => void) | null) {
  fallbackNotifier = fn;
}

export function subscribeToReminders(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const listener of listeners) listener();
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    swRegistration =
      swRegistration ?? (await navigator.serviceWorker.register("/sw.js"));
    return swRegistration;
  } catch {
    return null;
  }
}

export function loadReminders(): Reminder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isReminder);
  } catch {
    return [];
  }
}

function isReminder(value: unknown): value is Reminder {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    (item.kind === "meeting" ||
      item.kind === "report" ||
      item.kind === "other") &&
    typeof item.title === "string" &&
    typeof item.eventTime === "number" &&
    typeof item.leadMinutes === "number" &&
    typeof item.fireAt === "number"
  );
}

function saveReminders(list: Reminder[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getNotificationState():
  | { supported: true; permission: NotificationPermission }
  | { supported: false } {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return { supported: false };
  }
  return { supported: true, permission: Notification.permission };
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export type CreateReminderInput = {
  kind: ReminderKind;
  title: string;
  eventTime: number;
  leadMinutes: number;
};

export type CreateReminderResult =
  | { ok: true; reminder: Reminder }
  | { ok: false; reason: string };

export async function createReminder(
  input: CreateReminderInput
): Promise<CreateReminderResult> {
  const cleanTitle = input.title.trim() || "Reminder";
  const fireAt = input.eventTime - input.leadMinutes * 60_000;
  const now = Date.now();

  if (!LEAD_OPTIONS_MINUTES.includes(input.leadMinutes)) {
    return { ok: false, reason: "Choose a lead time between 5 and 60 minutes." };
  }
  if (input.eventTime <= now) {
    return { ok: false, reason: "Pick an event time in the future." };
  }
  if (fireAt <= now) {
    return {
      ok: false,
      reason:
        "The event is too soon for that lead time — shorten the lead or move the event later.",
    };
  }

  const pending = loadReminders();
  if (pending.length >= MAX_PENDING) {
    return {
      ok: false,
      reason: `You already have ${MAX_PENDING} pending reminders — finish or remove one first.`,
    };
  }

  const reminder: Reminder = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    title: cleanTitle,
    eventTime: input.eventTime,
    leadMinutes: input.leadMinutes,
    fireAt,
    createdAt: now,
  };

  pending.push(reminder);
  saveReminders(pending);
  scheduleTimer(reminder);
  emit();
  return { ok: true, reminder };
}

export function cancelReminder(id: string) {
  const next = loadReminders().filter((reminder) => reminder.id !== id);
  saveReminders(next);
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  emit();
}

export function syncReminders() {
  const pending = loadReminders();
  const missed: Reminder[] = [];
  const future: Reminder[] = [];

  for (const reminder of pending) {
    if (reminder.fireAt <= Date.now()) {
      missed.push(reminder);
    } else {
      future.push(reminder);
      scheduleTimer(reminder);
    }
  }

  if (missed.length > 0) {
    saveReminders(future);
    for (const reminder of missed) {
      void showOrFallback(reminder, true);
    }
    emit();
  }
}

function scheduleTimer(reminder: Reminder) {
  const existing = timers.get(reminder.id);
  if (existing) clearTimeout(existing);

  const remaining = reminder.fireAt - Date.now();
  if (remaining <= 0) return;

  const timer = setTimeout(() => {
    timers.delete(reminder.id);
    const after = loadReminders().filter((item) => item.id !== reminder.id);
    saveReminders(after);
    emit();
    void showOrFallback(reminder, false);
  }, Math.min(remaining, 2_147_000_000));

  timers.set(reminder.id, timer);
}

async function showOrFallback(reminder: Reminder, missed: boolean) {
  const notificationState = getNotificationState();
  if (notificationState.supported && notificationState.permission === "granted") {
    const shown = await showNotification(reminder, missed);
    if (shown) return;
  }
  fallbackNotifier?.(reminder);
}

async function showNotification(
  reminder: Reminder,
  missed: boolean
): Promise<boolean> {
  const eventLabel = formatEventTime(reminder.eventTime);
  const title = `Reminder · ${reminder.title}`;
  const options: NotificationOptions = {
    body: missed
      ? `Missed while the app was closed — ${REMINDER_KIND_LABEL[reminder.kind].toLowerCase()} at ${eventLabel}`
      : `${REMINDER_KIND_LABEL[reminder.kind]} at ${eventLabel} — in ${reminder.leadMinutes} minutes.`,
    tag: `quantessa-${reminder.id}`,
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: { url: "/" },
  };

  try {
    if (swRegistration) {
      await swRegistration.showNotification(title, options);
      return true;
    }
  } catch {
    /* fall through to inline notification */
  }

  try {
    const notification = new Notification(title, options);
    notification.onclick = () => window.focus();
    return true;
  } catch {
    return false;
  }
}

export function formatEventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}