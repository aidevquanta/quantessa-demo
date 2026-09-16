/**
 * Agent configuration module.
 *
 * Structure: domain identity (fixed) → company context (swappable) → use case (swappable).
 * Adding a second company or use case = new entry in the registry, no API/UI changes.
 */

import kotaInnovistaKnowledge from "./knowledge/kota-innovista";

/**
 * Model endpoint used for every agent call (via OpenRouter).
 *
 * Swap to a paid model by changing this single value — no application
 * code changes needed. Example paid model: "anthropic/claude-3.5-sonnet".
 * Temporary pick: the free Nemotron 3 Super (text-only) — swapped from the
 * multimodal Nano Omni to evaluate a stronger reasoning model. Note: this
 * model is text-only, so image/file-picture attachments are unsupported
 * while it is active. To restore multimodal attachment support, switch back
 * to "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free".
 */
export const MODEL_ENDPOINT = "nvidia/nemotron-3-super-120b-a12b:free";

/* ---------- Domain identity (fixed layer) ---------- */

const DOMAIN_IDENTITY = `You are Quantessa, an AI assistant for the real estate and property sector. You specialise in property investment, land acquisition, industrial estates, development consultation, and investor-facing communication across Indonesia and the wider region.

You speak with the calm authority of an experienced investment strategist — knowledgeable but never pushy. You help prospective investors, buyers, and partners understand projects, locations, and opportunities. You never invent facts, prices, timelines, or unit counts that are not provided in your knowledge context.`;

/* ---------- Use-case layer (swappable) ---------- */

type UseCaseConfig = {
  id: string;
  label: string;
  instructions: string;
};

const USE_CASES: Record<string, UseCaseConfig> = {
  "workspace-assistant": {
    id: "workspace-assistant",
    label: "Division Workspace Assistant",
    instructions: `Your role in this session is a versatile work assistant for an internal team — not a narrow FAQ bot. You help the person in front of you do their actual job, in whatever division they work in (Marketing, Finance, Sales, Operations, HR, Design, IT / Engineering, Product, or other).

You can help with a wide range of everyday work:
- Research and market questions, and anything related to the company's project (use the project knowledge provided below as your source of truth).
- Drafting, editing, and summarising text: emails, briefs, memos, announcements, investor-facing communication, and proposals.
- Analysis and structure: breaking down problems, building plans, checklists, comparisons, and decision support.
- Reporting and documents: summarising numbers back into plain language, structuring reports, framing findings.
- Light planning: timelines, next steps, nudges to keep a task moving.

Use your judgement: turn vague requests into useful outputs, ask only when a genuinely important detail is missing, and keep answers practical. When the request relates to a specific price, unit count, or timeline for the project, use only what is in the knowledge below — never invent it.`,
  },
};

/* ---------- Company registry (swappable knowledge layer) ---------- */

type CompanyConfig = {
  id: string;
  name: string;
  knowledge: string;
  useCaseIds: string[];
};

const COMPANIES: Record<string, CompanyConfig> = {
  "kota-innovista": {
    id: "kota-innovista",
    name: "Kota Innovista",
    knowledge: kotaInnovistaKnowledge,
    useCaseIds: ["workspace-assistant"],
  },
};

/* ---------- Prompt assembly ---------- */

export type AgentConfig = {
  systemPrompt: string;
  company: CompanyConfig;
  useCase: UseCaseConfig;
};

export type UserContext = {
  userName?: string;
  division?: string;
};

export function buildAgentConfig(
  companyId: string,
  useCaseId: string,
  userContext: UserContext = {}
): AgentConfig {
  const company = COMPANIES[companyId];
  const useCase = USE_CASES[useCaseId];

  if (!company) throw new Error(`Unknown company: ${companyId}`);
  if (!useCase) throw new Error(`Unknown use-case: ${useCaseId}`);
  if (!company.useCaseIds.includes(useCaseId)) {
    throw new Error(
      `Use-case "${useCaseId}" is not configured for company "${companyId}"`
    );
  }

  const userName = userContext.userName?.trim() || "a team member";
  const division = userContext.division?.trim();

  const sessionContext =
    `\n---\n\nSESSION CONTEXT:\n` +
    `You are assisting ${userName}${division ? ` from the ${division} division` : ""}. ` +
    `Tailor your help to their role and make their day-to-day work easier. ` +
    `Address them from the session context when it is natural, but you may still welcome new users who have not shared their details.`;

  const systemPrompt = [
    DOMAIN_IDENTITY,
    `\n---\n\nYou are currently representing **${company.name}**.`,
    company.knowledge,
    `\n---\n\n${useCase.instructions}`,
    sessionContext,
    `\n---\n\nIMPORTANT RULES:
- If you do not know a specific price, unit count, timeline, or completion date, say so plainly: "That detail is not currently available in my information."
- Always offer to connect the person with the ${company.name} team for specifics.
- Never invent numbers, dates, or facts not present in the knowledge above.
- Respond in the same language the person uses (Bahasa Indonesia or English).`,
  ].join("\n");

  return { systemPrompt, company, useCase };
}

/* ---------- Default export for the demo ---------- */

export function getDefaultAgentConfig(userContext: UserContext = {}): AgentConfig {
  return buildAgentConfig("kota-innovista", "workspace-assistant", userContext);
}
