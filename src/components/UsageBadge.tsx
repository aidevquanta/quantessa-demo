export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

type UsageBadgeProps = {
  usage?: TokenUsage | null;
};

function formatNumber(value?: number): string | null {
  if (value == null || Number.isNaN(value)) return null;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

export function UsageBadge({ usage }: UsageBadgeProps) {
  const input = formatNumber(usage?.inputTokens);
  const output = formatNumber(usage?.outputTokens);
  const total = formatNumber(usage?.totalTokens);

  const label =
    input !== null && output !== null
      ? `${input} in · ${output} out${total !== null ? ` · ${total} tok` : ""}`
      : "tokens —";

  return (
    <p className="text-center text-[11px] tracking-normal text-[#a1a1b1]">
      token usage · {label}
    </p>
  );
}