"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  ArrowUpRight,
  Bell,
  Building2,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  LockKeyhole,
} from "lucide-react";
import { MessageList, type DisplayMessage } from "@/components/MessageList";
import { ChatInput } from "@/components/ChatInput";
import { UsageBadge, type TokenUsage } from "@/components/UsageBadge";
import { QuantessaMark } from "@/components/QuantessaMark";
import { ReportDialog } from "@/components/ReportDialog";
import { ReminderDialog } from "@/components/ReminderDialog";
import {
  ensureServiceWorker,
  loadReminders,
  setFallbackNotifier,
  subscribeToReminders,
  syncReminders,
  type Reminder,
} from "@/lib/reminders";

const divisions = [
  "Marketing",
  "Finance",
  "Sales",
  "Operations",
  "HR",
  "Design",
  "IT / Engineering",
  "Product",
  "Other",
];

const COMPANY = "PT Quanta Land Indonesia";

function toFileList(files: File[]): FileList {
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  return transfer.files;
}

function quietlySwallow(promise: Promise<void>) {
  promise.catch(() => {
    /* errors are surfaced via useChat's `error` state and the inline retry UI */
  });
}

function isHarmlessRejection(reason: unknown): boolean {
  if (reason instanceof DOMException && reason.name === "AbortError") return true;
  return reason != null && typeof reason === "object";
}

function installRejectionGuard() {
  const handler = (event: PromiseRejectionEvent) => {
    /* Stream cancel/abort artifacts are expected — keep them out of the
       global error surface (which Next's devtools also listens to). */
    if (isHarmlessRejection(event.reason)) {
      event.preventDefault();
    }
  };
  window.addEventListener("unhandledrejection", handler);
  return () => window.removeEventListener("unhandledrejection", handler);
}

function getTextContent(message: {
  parts?: Array<{ type: string; text?: string }>;
}): string {
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");
  }
  return "";
}

function extractUsage(metadata: unknown): TokenUsage | null {
  if (metadata == null || typeof metadata !== "object") return null;
  const obj = metadata as Record<string, unknown>;
  if (obj.usage != null && typeof obj.usage === "object") {
    return obj.usage as TokenUsage;
  }
  return null;
}

