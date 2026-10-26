import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadConfig } from "./config.js";
import { analyzeRequestSchema, rewriteRequestSchema } from "./contracts.js";
import { analyzeText, splitIntoAnalysisBlocks } from "./analyzer.js";
import { analyzeTextCached } from "./analyzer.js";
import { rewriteWithOpenAI } from "./providers/openai.js";
import { SuggestionCache } from "./cache.js";

export function buildServer() {
  const config = loadConfig();
  const app = Fastify({ logger: true });
  const suggestionCache = new SuggestionCache(config, console);

  app.register(cors, { origin: true });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/api/v1/analyze", async (request, reply) => {
    const parsed = analyzeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    try {
      const result = await analyzeTextCached(parsed.data.text, parsed.data.tone, config, suggestionCache);
      return reply.send({ suggestions: result.suggestions, cached: result.cached });
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

    const blocks = splitIntoAnalysisBlocks(parsed.data.text);
    writeEvent("analysis.started", {
      blockCount: blocks.length,
      textLength: parsed.data.text.length
    });

    try {
      for (const block of blocks) {
        if (response.destroyed) return;
        const result = await analyzeTextCached(block.text, parsed.data.tone, config, suggestionCache);
        const blockSuggestions = result.suggestions;
        const suggestions = blockSuggestions.map((suggestion) => ({
          ...suggestion,
          startOffset: suggestion.startOffset + block.startOffset,
          endOffset: suggestion.endOffset + block.startOffset
        }));
        writeEvent("suggestions.block", {
          blockIndex: block.blockIndex,
          cached: result.cached,
          startOffset: block.startOffset,
          endOffset: block.startOffset + block.text.length,
          suggestions
        });

        app.addHook("onClose", async () => {
          await suggestionCache.close();
        });
      }
      writeEvent("analysis.completed", { blockCount: blocks.length });
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
    if (!config.OPENAI_API_KEY) {
      return reply.code(503).send({ error: "Rewrite service is not configured" });
    }

    try {
      const variations = await rewriteWithOpenAI(parsed.data.text, parsed.data.tone, config);
      return reply.send({ variations });
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ error: "Rewrite provider unavailable" });
    }
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  const app = buildServer();
  app.listen({ host: config.HOST, port: config.PORT })
    .catch((error) => {
      app.log.error(error);
      process.exit(1);
    });
}
