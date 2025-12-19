// src/quizPipeline.ts
// Two-call pipeline:
// 1) FACTS + state_update (WINDOW-grounded; STATE is hints only)
// 2) MCQ generation from FACTS only (3 options; includes correct_choice)
//
// Assumes prompts are stored as markdown files on disk.
// Recommended file layout (customize as you like):
//   prompts/step1.system.md
//   prompts/step1.user.md
//   prompts/step2.system.md
//   prompts/step2.user.md
//
// Placeholders supported (simple {{TOKEN}} replacement):
//   Step 1 user prompt: {{STATE_JSON}}, {{WINDOW_TEXT}}
//   Step 2 user prompt: {{FACTS_JSON}}, {{QUESTION_COUNT}}
//
// npm i openai zod
// Note: Uses Node.js fs. In a PWA, call this from your backend/serverless.

import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

// ----------------------
// Types
// ----------------------

export type Chunk = { id: string; text: string };

export type Entity = { name: string; desc: string; lastSeenMs?: number };

export type ReaderState = {
  section_title?: string;
  entities?: Entity[]; // keep small (e.g., <= 20)
  prior_summary?: string; // optional 1–2 sentences
};

type StateUpdate = {
  entities_add: Array<{ name: string; desc: string }>;
  summary_append?: string;
};

const FactsSchema = z.object({
  facts: z
    .array(
      z.object({
        id: z.string(), // "F1"
        fact: z.string(),
        evidence: z.object({
          type: z.literal("quote"),
          text: z.string(), // keep <=25 words enforced by prompt
        }),
      })
    )
    .min(1)
    .max(6),
  state_update: z.object({
    entities_add: z.array(z.object({ name: z.string(), desc: z.string() })).default([]),
    summary_append: z.string().optional().default(""),
  }),
  notes: z.string().optional().default(""),
});

const McqSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string(), // "Q1"
        question: z.string(),
        choices: z.object({
          A: z.string(),
          B: z.string(),
          C: z.string(),
        }),
        correct_choice: z.enum(["A", "B", "C"]),
        fact_ids: z.array(z.string()).min(1),
        evidence: z.array(z.object({ fact_id: z.string(), quote: z.string() })).default([]),
      })
    )
    .min(1)
    .max(4),
});

// ----------------------
// Prompt loading + templating
// ----------------------

async function loadPromptFile(promptsDir: string, filename: string): Promise<string> {
  const p = path.join(promptsDir, filename);
  return (await readFile(p, "utf8")).toString();
}

