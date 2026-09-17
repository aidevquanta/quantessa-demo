export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type FreeQuota = {
  limit: number;
  remaining: number;
};

type UsageBadgeProps = {
  usage?: TokenUsage | null;
  quota?: FreeQuota | null;
};

function formatNumber(value?: number): string | null {
  if (value == null || Number.isNaN(value)) return null;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

export function UsageBadge({ usage, quota }: UsageBadgeProps) {
  const input = formatNumber(usage?.inputTokens);
  const output = formatNumber(usage?.outputTokens);
  const total = formatNumber(usage?.totalTokens);

  const label =
    input !== null && output !== null
      ? `${input} in · ${output} out${total !== null ? ` · ${total} tok` : ""}`
      : "tokens —";

  let quotaPercent: number | null = null;
  if (quota && quota.limit > 0) {
    const used = Math.max(0, quota.limit - quota.remaining);
    quotaPercent = Math.min(100, Math.round((used / quota.limit) * 100));
  }

  return (
    <div className="text-center">
      <p className="text-[11px] tracking-normal text-[#a1a1b1]">
        token usage · {label}
      </p>
      {quotaPercent !== null && (
        <div className="mt-1.5">
          <p className="text-[11px] text-[#a1a1b1]">
            daily free quota ·{" "}
            <span className="font-semibold tabular-nums text-[#8a6d2f]">
              {quotaPercent}% used
            </span>
          </p>
          <div className="mx-auto mt-1 h-1 w-44 overflow-hidden rounded-full bg-[#eeedf4]">
            <div
              className="h-full rounded-full bg-[#8a6d2f]"
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}