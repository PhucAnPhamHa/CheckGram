import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadConfig } from "./config.js";
import { analyzeRequestSchema, rewriteRequestSchema } from "./contracts.js";
import { analyzeText } from "./analyzer.js";
import { closeRedis, getCachedAnalysis, getSHA256Hash, setCachedAnalysis } from "./lib/redis.js";
import { remapSuggestionsToGlobal, splitIntoParagraphs } from "./utils/textChunker.js";
import type { LLMProviderType, StandardSuggestion } from "./services/llm/types.js";
import { LLMFactory } from "./services/llm/llm.factory.js";
import { FirecrawlService } from "./services/integrations/firecrawl.service.js";

async function analyzeDocument(
  text: string,
  tone: string,
  provider: LLMProviderType,
  forceRefresh: boolean,
  previousChunks: string[] | undefined,
  config: ReturnType<typeof loadConfig>,
  context?: string
) {
  const startedAt = performance.now();
  const chunks = splitIntoParagraphs(text);
  const previousChunkIds = new Set(previousChunks ?? []);
  const results = await Promise.all(chunks.map(async (chunk) => {
    const hash = getSHA256Hash(`${provider}:${tone}:${context ?? ""}:${chunk.text}`);
    const cachedSuggestions = forceRefresh ? null : await getCachedAnalysis(hash);
    if (cachedSuggestions) return { chunk, suggestions: cachedSuggestions, cached: true };

    const suggestions = provider === "openai" && !config.OPENAI_API_KEY
      ? await analyzeText(chunk.text, tone, config)
      : await providerSuggestions(chunk.text, tone, provider, config, context);
    await setCachedAnalysis(hash, suggestions);
    return { chunk, suggestions, cached: false };
  }));
  const suggestions = results.flatMap(({ chunk, suggestions: localSuggestions }) =>
    remapSuggestionsToGlobal(localSuggestions, chunk.startOffset)
  );
  const cachedChunks = results.filter(({ cached }) => cached).length;

  return {
    suggestions,
    meta: {
      totalChunks: chunks.length,
      cachedChunks,
      processedChunks: chunks.length - cachedChunks,
      unchangedChunks: chunks.filter((chunk) => previousChunkIds.has(chunk.id)).length,
      executionTimeMs: Math.round(performance.now() - startedAt)
    },
    chunks
  };
}

async function providerSuggestions(
  text: string,
  tone: string,
  provider: LLMProviderType,
  config: ReturnType<typeof loadConfig>,
  context?: string
) {
  const result = await LLMFactory.getProvider(provider, config).analyzeText({ text, tone, context });
  return result.map((suggestion: StandardSuggestion) => ({
    startOffset: suggestion.startOffset,
    endOffset: suggestion.endOffset,
    suggestionType: suggestion.category,
    replacementOptions: suggestion.replacements,
    explanation: suggestion.explanation,
    source: provider
  }));
}

export function buildServer() {
  const config = loadConfig();
  const app = Fastify({ logger: true });
  const firecrawl = new FirecrawlService();

  app.register(cors, { origin: true });
  app.get("/health", async () => ({ status: "ok" }));

  app.post("/api/v1/analyze", async (request, reply) => {
    const parsed = analyzeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    try {
      const result = await analyzeDocument(
        parsed.data.text,
        parsed.data.tone,
        parsed.data.provider,
        parsed.data.forceRefresh,
        parsed.data.previousChunks,
        config,
        parsed.data.contextUrl ? await firecrawl.scrapeUrlContext(parsed.data.contextUrl) ?? undefined : undefined
      );
      return reply.send({ suggestions: result.suggestions, meta: result.meta });
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ error: "Text analysis provider unavailable" });
    }
  });

  app.post("/api/v1/analyze/stream", async (request, reply) => {
    const parsed = analyzeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    reply.hijack();
    const response = reply.raw;
    response.writeHead(200, {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no"
    });
    const writeEvent = (event: string, data: unknown) => {
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const chunks = splitIntoParagraphs(parsed.data.text);
    const context = parsed.data.contextUrl
      ? await firecrawl.scrapeUrlContext(parsed.data.contextUrl)
      : undefined;
    writeEvent("analysis.started", { blockCount: chunks.length, textLength: parsed.data.text.length });

    try {
      for (const [blockIndex, chunk] of chunks.entries()) {
        if (response.destroyed) return;
        const hash = getSHA256Hash(`${parsed.data.provider}:${parsed.data.tone}:${context ?? ""}:${chunk.text}`);
        const cachedSuggestions = parsed.data.forceRefresh ? null : await getCachedAnalysis(hash);
        const suggestions = cachedSuggestions ?? (
          parsed.data.provider === "openai" && !config.OPENAI_API_KEY
            ? await analyzeText(chunk.text, parsed.data.tone, config)
            : await providerSuggestions(chunk.text, parsed.data.tone, parsed.data.provider, config, context ?? undefined)
        );
        if (!cachedSuggestions) await setCachedAnalysis(hash, suggestions);
        writeEvent("suggestions.block", {
          blockIndex,
          cached: Boolean(cachedSuggestions),
          startOffset: chunk.startOffset,
          endOffset: chunk.endOffset,
          suggestions: remapSuggestionsToGlobal(suggestions, chunk.startOffset)
        });
      }
      writeEvent("analysis.completed", { blockCount: chunks.length });
    } catch (error) {
      request.log.error(error);
      writeEvent("analysis.failed", { error: "Text analysis provider unavailable" });
    } finally {
      response.end();
    }
  });

  app.post("/api/v1/rewrite", async (request, reply) => {
    const parsed = rewriteRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }
    try {
      const provider = LLMFactory.getProvider(parsed.data.provider, config);
      const variations = await provider.rewriteText({ text: parsed.data.text, desiredTone: parsed.data.tone });
      return reply.send({ variations: variations.map((text) => ({ text, explanation: `Rewritten in a ${parsed.data.tone} tone.` })) });
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ error: "Rewrite provider unavailable" });
    }
  });

  app.addHook("onClose", closeRedis);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  const app = buildServer();
  app.listen({ host: config.HOST, port: config.PORT }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
