import { generateJson } from "@/lib/llm";
import { truncate } from "@/lib/format";
import type { ChatMessage, Intent, SourceSnippet } from "@/types";

const MAX_CONTEXT_MESSAGES = 8;

export type RagResult = {
  answer: string;
  followUp: string;
  confidence?: number;
  shouldOfferDemo?: boolean;
  raw?: string;
};

function buildConversationContext(messages: ChatMessage[]): string {
  const recent = messages.slice(-MAX_CONTEXT_MESSAGES);
  return recent
    .map((message) => `${message.role.toUpperCase()}: ${truncate(message.content, 360)}`)
    .join("\n");
}

function buildSourcesContext(sources: SourceSnippet[]): string {
  if (sources.length === 0) return "(sin snippets relevantes)";

  return sources
    .map((source, index) => {
      return [
        `Snippet ${index + 1}: ${source.title}`,
        source.excerpt,
        `Archivo: ${source.file}`,
      ].join("\n");
    })
    .join("\n\n");
}

function safeFallback(intent: Intent, hasSources: boolean): RagResult {
  const base =
    intent === "pricing"
      ? "Los planes existen, pero el detalle exacto varía; puedo llevarte a la página oficial o ayudarte a agendar una demo."
      : "Puedo ayudarte con producto, casos de uso y una demo según tu necesidad.";

  const followUp =
    intent === "pricing"
      ? "¿Quieres ver precios o prefieres una demo?"
      : "¿Qué objetivo quieres cubrir primero?";

  const extra = hasSources
    ? "Tengo información general disponible y puedo enfocarla a tu caso."
    : "No tengo ese detalle confirmado todavía.";

  return {
    answer: `${base} ${extra}`.trim(),
    followUp,
  };
}

function parseJson(content: string): RagResult | null {
  try {
    const parsed = JSON.parse(content) as {
      answer?: string;
      follow_up?: string;
      confidence?: number;
      should_offer_demo?: boolean;
    };

    if (!parsed.answer || !parsed.follow_up) return null;

    return {
      answer: parsed.answer.trim(),
      followUp: parsed.follow_up.trim(),
      confidence: parsed.confidence,
      shouldOfferDemo: parsed.should_offer_demo,
      raw: content,
    };
  } catch (error) {
    return null;
  }
}

export async function generateRagResponse({
  query,
  messages,
  intent,
  sources,
}: {
  query: string;
  messages: ChatMessage[];
  intent: Intent;
  sources: SourceSnippet[];
}): Promise<RagResult> {
  const conversation = buildConversationContext(messages);
  const snippets = buildSourcesContext(sources);

  const systemPrompt = [
    "Eres un asistente comercial de Camaral (ventas/soporte).",
    "Idioma: español neutro. Tono: profesional, directo, claro y humano.",
    "No inventes features, integraciones ni precios. Usa solo los snippets.",
    "Si la info no está en snippets, dilo explícitamente y ofrece página oficial o demo.",
    "Evita solicitar o revelar datos sensibles. No des asesoría médica ni legal.",
    "Formato: 1 párrafo + (opcional) hasta 3 bullets + 1 pregunta final.",
    "No digas: 'basado en la base de conocimiento' ni 'encontré'.",
    "Si el intent es how_it_works, explica en 3 pasos: (1) se configura, (2) atiende/guía, (3) escala/analiza.",
    "Si el intent es pricing, no inventes números; menciona planes solo si aparecen.",
    "Si el intent es demo, confirma y empuja CTA.",
    "Si el intent es objections, responde con empatía y lo disponible en snippets.",
    "Responde con JSON estricto con las claves: answer, follow_up, confidence, should_offer_demo.",
  ].join(" ");

  const userPrompt = [
    `Intent detectado: ${intent}`,
    "Conversación reciente:",
    conversation || "(sin contexto)",
    "\nSnippets relevantes:",
    snippets,
    "\nMensaje del usuario:",
    query,
  ].join("\n");

  let raw = \"\";
  try {
    raw = await generateJson({
      messages: [
        { role: \"system\", content: systemPrompt },
        { role: \"user\", content: userPrompt },
      ],
    });
  } catch (error) {
    return safeFallback(intent, sources.length > 0);
  }

  const parsed = parseJson(raw);
  if (!parsed) {
    return { ...safeFallback(intent, sources.length > 0), raw };
  }

  return parsed;
}
