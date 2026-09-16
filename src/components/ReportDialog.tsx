"use client";

import { useEffect, useState } from "react";
import { FileImage, Send, Trash2, X } from "lucide-react";

type ReportDialogProps = {
  open: boolean;
  onClose: () => void;
  userName: string;
  division: string;
  company: string;
};

const reportTypes = [
  { id: "bug", label: "Bug / Error" },
  { id: "suggestion", label: "Suggestion / Feedback" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a879e]">
      {children}
    </label>
  );
}

function ReadOnlyInput({ value }: { value: string }) {
  return (
    <input
      type="text"
      value={value}
      readOnly
      className="w-full rounded-xl border border-[#e9e8f2] bg-[#f4f5fb] px-3.5 py-2.5 text-sm text-[#151526] outline-none"
    />
  );
}

export function ReportDialog({ open, onClose, userName, division, company }: ReportDialogProps) {
  const [reportType, setReportType] = useState("bug");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReportType("bug");
    setDescription("");
    setScreenshot(null);
    setPreviewUrl(null);
  }, [open]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const pickScreenshot = (file: File | undefined) => {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setScreenshot(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#151526]/40 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Report a bug or suggestion"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[#e9e8f2] bg-[#fbfbfd] shadow-2xl shadow-[#151526]/20"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#efeef6] px-6 py-4">
          <div>
            <div className="text-base font-semibold tracking-[-0.02em] text-[#19192a]">
              Report
            </div>
            <div className="mt-0.5 text-xs text-[#8a879e]">
              Report bugs, suggestions, or feedback to the AI team
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full text-[#9694a8] transition hover:bg-[#efedff] hover:text-[#7666d7]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Name</FieldLabel>
              <ReadOnlyInput value={userName || "—"} />
            </div>
            <div>
              <FieldLabel>Divisi / Department</FieldLabel>
              <ReadOnlyInput value={division || "—"} />
            </div>
            <div className="col-span-2">
              <FieldLabel>Company</FieldLabel>
              <ReadOnlyInput value={company} />
            </div>
          </div>

          <div className="mt-5">
            <FieldLabel>Report type</FieldLabel>
            <div className="flex gap-2">
              {reportTypes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setReportType(item.id)}
                  className={
                    reportType === item.id
                      ? "rounded-full border border-[#7666d7] bg-[#efedff] px-3.5 py-1.5 text-xs font-medium text-[#5a4bc0]"
                      : "rounded-full border border-[#e9e8f2] bg-[#fafafe] px-3.5 py-1.5 text-xs text-[#67677b] transition hover:border-[#d9d4f5]"
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <FieldLabel>Describe the issue / feedback</FieldLabel>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              placeholder="Tell us what happened, the steps you took, and what you expected…"
              className="w-full resize-none rounded-xl border border-[#e9e8f2] bg-[#fafafe] px-3.5 py-3 text-sm leading-relaxed text-[#151526] outline-none transition placeholder:text-[#aaa9ba] focus:border-[#7666d7]"
            />
          </div>

          <div className="mt-5">
            <FieldLabel>Screenshot (opsional)</FieldLabel>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="report-screenshot"
              onChange={(event) => pickScreenshot(event.target.files?.[0])}
            />
            {screenshot && previewUrl ? (
              <div className="flex items-center gap-3 rounded-xl border border-[#e9e8f2] bg-[#fafafe] p-2.5">
                <img
                  src={previewUrl}
                  alt="Screenshot preview"
                  className="size-16 shrink-0 rounded-lg border border-[#e9e8f2] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[#242338]">
                    {screenshot.name}
                  </p>
                  <p className="text-[11px] text-[#a1a1b1]">
                    {(screenshot.size / 1024).toFixed(0)} KB · ready to attach
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (previewUrl) URL.revokeObjectURL(previewUrl);
                      setScreenshot(null);
                      setPreviewUrl(null);
                    }}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[#c75866] transition hover:underline"
                  >
                    <Trash2 className="size-3" /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  document.getElementById("report-screenshot")?.click()
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#d9d4f5] bg-[#fafafe] px-3.5 py-4 text-xs font-medium text-[#7666d7] transition hover:border-[#7666d7] hover:bg-[#f6f4ff]"
              >
                <FileImage className="size-4" /> Add screenshot
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-[#efeef6] px-6 py-4">
          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e1b3a] px-4 py-3 text-sm font-medium text-white opacity-60"
          >
            <Send className="size-4" /> Send report
          </button>
          <p className="mt-2 text-center text-[11px] text-[#a1a1b1]">
            Sending is not active yet — this UI lets you preview the flow
            before the feature ships.
          </p>
        </div>
      </div>
    </div>
  );
}