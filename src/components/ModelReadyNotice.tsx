"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function ModelReadyNotice({ resetAt }: { resetAt: number }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, resetAt - Date.now())
  );

  useEffect(() => {
    setRemaining(Math.max(0, resetAt - Date.now()));
    const timer = setInterval(
      () => setRemaining(Math.max(0, resetAt - Date.now())),
      1000
    );
    return () => clearInterval(timer);
  }, [resetAt]);

  if (remaining <= 0) return null;

  const pad = (value: number) => String(value).padStart(2, "0");
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  return (
    <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-[#9290a2]">
      <Clock className="size-3.5 shrink-0" />
      <span>
        Quantessa isn&apos;t ready yet — she&apos;ll be available again in{" "}
        <span className="font-semibold tabular-nums text-[#8a6d2f]">
          {pad(hours)}:{pad(minutes)}:{pad(seconds)}
        </span>
      </span>
    </p>
  );
}