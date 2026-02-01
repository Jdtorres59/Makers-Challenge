import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { retrieve } from "@/lib/retrieve";
import { detectIntent, detectIntentWithLLM } from "@/lib/intent";
import { generateRagResponse } from "@/lib/rag";
import { links } from "@/constants/links";
import { debugLog, isDebug, redact } from "@/lib/debug";
import { splitParagraphs, truncate } from "@/lib/format";
import type { ChatMessage, ChatResponse, CtaChip, Intent } from "@/types";

export const runtime = "nodejs";
const KNOWLEDGE_DIR = path.join(process.cwd(), "src", "knowledge");
const PRICING_FILE = "camaral_pricing.md";

async function loadPricingSnippets(limit = 2): Promise<ChatResponse["sources"]> {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, PRICING_FILE);
    const content = await fs.readFile(filePath, "utf8");
    const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || "Camaral pricing";
    const paragraphs = splitParagraphs(content.replace(/^#.+$/gm, ""));
    const prioritized = paragraphs.filter((paragraph) => paragraph.includes("$"));
    const selected = (prioritized.length > 0 ? prioritized : paragraphs).slice(0, limit);

    return selected.map((paragraph) => ({
      title,
      excerpt: truncate(paragraph),
      file: PRICING_FILE,
    }));
  } catch (error) {
    return [];
  }
}

async function ensurePricingSources(
  sources: ChatResponse["sources"],
  limit: number
): Promise<ChatResponse["sources"]> {
  if (sources.some((source) => source.file === PRICING_FILE)) return sources;
  const pricingSnippets = await loadPricingSnippets(2);
  if (pricingSnippets.length === 0) return sources;
  return [...pricingSnippets, ...sources].slice(0, limit);
}

function buildCtaChips(intent: Intent): CtaChip[] {
  switch (intent) {
    case "how_it_works":
      return [
        { label: "Ver casos de uso", href: links.useCases, kind: "primary" },
        { label: "Agendar demo", href: links.bookDemo, kind: "secondary" },
      ];
    case "pricing":
      return [
        { label: "Ver precios", href: links.pricing, kind: "primary" },
        { label: "Agendar demo", href: links.bookDemo, kind: "secondary" },
      ];
    case "demo":
      return [
        { label: "Agendar demo", href: links.bookDemo, kind: "primary" },
        { label: "Hablar con ventas", kind: "input", message: "Quiero hablar con ventas." },
      ];
    case "use_cases":
      return [
        { label: "Ver casos de uso", href: links.useCases, kind: "primary" },
        { label: "Agendar demo", href: links.bookDemo, kind: "secondary" },
      ];
    case "objections":
      return [
        {
          label: "Resolver objeciones",
          kind: "input",
          message: "Tengo algunas objeciones y dudas sobre adopción. ¿Podemos revisarlas?",
        },
        { label: "Agendar demo", href: links.bookDemo, kind: "secondary" },
      ];
    default:
      return [
        { label: "¿Qué es Camaral?", kind: "input", message: "¿Qué es Camaral?" },
        { label: "¿Cómo funciona?", kind: "input", message: "¿Cómo funciona Camaral?" },
        { label: "Precios", href: links.pricing, kind: "secondary" },
        { label: "Agendar demo", href: links.bookDemo, kind: "primary" },
      ];
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const messages = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];
  const query =
    [...messages]
      .reverse()
      .find((message) => message.role === "user")?.content || "";
  const locale = typeof body.locale === "string" ? body.locale : undefined;
  const requestId = `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  debugLog("chat:request", {
    requestId,
    messageCount: messages.length,
    queryLength: query.length,
    queryPreview: redact(query.slice(0, 120)),
    locale,
  });

  const ruleIntent = detectIntent(query);
  const llmIntent = ruleIntent === "general" ? await detectIntentWithLLM(query) : null;
  const intent = llmIntent ?? ruleIntent;
  debugLog("chat:intent", {
    requestId,
    ruleIntent,
    llmIntent,
    finalIntent: intent,
  });
  let sources: ChatResponse["sources"] = [];
  try {
    sources = await retrieve(query, 5);
  } catch (error) {
    sources = [];
  }
  if (intent === "pricing") {
    sources = await ensurePricingSources(sources, 5);
  }
  debugLog("chat:snippets", {
    requestId,
    snippetCount: sources.length,
    snippets: sources.slice(0, 5).map((source) => ({
      title: source.title,
      file: source.file,
      excerptPreview: redact(source.excerpt.slice(0, 120)),
    })),
  });
  const rag = await generateRagResponse({
    query,
    messages,
    intent,
    sources,
  });
  debugLog("chat:response", {
    requestId,
    assistantTextLength: rag.answer.length,
    usedFallback: Boolean(rag.usedFallback),
    fallbackReason: rag.fallbackReason,
    confidence: rag.confidence,
  });
  const assistantText = rag.answer;
  const ctaChips = buildCtaChips(intent);

  const response: ChatResponse & {
    debug?: {
      usedFallback: boolean;
      fallbackReason?: string;
    };
  } = {
    assistantText,
    sources,
    intent,
    ctaChips,
  };

  if (isDebug()) {
    response.debug = {
      usedFallback: Boolean(rag.usedFallback),
      fallbackReason: rag.fallbackReason,
    };
  }

  return NextResponse.json(response);
}
