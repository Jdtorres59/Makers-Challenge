import { NextResponse } from "next/server";
import { retrieve } from "@/lib/retrieve";
import { detectIntent, detectIntentWithLLM } from "@/lib/intent";
import { generateRagResponse } from "@/lib/rag";
import { links } from "@/constants/links";
import { debugLog, isDebug, redact } from "@/lib/debug";
import type { ChatMessage, ChatResponse, CtaChip, Intent } from "@/types";

export const runtime = "nodejs";

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

  let sources: ChatResponse["sources"] = [];
  try {
    sources = await retrieve(query, 5);
  } catch (error) {
    sources = [];
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
  const ruleIntent = detectIntent(query);
  const llmIntent = ruleIntent === "general" ? await detectIntentWithLLM(query) : null;
  const intent = llmIntent ?? ruleIntent;
  debugLog("chat:intent", {
    requestId,
    ruleIntent,
    llmIntent,
    finalIntent: intent,
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
