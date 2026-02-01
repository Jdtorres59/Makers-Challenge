import OpenAI from "openai";

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
  const openai = getClient();

  const response = await openai.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages,
  });

  return response.choices[0]?.message?.content ?? "";
}
