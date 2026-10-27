import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadConfig } from "./config.js";
import { analyzeRequestSchema, rewriteRequestSchema } from "./contracts.js";
import { analyzeText } from "./analyzer.js";
import { rewriteWithOpenAI } from "./providers/openai.js";
import { closeRedis, getCachedAnalysis, getSHA256Hash, setCachedAnalysis } from "./lib/redis.js";
import { remapSuggestionsToGlobal, splitIntoParagraphs } from "./utils/textChunker.js";

async function analyzeDocument(
  text: string,
  tone: string,
  forceRefresh: boolean,
  previousChunks: string[] | undefined,
  config: ReturnType<typeof loadConfig>
) {
  const startedAt = performance.now();
  const chunks = splitIntoParagraphs(text);
  const previousChunkIds = new Set(previousChunks ?? []);
  const results = await Promise.all(chunks.map(async (chunk) => {
    const hash = getSHA256Hash(`${chunk.text}:${tone}`);
    const cachedSuggestions = forceRefresh ? null : await getCachedAnalysis(hash);
    if (cachedSuggestions) return { chunk, suggestions: cachedSuggestions, cached: true };

    const suggestions = await analyzeText(chunk.text, tone, config);
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

export function buildServer() {
  const config = loadConfig();
  const app = Fastify({ logger: true });

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
        parsed.data.forceRefresh,
        parsed.data.previousChunks,
        config
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
    writeEvent("analysis.started", { blockCount: chunks.length, textLength: parsed.data.text.length });

    try {
      for (const [blockIndex, chunk] of chunks.entries()) {
        if (response.destroyed) return;
        const hash = getSHA256Hash(`${chunk.text}:${parsed.data.tone}`);
        const cachedSuggestions = parsed.data.forceRefresh ? null : await getCachedAnalysis(hash);
        const suggestions = cachedSuggestions ?? await analyzeText(chunk.text, parsed.data.tone, config);
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
    if (!config.OPENAI_API_KEY) return reply.code(503).send({ error: "Rewrite service is not configured" });
    try {
      const variations = await rewriteWithOpenAI(parsed.data.text, parsed.data.tone, config);
      return reply.send({ variations });
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
