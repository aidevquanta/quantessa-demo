# Quantessa Demo

A division-aware AI work assistant for real estate & property teams —
helping employees across every department move from questions to clear
next steps (research, drafting, analysis, proposals, reports),
built with Next.js (App Router), Vercel AI SDK, and OpenRouter.

This demo showcases **Kota Innovista** — the first integrated industrial
city in West Jakarta — as the sample project.

## Quick start

```bash
# 1. Copy the env template and add your OpenRouter key
cp .env.local.example .env.local
#    Edit .env.local and paste your key

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to chat.

## Deploy to Vercel

```bash
npx vercel
```

When prompted, set `OPENROUTER_API_KEY` as an environment variable
(Settings → Environment Variables) on Vercel.

## Architecture (at a glance)

```
src/
├── lib/agent/config.ts            # Domain identity + company registry
│   └── knowledge/kota-innovista.md # Project knowledge (source: kotainnovista.com)
├── app/api/chat/route.ts          # StreamText + OpenRouter + token logging
├── components/
│   ├── MessageBubble.tsx          # User / agent bubble with markdown
│   ├── MessageList.tsx            # Chat scroll container
│   ├── ChatInput.tsx              # Fixed input + send/stop button
│   ├── UsageBadge.tsx             # Quiet token readout (server console + UI)
│   └── icons/ArrowUp.tsx
└── app/
    ├── layout.tsx                 # Fonts + meta
    ├── page.tsx                   # Client chat page (useChat)
    └── globals.css                # Tailwind tokens + markdown styles
```

## Changing the model

Edit the single constant in `src/lib/agent/config.ts`:

```ts
export const MODEL_ENDPOINT = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
```

Swap to any OpenRouter-supported model (e.g. a paid Claude or GPT model)
with no other code changes.

## Adding a new company

1. Create a new file in `src/lib/agent/knowledge/`
2. Export its content as a default string
3. Register it in the `COMPANIES` map in `src/lib/agent/config.ts`
4. No changes to the API route or UI components

## License

Internal demo — PT Quanta Land Indonesia / Kedaung Group.