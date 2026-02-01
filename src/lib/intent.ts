import { normalizeText } from "@/lib/format";
import type { Intent } from "@/types";

// Lightweight rules for intent detection. Extend keywords as the KB grows.
const KEYWORDS: Record<Intent, string[]> = {
  pricing: [
    "precio",
    "precios",
    "pricing",
    "cuanto cuesta",
    "cuánto cuesta",
    "coste",
    "costo",
    "planes",
    "plan",
    "tarifa",
  ],
  demo: [
    "demo",
    "agendar",
    "agenda",
    "agendar demo",
    "reservar",
    "hablar con ventas",
    "equipo de ventas",
    "sales",
    "llamada",
    "call",
  ],
  use_cases: [
    "casos de uso",
    "use cases",
    "ventas",
    "soporte",
    "onboarding",
    "implementaciones",
    "ejemplos",
  ],
  how_it_works: [
    "como funciona",
    "cómo funciona",
    "que es",
    "qué es",
    "funciona",
    "features",
    "caracteristicas",
    "características",
    "diferencia",
  ],
  objections: [
    "objecion",
    "objeción",
    "objeciones",
    "reemplaza",
    "reemplazar",
    "miedo",
    "control de calidad",
    "calidad",
    "no reemplaza",
  ],
  general: [],
};

function matchAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

export function detectIntent(message: string): Intent {
  const normalized = normalizeText(message);
  if (!normalized) return "general";

  if (matchAny(normalized, KEYWORDS.pricing)) return "pricing";
  if (matchAny(normalized, KEYWORDS.demo)) return "demo";
  if (matchAny(normalized, KEYWORDS.use_cases)) return "use_cases";
  if (matchAny(normalized, KEYWORDS.how_it_works)) return "how_it_works";
  if (matchAny(normalized, KEYWORDS.objections)) return "objections";

  return "general";
}

export async function detectIntentWithLLM(message: string): Promise<Intent | null> {
  if (!process.env.INTENT_LLM_ENDPOINT) return null;

  // Placeholder for future LLM-based intent classification.
  // If an integration exists, implement the fetch here and return a valid Intent.
  void message;
  return null;
}