function template(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

// ----------------------
// Rendering helpers
// ----------------------

export function renderWindow(chunks: Chunk[]): string {
  return chunks
    .map((c, i) => `- Chunk ${i + 1} (id: ${c.id}):\n${c.text.trim()}`)
    .join("\n\n");
}

function renderStateHints(state: ReaderState | undefined): string {
  const safe = state ?? {};
  const entities = (safe.entities ?? []).map(({ name, desc }) => ({ name, desc }));
  return JSON.stringify(
    {
      section_title: safe.section_title ?? "",
      entities,
      prior_summary: safe.prior_summary ?? "",
    },
    null,
    2
  );
}

// ----------------------
// State merge logic
// ----------------------

function clampEntityDesc(desc: string): string {
  // Keep 3–8-ish words, trim hard; you can be stricter if you want.
  return desc.trim().replace(/\s+/g, " ");
}

function sentenceClamp1to2(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "";
  // Very pragmatic sentence split.
  const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(-2).join(" ").trim();
}

export function applyStateUpdate(
  prev: ReaderState,
  update: StateUpdate,
  opts?: { maxEntities?: number; nowMs?: number }
): ReaderState {
  const maxEntities = opts?.maxEntities ?? 20;
  const nowMs = opts?.nowMs ?? Date.now();

  const existing = new Map<string, Entity>();
  for (const e of prev.entities ?? []) existing.set(e.name.toLowerCase(), { ...e });

  for (const add of update.entities_add ?? []) {
    const key = add.name.toLowerCase();
    const nextDesc = clampEntityDesc(add.desc);

    const cur = existing.get(key);
    if (!cur) {
      existing.set(key, { name: add.name, desc: nextDesc, lastSeenMs: nowMs });
      continue;
    }

    // Replace desc if the new one is more specific (simple heuristic: longer within reason).
    const curLen = cur.desc.trim().length;
    const nextLen = nextDesc.length;
    const shouldReplace = nextLen > curLen;

    existing.set(key, {
      name: cur.name, // preserve canonical casing
      desc: shouldReplace ? nextDesc : cur.desc,
      lastSeenMs: nowMs,
    });
  }

  const mergedEntities = Array.from(existing.values())
    .sort((a, b) => (b.lastSeenMs ?? 0) - (a.lastSeenMs ?? 0))
    .slice(0, maxEntities);

  const appended = (update.summary_append ?? "").trim();
  const prior = (prev.prior_summary ?? "").trim();
  const nextSummary = sentenceClamp1to2([prior, appended].filter(Boolean).join(" "));

  return {
    ...prev,
    entities: mergedEntities,
    prior_summary: nextSummary || prev.prior_summary || "",
  };
}

// ----------------------
// Caching (optional but recommended)
// ----------------------

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

type CacheValue = { facts: z.infer<typeof FactsSchema>; mcq: z.infer<typeof McqSchema>; nextState: ReaderState };

export class QuizPipeline {
  private client: OpenAI;
  private promptsDir: string;
  private cache = new Map<string, CacheValue>();

  constructor(args: { apiKey: string; promptsDir: string; baseURL?: string }) {
    this.client = new OpenAI({
      apiKey: args.apiKey,
      ...(args.baseURL ? { baseURL: args.baseURL } : {}),
      // If you insist on running in-browser, you’d need:
      // dangerouslyAllowBrowser: true,
      // but you should not do that in production.
    });
    this.promptsDir = args.promptsDir;
  }

  /**
   * Run the “gate”: given current state + the last k chunks (e.g. 5), return MCQs,
   * plus an updated state derived from Step 1.
   */
  async generateGateQuiz(args: {
    state: ReaderState;
    windowChunks: Chunk[];
    questionCount: 1 | 2 | 3 | 4;
    model: string;
    enableCache?: boolean;
    chapterNumber?: string;
    paragraphIndex?: number;
    questionNumber?: number;
  }): Promise<CacheValue> {
    const {
      state,
      windowChunks,
      questionCount,
      model,
      enableCache = true,
      chapterNumber,
      paragraphIndex,
      questionNumber,
    } = args;

    if (!windowChunks.length) throw new Error("windowChunks is empty");

    const cacheKey = sha256(
      JSON.stringify({
        chapterNumber: chapterNumber || "unknown",
        paragraphIndex: paragraphIndex ?? -1,
        questionNumber: questionNumber ?? -1,
        model,
        questionCount,
      })
    );

    if (enableCache) {
      const hit = this.cache.get(cacheKey);
      if (hit) return hit;
    }

    const step1System = await loadPromptFile(this.promptsDir, "step1.system.md");
    const step1User = await loadPromptFile(this.promptsDir, "step1.user.md");
    const step2System = await loadPromptFile(this.promptsDir, "step2.system.md");
    const step2User = await loadPromptFile(this.promptsDir, "step2.user.md");

    // ---- Step 1: facts + state_update ----
    const windowText = renderWindow(windowChunks);
    const stateJson = renderStateHints(state);

    const step1UserFinal = template(step1User, {
      STATE_JSON: stateJson,
      WINDOW_TEXT: windowText,
    });

    const factsResp = await this.client.responses.parse({
      model,
      input: [
        { role: "system", content: step1System },
        { role: "user", content: step1UserFinal },
      ],
      text: { format: zodTextFormat(FactsSchema, "facts_and_state_update") },
    });

    const factsParsed = FactsSchema.parse(factsResp.output_parsed);
    const nextState = applyStateUpdate(state, factsParsed.state_update);

    // ---- Step 2: MCQs from facts only ----
    const factsJson = JSON.stringify({ facts: factsParsed.facts }, null, 2);

    const step2UserFinal = template(step2User, {
      FACTS_JSON: factsJson,
      QUESTION_COUNT: String(questionCount),
    });

    const mcqResp = await this.client.responses.parse({
      model,
      input: [
        { role: "system", content: step2System },
        { role: "user", content: step2UserFinal },
      ],
      text: { format: zodTextFormat(McqSchema, "mcq_generation") },
    });

    const mcqParsed = McqSchema.parse(mcqResp.output_parsed);

    const out: CacheValue = { facts: factsParsed, mcq: mcqParsed, nextState };
    if (enableCache) this.cache.set(cacheKey, out);
    return out;
  }
}

// ----------------------
// Example prompt files (what you’d put in prompts/*.md)
// ----------------------
//
// prompts/step1.system.md
//   You are an extraction engine. Use ONLY the WINDOW as the source of facts. STATE is optional hints for resolving references only. Do not add outside knowledge.
//
// prompts/step1.user.md
//   Task:
//   1) Extract 3–6 key facts important for comprehension of the WINDOW.
//   2) Propose a compact state_update (entities + optional summary) for future reference resolution.
//
//   Rules for facts:
//   - Each fact MUST be directly supported by the WINDOW.
//   - Evidence MUST be an exact quote (<= 25 words) from the WINDOW.
//   - You MAY use STATE only to resolve ambiguous references (e.g., who "she" refers to), but MUST NOT introduce facts from STATE.
//   - If ambiguity remains, keep the fact neutral and mention ambiguity in notes.
//
//   Rules for state_update:
//   - entities_add: include only NEW or newly-disambiguated entities introduced/clarified in the WINDOW.
//   - Each entity description must be 3–8 words.
//   - summary_append: OPTIONAL; 1–2 sentences summarizing the WINDOW only (no spoilers).
//
//   Output JSON only matching the schema you were given.
//
//   STATE (optional hints; NOT evidence):
//   {{STATE_JSON}}
//
//   WINDOW:
//   {{WINDOW_TEXT}}
//
// prompts/step2.system.md
//   You are a question writer. Generate questions ONLY from the provided FACTS JSON. Do not use any other context. Do not introduce new information.
//
// prompts/step2.user.md
//   Task:
//   Generate {{QUESTION_COUNT}} multiple-choice comprehension questions from the FACTS below.
//
//   Rules:
//   - Use ONLY the facts provided (by id).
//   - Each question must have EXACTLY 3 answer choices (A, B, C).
//   - EXACTLY ONE choice must be correct.
//   - Wrong choices must be plausible but contradicted or unsupported by the facts.
//   - Provide correct_choice as "A" or "B" or "C".
//   - Evidence must copy the evidence quote(s) from the referenced facts.
//
//   Output JSON only.
//
//   FACTS:
//   {{FACTS_JSON}}
//
// ----------------------
// Example usage
// ----------------------

// async function example() {
//   const pipeline = new QuizPipeline({
//     apiKey: process.env.OPENAI_API_KEY!,
//     promptsDir: path.join(process.cwd(), "prompts"),
//   });

//   const state: ReaderState = {
//     section_title: "Chapter 3: The Signal",
//     entities: [
//       { name: "Mara", desc: "radio engineer; methodical protagonist", lastSeenMs: Date.now() - 100000 },
//       { name: "Klein", desc: "skeptical supervisor; rejects hypotheses", lastSeenMs: Date.now() - 90000 },
//     ],
//     prior_summary: "Mara tracks an intermittent transmission; Klein doubts it is real.",
//   };

//   const windowChunks: Chunk[] = [
//     { id: "c120", text: "..." },
//     { id: "c121", text: "..." },
//     { id: "c122", text: "..." },
//     { id: "c123", text: "..." },
//     { id: "c124", text: "..." },
//   ];

//   const { mcq, nextState } = await pipeline.generateGateQuiz({
//     state,
//     windowChunks,
//     questionCount: 3,
//     model: "gpt-4o-mini", // pick your model
//   });

//   console.log("Quiz:", mcq.questions);
//   console.log("Updated state:", nextState);

//   // Unlock logic (no grading call needed):
//   // userChoice === question.correct_choice => correct.
// }

// if (import.meta.url === `file://${process.argv[1]}`) {
//   example().catch((err) => {
//     console.error(err);
//     process.exit(1);
//   });
// }
