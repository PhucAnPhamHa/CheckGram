import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadConfig } from "./config.js";
import { analyzeRequestSchema, rewriteRequestSchema } from "./contracts.js";
import { analyzeText } from "./analyzer.js";
import { rewriteWithOpenAI } from "./providers/openai.js";

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
      const suggestions = await analyzeText(parsed.data.text, parsed.data.tone, config);
      return reply.send({ suggestions });
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ error: "Text analysis provider unavailable" });
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
