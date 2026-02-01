import { NextResponse } from "next/server";
import { retrieve } from "@/lib/retrieve";
import { detectIntent, detectIntentWithLLM } from "@/lib/intent";
import { generateRagResponse } from "@/lib/rag";
import { links } from "@/constants/links";
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

function buildAssistantText(answer: string, followUp?: string) {
  return followUp ? `${answer}\n\n${followUp}` : answer;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const messages = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];
  const query =
    [...messages]
      .reverse()
      .find((message) => message.role === "user")?.content || "";

  let sources: ChatResponse["sources"] = [];
  try {
    sources = await retrieve(query, 5);
  } catch (error) {
    sources = [];
  }
  const ruleIntent = detectIntent(query);
  const llmIntent = ruleIntent === "general" ? await detectIntentWithLLM(query) : null;
  const intent = llmIntent ?? ruleIntent;
  const rag = await generateRagResponse({
    query,
    messages,
    intent,
    sources,
  });
  const assistantText = buildAssistantText(rag.answer, rag.followUp);
  const ctaChips = buildCtaChips(intent);

  return NextResponse.json({
    assistantText,
    sources,
    intent,
    ctaChips,
  });
}