function Gate({
  name,
  setName,
  division,
  setDivision,
  view,
  submitted,
  onSubmit,
  onEnter,
}: {
  name: string;
  setName: (value: string) => void;
  division: string;
  setDivision: (value: string) => void;
  view: "gate" | "chat";
  submitted: boolean;
  onSubmit: () => void;
  onEnter: boolean;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f8fc] px-5 py-10 text-[#151526] sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-300px] size-[700px] -translate-x-1/2 rounded-full bg-[#dcd8fb]/40 blur-3xl"
      />
      <div className="relative w-full max-w-[470px]">
        <div className="mb-8 text-center">
          <div className="text-[30px] font-bold tracking-[-0.06em] text-[#1b1a2d]">
            Quantessa
          </div>
          <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.32em] text-[#a09dae]">
            Full AI Adapted
          </div>
        </div>
        <div className="rounded-[26px] border border-[#e8e8f0] bg-white p-7 shadow-[0_25px_70px_rgba(42,38,93,0.09)] sm:p-10">
          <div className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#8677cf]">
              Private workspace
            </p>
            <h1 className="text-[29px] font-semibold leading-tight tracking-[-0.045em] text-[#1b1a2d]">
              Let&apos;s get to know you.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#858498]">
              Tell us who you are so we can personalize your session.
            </p>
          </div>
          <div className="mb-7 flex gap-3 rounded-2xl border border-[#ebeaf2] bg-[#fcfcfe] p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#efedff] text-[#7666d7]">
              <Building2 data-icon="inline-start" />
            </div>
            <div className="min-w-0 text-sm">
              <div className="font-semibold text-[#2a2940]">
                Kota Innovista{" "}
                <span className="font-normal text-[#aaa8b7]">· Quantaland</span>
              </div>
              <div className="mt-1 text-xs text-[#9290a2]">
                Real Estate / Industrial Estate{" "}
                <span className="mx-1 text-[#cac8d2]">·</span> Cikande, Banten
              </div>
            </div>
          </div>
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
            noValidate
          >
            <label className="flex flex-col gap-2 text-sm font-medium text-[#45445a]">
              Division / Department
              <div className="relative">
                <select
                  value={division}
                  onChange={(event) => setDivision(event.target.value)}
                  className={`h-12 w-full appearance-none rounded-xl border bg-white px-4 pr-11 text-sm outline-none transition focus:border-[#8c7ae5] focus:ring-4 focus:ring-[#8c7ae51a] ${
                    division ? "text-[#242338]" : "text-[#b2b1bf]"
                  } ${
                    submitted && !division
                      ? "border-[#d96b76]"
                      : "border-[#e5e4ec]"
                  }`}
                >
                  <option value="" disabled>
                    Select your division
                  </option>
                  {divisions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#9694a8]"
                />
              </div>
              {submitted && !division && (
                <span className="text-xs font-normal text-[#c75866]">
                  Please select your division.
                </span>
              )}
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[#45445a]">
              Your name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Faris"
                className={`h-12 rounded-xl border bg-white px-4 text-sm text-[#242338] outline-none transition placeholder:text-[#b2b1bf] focus:border-[#8c7ae5] focus:ring-4 focus:ring-[#8c7ae51a] ${
                  submitted && !name.trim()
                    ? "border-[#d96b76]"
                    : "border-[#e5e4ec]"
                }`}
              />
              {submitted && !name.trim() && (
                <span className="text-xs font-normal text-[#c75866]">
                  Please enter your name.
                </span>
              )}
            </label>
            <button
              type="submit"
              className="mt-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#655be0] to-[#9270e9] text-sm font-semibold text-white shadow-[0_8px_20px_rgba(113,92,222,0.22)] transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={view === "chat" || !onEnter}
            >
              Enter Quantessa <ArrowUpRight data-icon="inline-end" />
            </button>
          </form>
          <div className="mt-7 flex items-center justify-center gap-2 text-[11px] text-[#aaa8b7]">
            <LockKeyhole data-icon="inline-start" /> Your information stays
            within your workspace.
          </div>
        </div>
        <p className="mt-6 text-center text-[11px] text-[#aaa8b7]">
          Powered by Quantessa AI
        </p>
      </div>
    </main>
  );
}

export default function ChatPage() {
  const [name, setName] = useState("");
  const [division, setDivision] = useState("");
  const [view, setView] = useState<"gate" | "chat">("gate");
  const [submitted, setSubmitted] = useState(false);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const { messages, sendMessage, status, stop, error, regenerate } = useChat();

  const [reportOpen, setReportOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [fallbackToast, setFallbackToast] = useState<Reminder | null>(null);
  useEffect(() => installRejectionGuard(), []);

  useEffect(() => {
    const unsubscribe = subscribeToReminders(() => {
      setReminders(loadReminders());
    });
    setReminders(loadReminders());
    setFallbackNotifier((reminder) => setFallbackToast(reminder));
    void ensureServiceWorker().then(() => syncReminders());
    return () => {
      unsubscribe();
      setFallbackNotifier(null);
    };
  }, []);

  useEffect(() => {
    if (fallbackToast === null) return;
    const timer = setTimeout(() => setFallbackToast(null), 6000);
    return () => clearTimeout(timer);
  }, [fallbackToast]);

  const isStreaming = status === "streaming" || status === "submitted";
  const isReady = Boolean(name.trim() && division);

  const handleSubmit = () => {
    setSubmitted(true);
    if (name.trim() && division) setView("chat");
  };

  const displayMessages: DisplayMessage[] = messages.map(
    (message, index) => ({
      id: message.id,
      role: message.role === "user" ? ("user" as const) : ("assistant" as const),
      content: getTextContent(message),
      streaming:
        message.role === "assistant" &&
        index === messages.length - 1 &&
        isStreaming,
    })
  );

  const lastAssistantMessage =
    [...messages].reverse().find((m) => m.role === "assistant") ?? null;
  const usage = lastAssistantMessage
    ? extractUsage(lastAssistantMessage.metadata)
    : null;

  const empty = messages.length === 0;
  const hasError = Boolean(error);

  const lastMessage = messages[messages.length - 1] ?? null;
  const thinkingActive =
    isStreaming && (lastMessage === null || lastMessage.role !== "assistant");

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (empty) return;
    const node = listRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [displayMessages.length, thinkingActive, empty]);

  if (view === "gate") {
    return (
      <Gate
        name={name}
        setName={setName}
        division={division}
        setDivision={setDivision}
        view={view}
        submitted={submitted}
        onSubmit={handleSubmit}
        onEnter={isReady}
      />
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-[#f7f8fc] text-[#151526]">
      <header className="flex shrink-0 items-center justify-between border-b border-[#eeeeF4] px-6 py-5 sm:px-10">
        <div>
          <div className="text-xl font-bold tracking-[-0.04em] text-[#19192a]">
            Quantessa
          </div>
          <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#a1a1b1]">
            Full AI Adapted
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReminderOpen(true)}
            aria-label={`Reminders (${reminders.length} pending)`}
            className="relative flex items-center gap-1.5 rounded-full border border-[#e9e8f2] bg-[#fafafe] px-3 py-2 text-xs text-[#67677b] transition hover:border-[#d9d4f5] hover:text-[#5a4bc0]"
          >
            <Bell className="size-3.5" /> Reminders
            {reminders.length > 0 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-[#7666d7] text-[9px] font-semibold text-white">
                {reminders.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-[#e9e8f2] bg-[#fafafe] px-3 py-2 text-xs text-[#67677b] transition hover:border-[#d9d4f5] hover:text-[#5a4bc0]"
          >
            <CircleAlert className="size-3.5" /> Report
          </button>
          <div className="flex items-center gap-2 rounded-full border border-[#e9e8f2] bg-[#fafafe] px-3 py-2 text-xs text-[#67677b]">
            <span className="size-2 rounded-full bg-[#7c63e8]" />
            {name} · {division}
          </div>
        </div>
      </header>

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        userName={name}
        division={division}
        company={COMPANY}
      />

      <ReminderDialog
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        reminders={reminders}
      />

      <section className="flex flex-1 flex-col justify-between overflow-hidden px-6 pt-10 sm:px-10 sm:pt-14">
        {empty ? (
          <div className="flex flex-1 flex-col justify-center">
            <div className="mx-auto w-full max-w-2xl">
              <div className="mb-5">
                <QuantessaMark />
              </div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#8a879e]">
                Your Quantessa workspace
              </p>
              <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.05em] text-[#19192a] sm:text-5xl">
                Welcome, {name}.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[#77768b]">
                I&apos;m ready to help your {division.toLowerCase()} team move
                from questions to clear next steps — research, drafting,
                analysis, proposals, reports, and everyday work.
              </p>
              <div className="mt-8 flex items-center gap-2 text-sm text-[#8a879e]">
                <CircleCheck className="text-[#7b65e8]" /> Your profile is set
                up
              </div>
            </div>
          </div>
        ) : (
          <div ref={listRef} className="flex-1 overflow-y-auto">
            <MessageList
              messages={displayMessages}
              thinking={thinkingActive}
            />
          </div>
        )}

        <div className="mt-10 shrink-0 pb-6">
          {hasError && (
            <div className="mb-3 flex items-center justify-center gap-3 text-xs text-[#c75866]">
              <span>Something went wrong while answering.</span>
              <button
                onClick={() => quietlySwallow(regenerate())}
                className="rounded-lg border border-[#d96b76] px-2.5 py-1 font-medium transition hover:bg-[#d96b76]/10"
              >
                Try again
              </button>
            </div>
          )}
          <UsageBadge usage={usage} />
          <div className="mt-2">
            <ChatInput
              value={input}
              onChange={setInput}
onSend={() => {
                  if ((!input.trim() && files.length === 0) || isStreaming) return;
                  quietlySwallow(
                    sendMessage(
                      { text: input, files: toFileList(files) },
                      {
                        body: {
                          userName: name.trim() || undefined,
                          division,
                        },
                      }
                    )
                  );
                  setInput("");
                  setFiles([]);
                }}
                onStop={stop}
                isStreaming={isStreaming}
                files={files}
                onFilesChange={setFiles}
              />
          </div>
        </div>
      </section>

      {fallbackToast && (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-2xl border border-[#dfe8dd] bg-[#f3f8f2] px-4 py-3 text-center text-xs text-[#2f5a2c] shadow-lg shadow-[#151526]/10">
          <Bell className="mx-auto mb-1 size-4" />
          <p className="font-semibold">{fallbackToast.title}</p>
          <p className="mt-0.5 text-[11px] text-[#6b8f68]">
            Reminder here on-screen — enable OS notifications for a native
            alert.
          </p>
        </div>
      )}
    </main>
  );
}