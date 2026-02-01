import OpenAI from "openai";
import { debugLog, debugWarn, redact } from "@/lib/debug";

let client: OpenAI | null = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return client;
}

type LlmJsonOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
};

export async function generateJson({
  model = process.env.OPENAI_MODEL || "gpt-4o-mini",
  temperature = 0.2,
  maxTokens = 500,
  messages,
}: LlmJsonOptions) {
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  const requestStart = Date.now();

  debugLog("llm:request_start", {
    hasKey,
    model,
    requestStart,
  });

  try {
    const openai = getClient();
    const response = await openai.chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages,
    });

    const requestMs = Date.now() - requestStart;
    debugLog("llm:request_end", { requestMs });

    const content = response.choices[0]?.message?.content;
    if (typeof content !== "string") {
      debugWarn("llm:response_shape", {
        responseKeys: Object.keys(response).slice(0, 20),
      });
    }

    return content ?? "";
  } catch (error) {
    const err = error as { name?: string; message?: string; status?: number; code?: string };
    debugWarn("llm:error", {
      errorName: err?.name,
      errorMessage: err?.message ? redact(err.message.slice(0, 200)) : undefined,
      status: err?.status,
      code: err?.code,
    });
    throw error;
  }
}
