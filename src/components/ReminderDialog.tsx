"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Clock, Trash2, X } from "lucide-react";
import {
  createReminder,
  cancelReminder,
  getNotificationState,
  LEAD_OPTIONS_MINUTES,
  REMINDER_KIND_LABEL,
  requestNotificationPermission,
  type Reminder,
  type ReminderKind,
} from "@/lib/reminders";

type ReminderDialogProps = {
  open: boolean;
  onClose: () => void;
  reminders: Reminder[];
};

const kinds: ReminderKind[] = ["meeting", "report", "other"];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a879e]">
      {children}
    </label>
  );
}

function inputBaseClass(hasError: boolean) {
  return `w-full rounded-xl border bg-[#fafafe] px-3.5 py-2.5 text-sm text-[#151526] outline-none transition placeholder:text-[#aaa9ba] focus:border-[#7666d7] ${
    hasError ? "border-[#e3b3b9]" : "border-[#e9e8f2]"
  }`;
}

export function ReminderDialog({ open, onClose, reminders }: ReminderDialogProps) {
  const [kind, setKind] = useState<ReminderKind>("meeting");
  const [title, setTitle] = useState("");
  const [eventValue, setEventValue] = useState("");
  const [leadMinutes, setLeadMinutes] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<ReturnType<typeof getNotificationState>>(
    getNotificationState
  );

  const defaultEventValue = useMemo(() => {
    const base = new Date(Date.now() + 60 * 60 * 1000);
    base.setSeconds(0, 0);
    base.setMinutes(Math.ceil(base.getMinutes() / 5) * 5);
    return toLocalInputValue(base);
  }, []);

  useEffect(() => {
    if (!open) return;
    setKind("meeting");
    setTitle("");
    setEventValue(defaultEventValue);
    setLeadMinutes(10);
    setError(null);
    setBusy(false);
    setPermission(getNotificationState());
  }, [open, defaultEventValue]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const toTimestamp = (localValue: string) =>
    localValue ? new Date(localValue).getTime() : NaN;

  const handleCreate = async () => {
    setError(null);
    const eventTime = toTimestamp(eventValue);
    if (!Number.isFinite(eventTime)) {
      setError("Pick the date and time of the meeting, report, or task.");
      return;
    }
    setBusy(true);
    try {
      const result = await createReminder({
        kind,
        title: title || REMINDER_KIND_LABEL[kind],
        eventTime,
        leadMinutes,
      });
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      setTitle("");
      setEventValue("");
    } finally {
      setBusy(false);
    }
  };

  const handleEnable = async () => {
    await requestNotificationPermission();
    setPermission(getNotificationState());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#151526]/40 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Set a reminder"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[#e9e8f2] bg-[#fbfbfd] shadow-2xl shadow-[#151526]/20"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#efeef6] px-6 py-4">
          <div>
            <div className="text-base font-semibold tracking-[-0.02em] text-[#19192a]">
              Reminder
            </div>
            <div className="mt-0.5 text-xs text-[#8a879e]">
              One-time automation · saved on this device · auto-removed after it fires
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full text-[#9694a8] transition hover:bg-[#efedff] hover:text-[#7666d7]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {permission.supported && permission.permission === "granted" ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#dfe8dd] bg-[#f3f8f2] px-3.5 py-2.5 text-xs text-[#3c6a38]">
              <BellRing className="size-3.5 shrink-0" />
              Notifications are enabled on this device.
            </div>
          ) : permission.supported && permission.permission === "denied" ? (
            <div className="mb-4 rounded-xl border border-[#f3d0d4] bg-[#fdf3f4] px-3.5 py-2.5 text-xs text-[#c75866]">
              Notifications are blocked in this browser. Allow them for
              quantessa so reminders can be delivered.
            </div>
          ) : !permission.supported ? (
            <div className="mb-4 rounded-xl border border-[#f3d0d4] bg-[#fdf3f4] px-3.5 py-2.5 text-xs text-[#c75866]">
              Notifications are not supported here. On iOS, add Quantessa to
              your Home Screen first, then come back.
            </div>
          ) : (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => void handleEnable()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#7666d7] bg-[#efedff] px-3.5 py-2.5 text-xs font-medium text-[#5a4bc0] transition hover:bg-[#e6e2ff]"
              >
                <BellRing className="size-3.5" /> Enable notifications on this
                device
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div>
              <FieldLabel>What to remind</FieldLabel>
              <div className="flex gap-2">
                {kinds.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setKind(item)}
                    className={
                      kind === item
                        ? "rounded-full border border-[#7666d7] bg-[#efedff] px-3.5 py-1.5 text-xs font-medium text-[#5a4bc0]"
                        : "rounded-full border border-[#e9e8f2] bg-[#fafafe] px-3.5 py-1.5 text-xs text-[#67677b] transition hover:border-[#d9d4f5]"
                    }
                  >
                    {REMINDER_KIND_LABEL[item]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel>Description</FieldLabel>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={
                  kind === "meeting"
                    ? "e.g. Weekly team meeting"
                    : kind === "report"
                      ? "e.g. Submit monthly report"
                      : "e.g. Follow up with client"
                }
                className={inputBaseClass(false)}
              />
            </div>

            <div>
              <FieldLabel>Event date &amp; time</FieldLabel>
              <input
                type="datetime-local"
                value={eventValue}
                min={toLocalInputValue(new Date(Date.now() + 5 * 60 * 1000))}
                onChange={(event) => setEventValue(event.target.value)}
                className={inputBaseClass(Boolean(error))}
              />
            </div>

            <div>
              <FieldLabel>Remind me</FieldLabel>
              <select
                value={leadMinutes}
                onChange={(event) => setLeadMinutes(Number(event.target.value))}
                className={inputBaseClass(false)}
              >
                {[...LEAD_OPTIONS_MINUTES].reverse().map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes before
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs leading-relaxed text-[#c75866]">{error}</p>
          )}

          <div className="mt-4">
            <FieldLabel>Pending ({reminders.length})</FieldLabel>
            {reminders.length === 0 ? (
              <p className="text-xs text-[#aaa9ba]">
                No pending reminders. Create one above — it fires once, then
                disappears automatically.
              </p>
            ) : (
              <ul className="space-y-2">
                {reminders.map((reminder) => (
                  <li
                    key={reminder.id}
                    className="flex items-center gap-3 rounded-xl border border-[#e9e8f2] bg-[#fafafe] px-3.5 py-2.5"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#efedff] text-[#7666d7]">
                      <Clock className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-[#242338]">
                        {reminder.title}
                      </p>
                      <p className="text-[11px] text-[#8a879e]">
                        {REMINDER_KIND_LABEL[reminder.kind]} · fires at{" "}
                        {formatFire(reminder)} · {reminder.leadMinutes} min
                        before
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Cancel ${reminder.title}`}
                      onClick={() => cancelReminder(reminder.id)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-[#a1a1b1] transition hover:bg-[#fdf3f4] hover:text-[#c75866]"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="border-t border-[#efeef6] px-6 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleCreate()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e1b3a] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#322d5b] disabled:opacity-60"
          >
            <BellRing className="size-4" /> Set reminder
          </button>
          <p className="mt-2 text-center text-[11px] text-[#a1a1b1]">
            PoC automation #1 — temporary one-time reminder, stored only on this
            device.
          </p>
        </div>
      </div>
    </div>
  );
}

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function formatFire(reminder: Reminder): string {
  return new Date(reminder.fireAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}