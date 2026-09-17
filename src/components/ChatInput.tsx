"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  FileText,
  Image,
  Paperclip,
  Send,
  UploadCloud,
  X,
} from "lucide-react";

const ACCEPTED_TYPES = [
  "text/plain",
  "text/csv",
  "application/json",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");

export const MAX_ATTACHMENTS = 5;

const MAX_NON_IMAGE_BYTES = 3_000_000;

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  onStop: () => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FormatIcon({ type }: { type: string }) {
  return type.startsWith("image/") ? <Image className="size-3.5" /> : <FileText className="size-3.5" />;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  isStreaming,
  onStop,
  files,
  onFilesChange,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [rejectedFiles, setRejectedFiles] = useState<string[]>([]);

  useEffect(() => {
    if (rejectedFiles.length === 0) return;
    const timer = setTimeout(() => setRejectedFiles([]), 5000);
    return () => clearTimeout(timer);
  }, [rejectedFiles]);

  const addFiles = (incoming: FileList | File[]) => {
    const next = [...files];
    const rejected: string[] = [];
    for (const file of Array.from(incoming)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        rejected.push(file.name);
        continue;
      }
      if (next.length >= MAX_ATTACHMENTS) {
        rejected.push(file.name);
        continue;
      }
      if (!file.type.startsWith("image/") && file.size > MAX_NON_IMAGE_BYTES) {
        rejected.push(file.name);
        continue;
      }
      if (
        !next.some(
          (existing) =>
            existing.name === file.name && existing.size === file.size
        )
      ) {
        next.push(file);
      }
    }
    onFilesChange(next);
    if (rejected.length > 0) setRejectedFiles(rejected);
  };

  const handleDropZone = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);
    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length > 0) addFiles(dropped);
  };

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    if (!event.dataTransfer.types.includes("Files")) return;
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    const images = Array.from(event.clipboardData.items)
      .filter(
        (item) => item.kind === "file" && item.type.startsWith("image/")
      )
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (images.length === 0) return;
    event.preventDefault();
    addFiles(images);
  };

  return (
    <div
      className="group relative mx-auto w-full max-w-5xl"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDropZone}
    >
      {rejectedFiles.length > 0 && (
        <div
          role="status"
          className="mb-2 flex items-center gap-2 rounded-lg border border-[#f3d0d4] bg-[#fdf3f4] px-3 py-2 text-xs text-[#c75866]"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          <span>
            {rejectedFiles.length === 1
              ? `"${rejectedFiles[0]}" is not a supported file.`
              : "Some files are not supported: "}
            {rejectedFiles.length > 1 &&
              rejectedFiles.slice(0, 2).map((name) => `"${name}"`).join(", ") +
                (rejectedFiles.length > 2
                  ? ` +${rejectedFiles.length - 2} more`
                  : "")}
            {" "}Accepted: PDF, DOCX, TXT, CSV, or images (JPG, PNG, WebP, GIF) up to{" "}
            {MAX_ATTACHMENTS} files — documents up to 3 MB; photos auto-compress.
          </span>
        </div>
      )}

      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {files.map((file) => (
            <span
              key={`${file.name}-${file.size}`}
              className="flex items-center gap-1.5 rounded-lg border border-[#e9e8f2] bg-[#fbfbfd] px-2.5 py-1.5 text-xs text-[#67677b]"
            >
              <FormatIcon type={file.type} />
              <span className="max-w-[160px] truncate font-medium text-[#242338]">
                {file.name}
              </span>
              <span className="text-[#a1a1b1]">{formatBytes(file.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() =>
                  onFilesChange(files.filter((existing) => existing !== file))
                }
                className="ml-0.5 rounded p-0.5 text-[#a1a1b1] transition hover:bg-[#efedff] hover:text-[#7666d7]"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {isDragging && (
        <div className="pointer-events-none absolute inset-0 -mt-1 flex items-center justify-center rounded-2xl border-2 border-dashed border-[#7666d7] bg-[#7666d7]/5">
          <span className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-[#7666d7] shadow-sm">
            <UploadCloud className="size-4" />
            Drop files to attach
          </span>
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (isStreaming) {
            onStop();
          } else if (value.trim() || files.length > 0) {
            onSend();
          }
        }}
        className={`flex items-center gap-2 rounded-2xl border bg-[#fbfbfd] p-2 shadow-sm transition-colors ${
          isDragging
            ? "border-[#7666d7] ring-2 ring-[#7666d7]/15"
            : "border-[#e9e8f2]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          aria-label="Attach files (PDF, DOCX, TXT, CSV, or images)"
          onClick={() => fileInputRef.current?.click()}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[#9694a8] transition hover:bg-[#efedff] hover:text-[#7666d7]"
        >
          <Paperclip className="size-4" />
        </button>
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onPaste={handlePaste}
          placeholder="Ask Quantessa anything..."
          aria-label="Ask Quantessa anything"
          className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-[#151526] outline-none placeholder:text-[#aaa9ba]"
        />
        <button
          type="submit"
          aria-label={isStreaming ? "Stop response" : "Send message"}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#1e1b3a] text-white transition hover:bg-[#322d5b] disabled:opacity-50"
          disabled={!isStreaming && !value.trim() && files.length === 0}
        >
          {isStreaming ? <StopIcon /> : <Send data-icon="inline-start" />}
        </button>
      </form>
      <p className="mt-1.5 text-center text-[10px] uppercase tracking-[0.18em] text-[#aaa9ba]">
        Drag &amp; drop files here &nbsp;·&nbsp; up to {MAX_ATTACHMENTS} per message
      </p>
    </div>
  );
}

function StopIcon() {
  return <span className="block size-3.5 rounded-[3px] bg-white" />;
}