import { generateJson } from "@/lib/llm";
import { truncate } from "@/lib/format";
import type { ChatMessage, Intent, SourceSnippet } from "@/types";

const MAX_CONTEXT_MESSAGES = 8;

export type RagResult = {
  answer: string;
  followUp: string | null;
  confidence?: "high" | "medium" | "low";
  shouldOfferDemo?: boolean;
  raw?: string;
  usedFallback?: boolean;
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

function safeFallback(
  intent: Intent,
  hasSources: boolean,
  reason: "missing_key" | "llm_error" | "parse_error"
): RagResult {
  const reasonLine =
    reason === "missing_key"
      ? "No pude generar una respuesta con IA porque falta configuración del servidor."
      : "No pude generar una respuesta con IA por un error temporal.";

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
    answer: `${reasonLine} ${base} ${extra}`.trim(),
    followUp,
    usedFallback: true,
    confidence: "low",
  };
}

function parseJson(content: string): RagResult | null {
  try {
    const parsed = JSON.parse(content) as {
      answer?: string;
      follow_up?: string | null;
      confidence?: "high" | "medium" | "low";
      should_offer_demo?: boolean;
    };

    if (!parsed.answer || typeof parsed.follow_up === "undefined") return null;

    return {
      answer: parsed.answer.trim(),
      followUp: parsed.follow_up ? parsed.follow_up.trim() : null,
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
    "confidence debe ser uno de: high, medium, low.",
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

  if (!process.env.OPENAI_API_KEY) {
    console.warn("[rag] missing_api_key");
    return safeFallback(intent, sources.length > 0, "missing_key");
  }

  let raw = "";
  let parsed: RagResult | null = null;
  let attempt = 0;

  while (attempt < 2 && !parsed) {
    attempt += 1;
    try {
      console.info("[rag] llm_call", {
        intent,
        snippetCount: sources.length,
        snippetTitles: sources.map((source) => source.title),
        attempt,
        hasApiKey: true,
      });
      raw = await generateJson({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              attempt === 2
                ? `${userPrompt}\n\nIMPORTANTE: responde SOLO con JSON válido.`
                : userPrompt,
          },
        ],
      });
      parsed = parseJson(raw);
      if (!parsed) {
        console.warn("[rag] llm_parse_failed", { attempt });
      }
    } catch (error) {
      console.warn("[rag] llm_error", { attempt, message: (error as Error).message });
      if (attempt >= 2) {
        return safeFallback(intent, sources.length > 0, "llm_error");
      }
    }
  }

  if (!parsed) {
    return { ...safeFallback(intent, sources.length > 0, "parse_error"), raw };
  }

  return parsed;
}
