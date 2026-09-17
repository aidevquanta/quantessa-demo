import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SIXTY_SECONDS = 60_000;

type FreeQuota = {
  limit: number;
  remaining: number;
};

type Result = {
  limited: boolean;
  resetAt: number;
  quota: FreeQuota | null;
};

type Cached = Result & { fetchedAt: number };

let cache: Cached | null = null;

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
    return NextResponse.json({
      limited: cache.limited,
      resetAt: cache.resetAt,
      quota: cache.quota,
    });
  }

  let result: Result = { limited: false, resetAt: 0, quota: null };

  try {
    const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ""}`,
      },
      cache: "no-store",
    });

    if (response.ok) {
      const body = (await response.json()) as {
        data?: {
          free_model_daily_requests?: { remaining?: number; limit?: number };
        };
      };
      const daily = body.data?.free_model_daily_requests;
      if (daily) {
        if (
          typeof daily.limit === "number" &&
          daily.limit > 0 &&
          typeof daily.remaining === "number"
        ) {
          result.quota = { limit: daily.limit, remaining: daily.remaining };
          if (daily.remaining <= 0) {
            result.limited = true;
            result.resetAt = nextMidnightUtc();
          }
        }
      }
    } else if (response.status === 429) {
      result = { limited: true, resetAt: nextMidnightUtc(), quota: null };
    }
  } catch {
    /* keep the defaults on transient network failures */
  }

  cache = { ...result, fetchedAt: Date.now() };
  return NextResponse.json(result);
}