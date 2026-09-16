import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, type CoreMessage } from "ai";
import { PDFParse } from "pdf-parse";
import { getDefaultAgentConfig, MODEL_ENDPOINT } from "@/lib/agent/config";

export const maxDuration = 30;

const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

type RawPart = {
  type?: string;
  text?: string;
  data?: string;
  url?: string;
  mediaType?: string;
  mimeType?: string;
  filename?: string;
};

type RawMessage = {
  role?: string;
  content?: string;
  parts?: RawPart[];
};

function decodeDataUrl(data: string): Buffer | null {
  if (!data.startsWith("data:")) return null;
  const comma = data.indexOf(",");
  if (comma === -1) return null;
  const base64 = data.slice(comma + 1);
  if (!base64) return null;
  return Buffer.from(base64, "base64");
}

function dataUrlOf(part: RawPart): string | undefined {
  return part.data ?? part.url;
}

async function extractTextFile(part: RawPart): Promise<string | null> {
  const source = dataUrlOf(part);
  if (!source) return null;
  const buffer = decodeDataUrl(source);
  if (!buffer) return null;

  const mime = (part.mediaType ?? part.mimeType ?? "").toLowerCase();

  try {
    if (mime === "text/plain" || mime === "text/csv" || mime === "application/json") {
      return buffer.toString("utf8");
    }
    if (mime === "application/pdf") {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return result.text?.trim() || null;
      } finally {
        await parser.destroy().catch(() => {});
      }
    }
    if (
      mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mod = await import("mammoth");
      const mammoth = (mod as { default?: typeof import("mammoth") }).default ?? mod;
      const result = await mammoth.extractRawText({ buffer });
      return result.value?.trim() || null;
    }
  } catch {
    return null;
  }
  return null;
}

async function toCoreMessages(rawMessages: RawMessage[]): Promise<CoreMessage[]> {
  const core: CoreMessage[] = [];

  for (const raw of rawMessages) {
    const role = raw.role === "assistant" ? "assistant" : "user";

    if (!Array.isArray(raw.parts) || raw.parts.length === 0) {
      core.push({ role, content: raw.content ?? "" });
      continue;
    }

    if (role === "assistant") {
      const text = raw.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join("");
      core.push({ role: "assistant", content: text || " " });
      continue;
    }

    const blocks: Array<{ type: "text"; text: string } | { type: "image"; image: string }> = [];
    const pendingText: string[] = [];

    const flushText = () => {
      const text = pendingText.filter((value) => value.trim()).join("\n");
      if (text) blocks.push({ type: "text", text });
      pendingText.length = 0;
    };

    for (const part of raw.parts) {
      if (part.type === "text") {
        pendingText.push(part.text ?? "");
      } else if (part.type === "file") {
        const source = dataUrlOf(part);
        const mime = (part.mediaType ?? part.mimeType ?? "").toLowerCase();
        const label = part.filename || "file";

        if (IMAGE_MIME_TYPES.includes(mime)) {
          flushText();
          if (source?.startsWith("data:")) {
            blocks.push({ type: "image", image: source });
          } else {
            pendingText.push(
              `\n\n[Attachment: ${label}] (could not read content)`
            );
          }
        } else {
          const extracted = await extractTextFile(part);
          pendingText.push(
            extracted
              ? `\n\n[Attachment: ${label}]\n${extracted}`
              : `\n\n[Attachment: ${label}] (could not read content)`
          );
        }
      }
    }

    flushText();
    core.push({ role: "user", content: blocks.length ? blocks : "" });
  }

  return core;
}

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: Request) {
  const { messages, division, userName } = await req.json();
  const { systemPrompt } = getDefaultAgentConfig({ division, userName });
  const coreMessages = await toCoreMessages(messages as RawMessage[]);

  const result = streamText({
    model: openrouter(MODEL_ENDPOINT),
    system: systemPrompt,
    messages: coreMessages,
    onFinish: ({ usage }) => {
      console.log(
        `[quantessa] request complete — input: ${usage.inputTokens} tokens, output: ${usage.outputTokens} tokens, total: ${usage.totalTokens} tokens`
      );
    },
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) =>
      part.type === "finish" && part.totalUsage
        ? { usage: part.totalUsage }
        : undefined,
  });
}