import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SIXTY_SECONDS = 60_000;

type Cached = { limited: boolean; resetAt: number; fetchedAt: number } | null;
let cache: Cached = null;

function nextMidnightUtc(): number {
  const now = new Date();
  return (
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    ) + 86_400_000
  );
}

export async function GET() {
  if (cache && Date.now() - cache.fetchedAt < SIXTY_SECONDS) {
    return NextResponse.json(cache);
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ""}`,
      },
      cache: "no-store",
    });

    let limited = false;
    if (response.ok) {
      const body = (await response.json()) as {
        data?: {
          free_model_daily_requests?: { remaining?: number };
        };
      };
      const remaining =
        body.data?.free_model_daily_requests?.remaining ?? 1;
      limited = remaining <= 0;
    } else if (response.status === 429) {
      limited = true;
    }

    const result = limited
      ? { limited: true, resetAt: nextMidnightUtc() }
      : { limited: false as const, resetAt: 0 as const };
    cache = { ...result, fetchedAt: Date.now() };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ limited: false });
  }
}