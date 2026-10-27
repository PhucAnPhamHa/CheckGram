# Text Processing API

The API is a Fastify service started with `npm run dev` or `npm start`.

## Configuration

Copy `.env.example` to `.env`. LanguageTool is enabled by default. Set `OPENAI_API_KEY` to enable contextual categories (`Clarity`, `Engagement`, and `Delivery`) and rewrites.

## Analyze text

```http
POST /api/v1/analyze
Content-Type: application/json

{
  "text": "This are a teh test.",
  "tone": "Professional"
}
```

Response:

```json
{
  "suggestions": [
    {
      "startOffset": 0,
      "endOffset": 4,
      "suggestionType": "Correctness",
      "replacementOptions": ["These"],
      "explanation": "The singular demonstrative pronoun does not agree with the plural verb.",
      "source": "languagetool"
    }
  ]
}
```

The analysis response also includes `meta.totalChunks`, `meta.cachedChunks`, `meta.processedChunks`, `meta.unchangedChunks`, and `meta.executionTimeMs`.

The request accepts optional `previousChunks` paragraph hashes and `forceRefresh`. When `forceRefresh` is false, each paragraph is looked up independently in Redis using a SHA-256 hash of `paragraphText:tone`. Only cache misses are sent to the analysis providers, in parallel.

`startOffset` is inclusive and `endOffset` is exclusive. Both are zero-based JavaScript UTF-16 offsets into the submitted `text`. The service rejects provider suggestions whose ranges are outside the source text. Overlapping suggestions are reduced to the highest-ranked result.

## Rewrite highlighted text

```http
POST /api/v1/rewrite
Content-Type: application/json

{
  "text": "Can you send this soon?",
  "tone": "Professional"
}
```

Response:

```json
{
  "variations": [
    {
      "text": "Could you please send this at your earliest convenience?",
      "explanation": "Uses a more formal request."
    },
    {
      "text": "Please send this when you have a moment.",
      "explanation": "Keeps the request professional and concise."
    },
    {
      "text": "Would you please send this soon?",
      "explanation": "Softens the request while preserving urgency."
    }
  ]
}
```

The rewrite route returns `503` when `OPENAI_API_KEY` is not configured and `502` when the provider fails.

## Streaming analysis

Long documents can be analyzed incrementally with the SSE endpoint:

```http
POST /api/v1/analyze/stream
Content-Type: application/json
Accept: text/event-stream

{
  "text": "A long document...",
  "tone": "Professional"
}
```

The endpoint emits `analysis.started`, one `suggestions.block` event per paragraph-sized block, and then `analysis.completed`:

```text
event: suggestions.block
data: {"blockIndex":0,"startOffset":0,"endOffset":1200,"suggestions":[...]}
```

Offsets in each block event remain offsets into the original full document. The frontend uses `fetch()` with an `AbortController` so a new edit cancels the previous stream and partial results from an older version cannot be applied.
