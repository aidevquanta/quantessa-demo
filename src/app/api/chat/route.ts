import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, type CoreMessage } from "ai";
import { getDefaultAgentConfig, MODEL_ENDPOINT } from "@/lib/agent/config";

export const maxDuration = 60;
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

const STALL_TIMEOUT = 45_000;

const encoder = new TextEncoder();

async function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number
): Promise<{ done: boolean; value: Uint8Array } | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const readPromise = reader.read().then(
    (result): { done: boolean; value: Uint8Array } =>
      result.done
        ? { done: true, value: new Uint8Array() }
        : { done: false, value: result.value ?? new Uint8Array() },
    () => ({ done: true, value: new Uint8Array() })
  );
  return Promise.race([
    readPromise,
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

function detectRateLimit(err: unknown): { resetAt: number } | null {
  if (err == null || typeof err !== "object") return null;

  const candidates: unknown[] = [];
  const anyErr = err as { errors?: unknown[] };
  if (Array.isArray(anyErr.errors)) candidates.push(...anyErr.errors);
  candidates.push(err);

  for (const candidate of candidates) {
    if (candidate == null || typeof candidate !== "object") continue;
    const item = candidate as {
      statusCode?: number;
      message?: string;
      responseBody?: string;
    };
    const isRateLimit =
      item.statusCode === 429 ||
      (typeof item.message === "string" &&
        /rate limit|free-models-per-day/i.test(item.message));
    if (!isRateLimit) continue;

    let resetAt = 0;
    if (typeof item.responseBody === "string") {
      try {
        const parsed = JSON.parse(item.responseBody) as {
          error?: { metadata?: { headers?: Record<string, string> } };
        };
        const reset = parsed.error?.metadata?.headers?.["X-RateLimit-Reset"];
        if (reset) resetAt = Number(reset);
      } catch {
        /* ignore unparseable bodies */
      }
    }
    return { resetAt: Number.isFinite(resetAt) && resetAt > 0 ? resetAt : 0 };
  }
  return null;
}

function buildRetryingResponse(
  system: string,
  messages: CoreMessage[],
  reqSignal?: AbortSignal | null
): Response {
  const abort = new AbortController();
  reqSignal?.addEventListener("abort", () => abort.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const enqueueText = (text: string) =>
        controller.enqueue(encoder.encode(text));

      let rateLimit: { resetAt: number } | null = null;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (abort.signal.aborted) {
          controller.close();
          return;
        }

        let resolveError: ((err: unknown) => void) | null = null;
        const errorSignal = new Promise<unknown>((resolve) => {
          resolveError = resolve;
        });
        const timeToError = () =>
          Promise.race([
            errorSignal,
            new Promise<undefined>((resolve) =>
              setTimeout(() => resolve(undefined), 6000)
            ),
          ]);

        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        let committed = false;
        let gracefulDone = false;
        let forcedEarly = false;
        let stalled = false;

        try {
          const result = streamText({
            model: openrouter(MODEL_ENDPOINT),
            system,
            messages,
            maxRetries: 1,
            onError: (err) => {
              const wrapped = err as { error?: unknown };
              resolveError?.(wrapped?.error ?? err);
            },
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

          reader = uiResponse.body!.getReader();
          const decoder = new TextDecoder();
          let pending = "";

          outer: while (true) {
            const frame = await readWithTimeout(reader!, STALL_TIMEOUT);
            if (frame === null) {
              stalled = true;
              await reader?.cancel().catch(() => {});
              break outer;
            }
            const { done, value } = frame;
            if (done) break;

            pending += decoder.decode(value, { stream: true });

            while (pending.includes("\n\n")) {
              const sep = pending.indexOf("\n\n");
              const rawEvent = pending.slice(0, sep);
              pending = pending.slice(sep + 2);
              const trimmed = rawEvent.trim();
              if (!trimmed.startsWith("data:")) continue;

              const payloadStr = trimmed.slice(5).trim();
              if (payloadStr === "[DONE]") continue;

              let payload: Record<string, unknown>;
              try {
                payload = JSON.parse(payloadStr);
              } catch {
                continue;
              }

              const isError =
                payload.type === "error" ||
                payload.finishReason === "error";

              if (isError) {
                if (committed) {
                  forcedEarly = true;
                  break outer;
                }
                const streamError = await timeToError();
                const captured = detectRateLimit(streamError);
                if (captured) {
                  rateLimit = captured;
                }
                break outer;
              }

              if (payload.type === "text-delta") committed = true;
              enqueueText(rawEvent + "\n\n");

              if (payload.type === "finish") {
                gracefulDone = true;
                break outer;
              }
            }
          }
        } catch (err) {
          if (!committed) {
            const streamError = await timeToError();
            const rateLimited =
              detectRateLimit(streamError) ?? detectRateLimit(err);
            if (rateLimited) {
              rateLimit = rateLimited;
              await reader?.cancel().catch(() => {});
            }
          }
          await reader?.cancel().catch(() => {});
          if (committed) forcedEarly = true;
        }

        if (stalled && committed) forcedEarly = true;

        if (rateLimit) break;
        if (stalled && !committed) break;

        if (forcedEarly) {
          enqueueText(
            `data: ${JSON.stringify({
              type: "text-delta",
              textDelta:
                "(Quantessa's connection dropped mid-answer — please send your message again in a moment.)",
            })}\n\ndata: ${JSON.stringify({
              type: "finish",
              finishReason: "stop",
            })}\n\ndata: [DONE]\n\n`
          );
          controller.close();
          return;
        }

        if (gracefulDone) {
          enqueueText(`data: [DONE]\n\n`);
          controller.close();
          return;
        }

        if (committed) {
          controller.close();
          return;
        }

        // No text committed and no rate limit — try the next attempt.
        await reader?.cancel().catch(() => {});
      }

const deliveredText = rateLimit
        ? "Quantessa is currently busy with too many users at once — please try again in a little while. This is a free-tier demo, so usage is limited each day."
        : "Quantessa is currently busy — please try again in a moment. This is a limited demo version, so responses may be slow or unavailable during peak usage.";

      const finishPart: Record<string, unknown> = {
        type: "finish",
        finishReason: "stop",
      };
      if (rateLimit) {
        finishPart.messageMetadata = {
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          rateLimitReset: rateLimit.resetAt,
        };
      }

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "text-delta",
            textDelta: deliveredText,
          })}\n\ndata: ${JSON.stringify(finishPart)}\n\ndata: [DONE]\n\n`
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

  return buildRetryingResponse(systemPrompt, coreMessages, req.signal);
}