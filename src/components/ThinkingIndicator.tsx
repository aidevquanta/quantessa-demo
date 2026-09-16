export function ThinkingIndicator() {
  return (
    <div className="animate-fadeInUp flex max-w-[85%] flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a1a1b1]">
        Quantessa
      </span>
      <div className="flex items-center gap-3 rounded-2xl border border-[#e9e8f2] bg-[#fbfbfd] px-5 py-4">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 animate-quantessaBounce rounded-full bg-[#7666d7]" />
          <span className="size-1.5 animate-quantessaBounce rounded-full bg-[#7666d7] [animation-delay:150ms]" />
          <span className="size-1.5 animate-quantessaBounce rounded-full bg-[#7666d7] [animation-delay:300ms]" />
        </span>
        <span className="text-xs font-medium text-[#8a879e]">
          is thinking
        </span>
      </div>
    </div>
  );
}