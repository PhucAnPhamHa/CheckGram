import type { Config } from "../config.js";
import type { RewriteVariation, Suggestion } from "../contracts.js";

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return JSON.parse(fenced?.[1] ?? content);
}

async function complete(
  system: string,
  user: string,
  config: Config,
  fetchImpl: typeof fetch
): Promise<string> {
  if (!config.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for this operation");
  }

  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    }),
    signal: AbortSignal.timeout(config.REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as OpenAIResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response");
  return content;
}

export async function analyzeWithOpenAI(
  text: string,
  tone: string,
  config: Config,
  fetchImpl: typeof fetch = fetch
): Promise<Suggestion[]> {
  const content = await complete(
    [
      "You are a writing assistant.",
      "Return only JSON with a suggestions array.",
      "Each item must contain startOffset, endOffset, suggestionType, replacementOptions, explanation, confidence.",
      "suggestionType must be exactly Clarity, Engagement, or Delivery.",
      "Offsets are zero-based JavaScript UTF-16 offsets into the supplied text.",
      "Only return actionable ranges and ensure each range is within the text."
    ].join(" "),
    JSON.stringify({ text, desiredTone: tone }),
    config,
    fetchImpl
  );

  const parsed = extractJson(content) as { suggestions?: Array<{
    startOffset?: number;
    endOffset?: number;
    suggestionType?: string;
    replacementOptions?: unknown;
    explanation?: string;
    confidence?: number;
  }> };

  return (parsed.suggestions ?? [])
    .filter((item) => item.suggestionType === "Clarity" || item.suggestionType === "Engagement" || item.suggestionType === "Delivery")
    .map((item): Suggestion => ({
      startOffset: item.startOffset ?? -1,
      endOffset: item.endOffset ?? -1,
      suggestionType: item.suggestionType as Suggestion["suggestionType"],
      replacementOptions: Array.isArray(item.replacementOptions)
        ? item.replacementOptions.filter((option): option is string => typeof option === "string").slice(0, 5)
        : [],
      explanation: item.explanation ?? "Review this text.",
      confidence: item.confidence,
      source: "openai"
    }));
}

export async function rewriteWithOpenAI(
  text: string,
  tone: string,
  config: Config,
  fetchImpl: typeof fetch = fetch
): Promise<RewriteVariation[]> {
  const content = await complete(
    [
      "You rewrite highlighted text for a writing assistant.",
      "Return only JSON with a variations array containing exactly three objects.",
      "Each object must contain text and a short explanation.",
      "Preserve the meaning and do not add facts."
    ].join(" "),
    JSON.stringify({ text, desiredTone: tone }),
    config,
    fetchImpl
  );
  const parsed = extractJson(content) as { variations?: RewriteVariation[] };
  const variations = (parsed.variations ?? []).filter(
    (item) => typeof item?.text === "string" && typeof item?.explanation === "string"
  );
  if (variations.length !== 3) throw new Error("OpenAI must return exactly three rewrite variations");
  return variations;
}
