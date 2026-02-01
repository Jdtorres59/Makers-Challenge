import { generateJson } from "@/lib/llm";
import { truncate } from "@/lib/format";
import { debugLog, debugWarn, redact } from "@/lib/debug";
import type { ChatMessage, Intent, SourceSnippet } from "@/types";

const MAX_CONTEXT_MESSAGES = 8;

export type RagResult = {
  answer: string;
  followUp: string | null;
  confidence?: "high" | "medium" | "low";
  shouldOfferDemo?: boolean;
  raw?: string;
  usedFallback?: boolean;
  fallbackReason?: "missing_key" | "openai_error" | "json_parse" | "no_sources" | "unknown";
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
  reason: RagResult["fallbackReason"] = "unknown"
): RagResult {
  const fallbackReason = reason ?? (hasSources ? "unknown" : "no_sources");
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
    fallbackReason,
    confidence: "low",
  };
}

function tryParseJson(content: string): { result: RagResult | null; error?: string } {
  try {
    const parsed = JSON.parse(content) as {
      answer?: string;
      follow_up?: string | null;
      confidence?: "high" | "medium" | "low";
      should_offer_demo?: boolean;
    };

    if (!parsed.answer || typeof parsed.follow_up === "undefined") {
      return { result: null };
    }

    return {
      result: {
        answer: parsed.answer.trim(),
        followUp: parsed.follow_up ? parsed.follow_up.trim() : null,
        confidence: parsed.confidence,
        shouldOfferDemo: parsed.should_offer_demo,
        raw: content,
      },
    };
  } catch (error) {
    return { result: null, error: (error as Error).message };
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
  const queryPreview = redact(query.slice(0, 120));
  const hasSources = sources.length > 0;

  debugLog("rag:context", {
    intent,
    hasSources,
    sourceCount: sources.length,
    queryPreview,
  });

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
    debugWarn("rag:missing_api_key");
    return safeFallback(intent, hasSources, "missing_key");
  }

  let raw = "";
  let parsed: RagResult | null = null;
  let attempt = 0;
  const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (process.env.DEBUG_PROMPT === "true") {
    debugLog("rag:prompt_lengths", {
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
    });
  }

  while (attempt < 2 && !parsed) {
    attempt += 1;
    try {
      debugLog("rag:llm_call", {
        intent,
        snippetCount: sources.length,
        snippetTitles: sources.map((source) => source.title),
        attempt,
        callingOpenAI: true,
        modelName,
        timeoutMs: undefined,
        hasKey: true,
      });
      raw = await generateJson({
        model: modelName,
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
      debugLog("rag:llm_success", {
        openAISuccess: true,
        rawType: typeof raw,
        rawLength: typeof raw === "string" ? raw.length : undefined,
      });
      const parsedResult = tryParseJson(raw);
      parsed = parsedResult.result;
      if (!parsed) {
        debugWarn("rag:parse_failed", {
          parseJsonFailed: true,
          attempt,
          errorMessage: parsedResult.error
            ? redact(parsedResult.error.slice(0, 200))
            : "invalid_json_shape",
        });
      }
    } catch (error) {
      const err = error as { name?: string; message?: string; status?: number; code?: string };
      debugWarn("rag:llm_error", {
        openAIError: true,
        attempt,
        errorName: err?.name,
        errorMessage: err?.message ? redact(err.message.slice(0, 200)) : undefined,
        status: err?.status,
        code: err?.code,
      });
      if (attempt >= 2) {
        return safeFallback(intent, hasSources, "openai_error");
      }
    }
  }

  if (!parsed) {
    return { ...safeFallback(intent, hasSources, "json_parse"), raw };
  }

  return parsed;
}
