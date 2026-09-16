import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type MessageRole = "user" | "assistant";

type MessageBubbleProps = {
  role: MessageRole;
  content: string;
  streaming?: boolean;
};

export function MessageBubble({ role, content, streaming }: MessageBubbleProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#1e1b3a] px-4 py-2.5 text-[15px] leading-relaxed text-white">
          {content}
        </div>
      </div>
    );
  }

  const markdown = content.replace(/<br\s*\/?>/gi, "  \n");

  return (
    <div className="flex max-w-[85%] flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a1a1b1]">
        Quantessa
      </span>
      <div className="rounded-2xl border border-[#e9e8f2] bg-[#fbfbfd] px-5 py-4">
        <div className="markdown text-[15px] leading-relaxed text-[#242338]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
        {streaming && (
          <span
            className="mt-2 flex items-center gap-1"
            aria-label="Quantessa is thinking"
          >
            <span className="size-1 animate-pulse rounded-full bg-[#8a879e]" />
            <span className="size-1 animate-pulse rounded-full bg-[#8a879e] [animation-delay:150ms]" />
            <span className="size-1 animate-pulse rounded-full bg-[#8a879e] [animation-delay:300ms]" />
          </span>
        )}
      </div>
    </div>
  );
}