import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, type CoreMessage } from "ai";
import { getDefaultAgentConfig, MODEL_ENDPOINT } from "@/lib/agent/config";

export const maxDuration = 30;
export const runtime = "nodejs";

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
      const { PDFParse } = await import("pdf-parse");
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

const MAX_ATTEMPTS = 4;

const encoder = new TextEncoder();

function buildRetryingResponse(
  system: string,
  messages: CoreMessage[]
): Response {
  const abort = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (abort.signal.aborted) {
          controller.close();
          return;
        }

        const result = streamText({
          model: openrouter(MODEL_ENDPOINT),
          system,
          messages,
          maxRetries: 1,
          onFinish: ({ usage }) => {
            try {
              console.log(
                `[quantessa] attempt ${attempt} complete — input: ${usage.inputTokens} tokens, output: ${usage.outputTokens} tokens, total: ${usage.totalTokens} tokens`
              );
            } catch {
              /* log only */
            }
          },
        });

        const uiResponse = result.toUIMessageStreamResponse({
          messageMetadata: ({ part }) =>
            part.type === "finish" && part.totalUsage
              ? { usage: part.totalUsage }
              : undefined,
        });

        const reader = uiResponse.body!.getReader();
        const decoder = new TextDecoder();
        const buffered: Uint8Array[] = [];
        let scan = "";
        let textSeen = false;
        let sawError = false;
        let committed = false;
        let readerDone = false;
        let attemptError: unknown = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              readerDone = true;
              break;
            }

            buffered.push(value);

            if (!committed) {
              scan = (scan + decoder.decode(value, { stream: true })).slice(
                -2000
              );
              if (!sawError && /"type":"text-delta"/.test(scan)) {
                textSeen = true;
              }
              if (/\"type\":\"error\"/.test(scan) ||
                  /"finishReason":"error"/.test(scan)) {
                sawError = true;
              }
              if (textSeen && !sawError) {
                committed = true;
              }
            }

            if (committed) {
              for (const chunk of buffered) controller.enqueue(chunk);
              buffered.length = 0;
            }
          }

          if (committed || (!sawError && readerDone)) {
            for (const chunk of buffered) controller.enqueue(chunk);
            controller.close();
            return;
          }

          // Failed before any text — try the next attempt.
          await reader.cancel().catch(() => {});
        } catch (err) {
          attemptError = err;
          if (committed) {
            controller.error(err);
            return;
          }
          await reader.cancel().catch(() => {});
        }
      }

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "error",
            errorText:
              "The model provider is temporarily busy. Please try again in a moment.",
          })}\n\ndata: [DONE]\n\n`
        )
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  const { messages, division, userName } = await req.json();
  const { systemPrompt } = getDefaultAgentConfig({ division, userName });
  const coreMessages = await toCoreMessages(messages as RawMessage[]);

  return buildRetryingResponse(systemPrompt, coreMessages);
}